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

  it("highlights matching text when highlightQuery is provided", () => {
    const { container } = render(
      <MessageBubble message={base} isOwn={false} highlightQuery="Hello" />
    );
    const highlighted = container.querySelector(".bg-yellow-300");
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe("Hello");
  });

  it("performs case-insensitive highlighting", () => {
    const { container } = render(
      <MessageBubble message={base} isOwn={false} highlightQuery="hello" />
    );
    const highlighted = container.querySelector(".bg-yellow-300");
    expect(highlighted).toBeTruthy();
    expect(highlighted?.textContent).toBe("Hello");
  });

  it("highlights multiple occurrences", () => {
    const message: Message = {
      ...base,
      content: "Hello Hello Hello",
    };
    const { container } = render(
      <MessageBubble message={message} isOwn={false} highlightQuery="Hello" />
    );
    const highlights = container.querySelectorAll(".bg-yellow-300");
    expect(highlights.length).toBe(3);
  });

  it("does not highlight with empty query", () => {
    const { container } = render(
      <MessageBubble message={base} isOwn={false} highlightQuery="" />
    );
    expect(container.querySelector(".bg-yellow-300")).toBeNull();
  });

  it("marks message as highlighted-message for testing", () => {
    render(
      <MessageBubble message={base} isOwn={false} highlightQuery="Hello" />
    );
    expect(screen.getByTestId("highlighted-message")).toBeTruthy();
  });
});
