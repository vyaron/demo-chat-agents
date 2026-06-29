import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ChatConversation } from "../../src/components/ChatConversation";
import type { Conversation, Message } from "../../src/types";

// Mock socket
vi.mock("../../src/lib/socket", () => ({
  getSocket: () => ({
    on: vi.fn(),
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
    sender_id: "alice",
    sender_name: "Alice",
    content: "Hello there!",
    created_at: new Date().toISOString(),
  },
  {
    id: "2",
    conversation_id: "conv-123",
    sender_id: "demo-user",
    sender_name: "You",
    content: "Hi Alice, how are you?",
    created_at: new Date().toISOString(),
  },
];

describe("ChatConversation - Search State", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    // Mock scrollIntoView for jsdom
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("displays search input", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMessages,
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search messages")).toBeTruthy();
    });
  });

  it("shows all messages by default (no search)", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMessages,
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Hello there!")).toBeTruthy();
      expect(screen.getByText("Hi Alice, how are you?")).toBeTruthy();
    });
  });

  it("calls search endpoint when user searches", async () => {
    let callCount = 0;
    global.fetch = vi.fn((url) => {
      callCount++;
      if (url.includes("/messages/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockMessages[0]],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    const searchInput = await screen.findByPlaceholderText("Search messages");
    await userEvent.type(searchInput, "Hello");

    // Wait for debounce and API call
    await waitFor(
      () => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/messages/search?q=Hello")
        );
      },
      { timeout: 500 }
    );
  });

  it("displays result count when searching", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/messages/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockMessages[0]],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    const searchInput = await screen.findByPlaceholderText("Search messages");
    await userEvent.type(searchInput, "Hello");

    await waitFor(() => {
      expect(screen.getByText("1 result")).toBeTruthy();
    });
  });

  it("clears search and shows all messages when clear button is clicked", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/messages/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockMessages[0]],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    const searchInput = await screen.findByPlaceholderText("Search messages");
    await userEvent.type(searchInput, "Hello");

    await waitFor(() => {
      expect(screen.getByTestId("clear-search-btn")).toBeTruthy();
    });

    const clearBtn = screen.getByTestId("clear-search-btn");
    await userEvent.click(clearBtn);

    await waitFor(() => {
      expect(searchInput as HTMLInputElement).toHaveValue("");
    });
  });

  it("handles search with no results", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/messages/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    const searchInput = await screen.findByPlaceholderText("Search messages");
    await userEvent.type(searchInput, "nonexistent");

    await waitFor(() => {
      expect(screen.getByText("No messages match your search.")).toBeTruthy();
    });
  });

  it("hides input area when search is active", async () => {
    global.fetch = vi.fn((url) => {
      if (url.includes("/messages/search")) {
        return Promise.resolve({
          ok: true,
          json: async () => [mockMessages[0]],
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => mockMessages,
      });
    });

    const { container } = render(
      <ChatConversation
        conversation={mockConversation}
        onBack={vi.fn()}
      />
    );

    const searchInput = await screen.findByPlaceholderText("Search messages");

    // Find ChatInput - it should exist initially
    let chatInput = container.querySelector('input[placeholder="Message"]');
    expect(chatInput).toBeTruthy();

    // Type in search
    await userEvent.type(searchInput, "Hello");

    // ChatInput should be hidden during search
    await waitFor(() => {
      chatInput = container.querySelector('input[placeholder="Message"]');
      expect(chatInput).toBeNull();
    });
  });
});
