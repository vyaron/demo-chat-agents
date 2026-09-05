import Anthropic from "@anthropic-ai/sdk"

// The persona from the backlog task. Kept short on purpose: it is re-sent on
// every call, and a long persona crowds out the conversation history.
export const AI_SYSTEM_PROMPT =
  "Answer the user like a British butler: impeccably polite, formal, dry, and " +
  "unflappable. You are a participant in a chat thread, so keep replies to a " +
  "few sentences — this is a message, not a letter."

// `sender_id` and `sender_name` are plain text with no foreign key (see
// backend/supabase/schema.sql), so the AI is a valid sender with no migration.
export const AI_SENDER = { id: "ai", name: "AI" } as const

// Enough context to follow the thread, bounded so a chatty room cannot run away
// with the token budget.
export const AI_HISTORY_LIMIT = 20

const AI_MODEL = "claude-opus-5"
const AI_MAX_TOKENS = 1024

// A literal `@ai` token: whitespace or a string edge in front, anything but a
// word character behind. `@aisle` fails the trailing boundary and
// `email@ai.com` fails the leading one, so neither triggers a reply — while
// ordinary punctuation ("@ai, what's the weather?") still does.
const AI_MENTION = /(^|\s)@ai(?![a-z0-9_])/i

export interface AiHistoryMessage {
  sender_id: string
  content: string
}

export function hasAiMention(content: string): boolean {
  return typeof content === "string" && AI_MENTION.test(content)
}

// Constructed lazily: `new Anthropic()` throws when ANTHROPIC_API_KEY is unset,
// and importing this module must never take the server down. A missing key then
// surfaces as an ordinary call failure the socket handler already catches.
let client: Anthropic | null = null

function getClient(): Anthropic {
  if (!client) client = new Anthropic()
  return client
}

// Returns the reply text, or null when there is nothing worth posting — a
// refusal or an empty completion. Rejects on transport and API errors; the
// caller decides what a failure means for the thread.
export async function generateAiReply(
  history: AiHistoryMessage[],
  prompt: string = AI_SYSTEM_PROMPT
): Promise<string | null> {
  const messages: Anthropic.MessageParam[] = history
    .slice(-AI_HISTORY_LIMIT)
    .map((message) => ({
      role: message.sender_id === AI_SENDER.id ? "assistant" : "user",
      content: message.content,
    }))

  // The API requires the conversation to open on a user turn.
  while (messages.length > 0 && messages[0].role === "assistant") messages.shift()
  if (messages.length === 0) return null

  const response = await getClient().messages.create({
    model: AI_MODEL,
    max_tokens: AI_MAX_TOKENS,
    system: prompt,
    // Low effort keeps a chat reply snappy. Adaptive thinking is left at the
    // model default — explicitly disabling it on this model risks `<thinking>`
    // tags leaking into visible output.
    output_config: { effort: "low" },
    messages,
  })

  // A refusal is an HTTP 200 with empty content, so the stop reason has to be
  // checked before touching `content` — indexing it would throw.
  if (response.stop_reason === "refusal") return null

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim()

  return text || null
}
