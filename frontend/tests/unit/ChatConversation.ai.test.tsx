import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatConversation } from "../../src/components/ChatConversation";
import type { Conversation, Message } from "../../src/types";

// Capture the socket handlers so the test can play server events back.
const handlers: Record<string, (payload: never) => void> = {};

vi.mock("../../src/lib/socket", () => ({
  getSocket: () => ({
    on: (event: string, handler: (payload: never) => void) => {
      handlers[event] = handler;
    },
    off: vi.fn(),
  }),
  joinRoom: vi.fn(),
  leaveRoom: vi.fn(),
  sendSocketMessage: vi.fn(),
  emitTyping: vi.fn(),
}));

const mockConversation: Conversation = {
  id: "conv-123",
  name: "Test Conversation",
  avatar_url: "https://example.com/avatar.jpg",
};

const mockMessages: Message[] = [
  {
    id: "1",
    conversation_id: "conv-123",
    sender_id: "demo-user",
    sender_name: "You",
    content: "@ai what is the weather?",
    created_at: new Date().toISOString(),
  },
];

const aiReply: Message = {
  id: "2",
  conversation_id: "conv-123",
  sender_id: "ai",
  sender_name: "AI",
  content: "Overcast with a chance of drizzle, sir.",
  created_at: new Date().toISOString(),
};

describe("ChatConversation - AI typing indicator", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMessages,
    });
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows the indicator on ai_typing and clears it when the reply arrives", async () => {
    render(<ChatConversation conversation={mockConversation} onBack={vi.fn()} />);

    await waitFor(() => expect(handlers.ai_typing).toBeTruthy());
    expect(screen.queryByTestId("typing-indicator")).toBeNull();

    act(() => handlers.ai_typing({ senderName: "AI" } as never));

    expect(screen.getByTestId("typing-indicator")).toBeTruthy();
    expect(screen.getByText("AI is typing...")).toBeTruthy();

    act(() => handlers.new_message(aiReply as never));

    await waitFor(() => {
      expect(screen.queryByTestId("typing-indicator")).toBeNull();
      expect(screen.getByText("Overcast with a chance of drizzle, sir.")).toBeTruthy();
    });
  });

  it("clears the indicator on ai_error without rendering a message", async () => {
    render(<ChatConversation conversation={mockConversation} onBack={vi.fn()} />);

    await waitFor(() => expect(handlers.ai_typing).toBeTruthy());

    act(() => handlers.ai_typing({ senderName: "AI" } as never));
    expect(screen.getByTestId("typing-indicator")).toBeTruthy();

    act(() => handlers.ai_error({ message: "The AI could not reply right now." } as never));

    await waitFor(() => expect(screen.queryByTestId("typing-indicator")).toBeNull());
    expect(screen.queryByText("The AI could not reply right now.")).toBeNull();
  });
});
