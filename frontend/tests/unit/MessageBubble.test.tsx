import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MessageBubble } from "../../src/components/MessageBubble";
import type { Message } from "../../src/types";

const base: Message = {
  id: "1",
  conversation_id: "conv-1",
  sender_id: "alice",
  sender_name: "Alice",
  content: "Hello there!",
  created_at: new Date().toISOString(),
};

describe("MessageBubble", () => {
  it("renders message content", () => {
    render(<MessageBubble message={base} isOwn={false} />);
    expect(screen.getByText("Hello there!")).toBeTruthy();
  });

  it("shows sender name for others' messages", () => {
    render(<MessageBubble message={base} isOwn={false} />);
    expect(screen.getByText("Alice")).toBeTruthy();
  });

  it("does NOT show sender name for own messages", () => {
    render(<MessageBubble message={base} isOwn={true} />);
    expect(screen.queryByText("Alice")).toBeNull();
  });

  it("applies green background for own messages", () => {
    const { container } = render(<MessageBubble message={base} isOwn={true} />);
    expect(container.querySelector(".bg-\\[\\#25D366\\]")).toBeTruthy();
  });

  it("applies white background for others' messages", () => {
    const { container } = render(<MessageBubble message={base} isOwn={false} />);
    expect(container.querySelector(".bg-white")).toBeTruthy();
  });
});
