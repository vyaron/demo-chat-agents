import { describe, it, expect, vi, beforeEach } from "vitest"

// The SDK is mocked wholesale: these tests must never reach Anthropic, and the
// suite must pass with no ANTHROPIC_API_KEY set.
const createMock = vi.fn()

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: createMock }
  },
}))

vi.mock("../src/lib/supabase", () => ({ supabase: { from: vi.fn() } }))

import { supabase } from "../src/lib/supabase"
import { AI_SENDER, generateAiReply, hasAiMention } from "../src/lib/ai"
import { registerChatHandlers } from "../src/socket/chat"

function textReply(text: string) {
  return { stop_reason: "end_turn", content: [{ type: "text", text }] }
}

// ---------------------------------------------------------------------------
// Supabase test double. Every call goes through `from("messages")`, so inserted
// rows are collected in one place and the history read is stubbed per test.
// ---------------------------------------------------------------------------

let inserted: Record<string, unknown>[] = []

function mockSupabase(
  options: { historyRows?: unknown[]; historyError?: unknown; insertError?: unknown } = {}
) {
  inserted = []
  ;(supabase.from as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const query: Record<string, unknown> & { row?: Record<string, unknown> } = {}

    Object.assign(query, {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      insert: vi.fn((row: Record<string, unknown>) => {
        inserted.push(row)
        query.row = row
        return query
      }),
      limit: vi.fn(() =>
        Promise.resolve({
          data: options.historyRows ?? [],
          error: options.historyError ?? null,
        })
      ),
      single: vi.fn(() =>
        Promise.resolve(
          options.insertError
            ? { data: null, error: options.insertError }
            : { data: { id: `row-${inserted.length}`, ...query.row }, error: null }
        )
      ),
    })

    return query
  })
}

function makeIo() {
  const roomEmit = vi.fn()
  const to = vi.fn(() => ({ emit: roomEmit }))
  return { io: { to } as never, to, roomEmit }
}

function makeSocket() {
  const handlers: Record<string, (payload: never) => unknown> = {}
  const roomEmit = vi.fn()
  const socket = {
    on: (event: string, handler: (payload: never) => unknown) => {
      handlers[event] = handler
    },
    join: vi.fn(),
    leave: vi.fn(),
    emit: vi.fn(),
    to: vi.fn(() => ({ emit: roomEmit })),
  }
  return { socket: socket as never, handlers, socketRoomEmit: roomEmit, raw: socket }
}

beforeEach(() => {
  createMock.mockReset()
  vi.mocked(supabase.from).mockReset()
})

// ---------------------------------------------------------------------------

describe("hasAiMention", () => {
  it.each([
    "@ai",
    "@AI",
    "@Ai",
    "hey @ai there",
    "what do you think @ai",
    "@ai, the weather?",
    "ask @ai.",
  ])("matches %j", (content) => {
    expect(hasAiMention(content)).toBe(true)
  })

  it.each(["@aisle", "email@ai.com", "ai", "", "  ", "aim@ai", "@aid", "@ai5"])(
    "does not match %j",
    (content) => {
      expect(hasAiMention(content)).toBe(false)
    }
  )
})

describe("generateAiReply", () => {
  it("returns the joined text of the reply", async () => {
    createMock.mockResolvedValue(textReply("  Very good, sir.  "))

    const reply = await generateAiReply([{ sender_id: "u1", content: "@ai hello" }])

    expect(reply).toBe("Very good, sir.")
  })

  it("caps the history it sends at 20 messages", async () => {
    createMock.mockResolvedValue(textReply("Indeed, sir."))

    const history = Array.from({ length: 25 }, (_, i) => ({
      sender_id: "u1",
      content: `message ${i}`,
    }))
    await generateAiReply(history)

    const sent = createMock.mock.calls[0][0].messages
    expect(sent).toHaveLength(20)
    expect(sent[0].content).toBe("message 5")
    expect(sent[19].content).toBe("message 24")
  })

  it("maps the AI's own past messages to assistant turns", async () => {
    createMock.mockResolvedValue(textReply("Quite so, sir."))

    await generateAiReply([
      { sender_id: "u1", content: "@ai hello" },
      { sender_id: AI_SENDER.id, content: "Good day, sir." },
      { sender_id: "u1", content: "@ai again" },
    ])

    expect(createMock.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "@ai hello" },
      { role: "assistant", content: "Good day, sir." },
      { role: "user", content: "@ai again" },
    ])
  })

  it("drops leading assistant turns so the conversation opens on a user turn", async () => {
    createMock.mockResolvedValue(textReply("As you wish, sir."))

    await generateAiReply([
      { sender_id: AI_SENDER.id, content: "Good day, sir." },
      { sender_id: "u1", content: "@ai hello" },
    ])

    expect(createMock.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "@ai hello" },
    ])
  })

  it("returns null on a refusal without touching content", async () => {
    createMock.mockResolvedValue({ stop_reason: "refusal", content: [] })

    await expect(generateAiReply([{ sender_id: "u1", content: "@ai hello" }])).resolves.toBeNull()
  })

  it("returns null when the completion has no text", async () => {
    createMock.mockResolvedValue({ stop_reason: "end_turn", content: [] })

    await expect(generateAiReply([{ sender_id: "u1", content: "@ai hello" }])).resolves.toBeNull()
  })

  it("makes no call when there is no history", async () => {
    await expect(generateAiReply([])).resolves.toBeNull()
    expect(createMock).not.toHaveBeenCalled()
  })
})

describe("send_message AI branch", () => {
  const payload = {
    conversationId: "conv-1",
    senderId: "u1",
    senderName: "You",
    content: "hey @ai, the weather?",
  }

  it("inserts the user message then an AI message", async () => {
    mockSupabase({ historyRows: [{ sender_id: "u1", content: "hey @ai, the weather?" }] })
    createMock.mockResolvedValue(textReply("Overcast, sir."))

    const { io } = makeIo()
    const { socket, handlers } = makeSocket()
    registerChatHandlers(io, socket)

    await handlers.send_message(payload as never)
    await vi.waitFor(() => expect(inserted).toHaveLength(2))

    expect(inserted[0]).toMatchObject({ sender_id: "u1", content: "hey @ai, the weather?" })
    expect(inserted[1]).toMatchObject({
      conversation_id: "conv-1",
      sender_id: "ai",
      sender_name: "AI",
      content: "Overcast, sir.",
    })
  })

  it("emits the reply with io.to so the sender receives it too", async () => {
    mockSupabase({ historyRows: [{ sender_id: "u1", content: "hey @ai, the weather?" }] })
    createMock.mockResolvedValue(textReply("Overcast, sir."))

    const { io, to, roomEmit } = makeIo()
    const { socket, handlers, socketRoomEmit } = makeSocket()
    registerChatHandlers(io, socket)

    await handlers.send_message(payload as never)
    await vi.waitFor(() =>
      expect(roomEmit).toHaveBeenCalledWith(
        "new_message",
        expect.objectContaining({ sender_id: "ai" })
      )
    )

    expect(to).toHaveBeenCalledWith("conv-1")
    // socket.to carried only the user's own message, never the AI reply.
    expect(socketRoomEmit).toHaveBeenCalledTimes(1)
    expect(socketRoomEmit).toHaveBeenCalledWith(
      "new_message",
      expect.objectContaining({ sender_id: "u1" })
    )
  })

  it("signals ai_typing while the call is in flight", async () => {
    mockSupabase({ historyRows: [{ sender_id: "u1", content: "hey @ai, the weather?" }] })
    createMock.mockResolvedValue(textReply("Overcast, sir."))

    const { io, roomEmit } = makeIo()
    const { socket, handlers } = makeSocket()
    registerChatHandlers(io, socket)

    await handlers.send_message(payload as never)

    expect(roomEmit).toHaveBeenCalledWith("ai_typing", { senderName: "AI" })
  })

  it("makes zero Anthropic calls and inserts one row without a mention", async () => {
    mockSupabase()

    const { io } = makeIo()
    const { socket, handlers } = makeSocket()
    registerChatHandlers(io, socket)

    await handlers.send_message({ ...payload, content: "just an @aisle of email@ai.com" } as never)
    await vi.waitFor(() => expect(inserted).toHaveLength(1))

    expect(createMock).not.toHaveBeenCalled()
  })

  it("keeps the user message and emits ai_error when Claude fails", async () => {
    mockSupabase({ historyRows: [{ sender_id: "u1", content: "hey @ai, the weather?" }] })
    createMock.mockRejectedValue(new Error("429 rate limit"))
    const logged = vi.spyOn(console, "error").mockImplementation(() => {})

    const { io, roomEmit } = makeIo()
    const { socket, handlers, socketRoomEmit } = makeSocket()
    registerChatHandlers(io, socket)

    await handlers.send_message(payload as never)
    await vi.waitFor(() =>
      expect(roomEmit).toHaveBeenCalledWith(
        "ai_error",
        expect.objectContaining({ message: expect.any(String) })
      )
    )

    // The user's own message survives the failure, saved and broadcast.
    expect(inserted).toHaveLength(1)
    expect(inserted[0]).toMatchObject({ sender_id: "u1" })
    expect(socketRoomEmit).toHaveBeenCalledWith(
      "new_message",
      expect.objectContaining({ sender_id: "u1" })
    )
    expect(logged).toHaveBeenCalled()

    logged.mockRestore()
  })

  it("inserts nothing on a refusal and does not throw", async () => {
    mockSupabase({ historyRows: [{ sender_id: "u1", content: "hey @ai, the weather?" }] })
    createMock.mockResolvedValue({ stop_reason: "refusal", content: [] })

    const { io, roomEmit } = makeIo()
    const { socket, handlers } = makeSocket()
    registerChatHandlers(io, socket)

    await expect(handlers.send_message(payload as never)).resolves.not.toThrow()
    await vi.waitFor(() => expect(createMock).toHaveBeenCalled())

    expect(inserted).toHaveLength(1)
    expect(roomEmit).not.toHaveBeenCalledWith("ai_error", expect.anything())
  })
})
