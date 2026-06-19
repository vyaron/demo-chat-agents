import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ChatInput } from "../../src/components/ChatInput";

describe("ChatInput", () => {
  it("send button is disabled when input is empty", () => {
    render(<ChatInput onSend={vi.fn()} onTyping={vi.fn()} />);
    expect(screen.getByTestId("send-button")).toBeDisabled();
  });

  it("send button is enabled when input has text", () => {
    render(<ChatInput onSend={vi.fn()} onTyping={vi.fn()} />);
    fireEvent.change(screen.getByTestId("message-input"), { target: { value: "hi" } });
    expect(screen.getByTestId("send-button")).not.toBeDisabled();
  });

  it("calls onSend with trimmed text when button clicked", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onTyping={vi.fn()} />);
    fireEvent.change(screen.getByTestId("message-input"), { target: { value: "  hello  " } });
    fireEvent.click(screen.getByTestId("send-button"));
    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("clears input after send", () => {
    render(<ChatInput onSend={vi.fn()} onTyping={vi.fn()} />);
    const input = screen.getByTestId("message-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByTestId("send-button"));
    expect(input.value).toBe("");
  });

  it("calls onSend when Enter is pressed", () => {
    const onSend = vi.fn();
    render(<ChatInput onSend={onSend} onTyping={vi.fn()} />);
    fireEvent.change(screen.getByTestId("message-input"), { target: { value: "enter test" } });
    fireEvent.keyDown(screen.getByTestId("message-input"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("enter test");
  });

  it("calls onTyping when user types", () => {
    const onTyping = vi.fn();
    render(<ChatInput onSend={vi.fn()} onTyping={onTyping} />);
    fireEvent.change(screen.getByTestId("message-input"), { target: { value: "a" } });
    expect(onTyping).toHaveBeenCalled();
  });
});
