import { useState, useRef } from "react";

interface Props {
  onSend: (text: string) => void;
  onTyping: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onTyping, disabled }: Props) {
  const [text, setText] = useState("");
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setText(e.target.value);
    onTyping();
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }

  function handleSend() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSend();
  }

  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-t border-gray-200">
      <input
        data-testid="message-input"
        type="text"
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Message"
        disabled={disabled}
        className="flex-1 bg-white rounded-full px-4 py-2 text-sm border border-gray-200 outline-none focus:border-green-400 disabled:opacity-50"
      />
      <button
        data-testid="send-button"
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        aria-label="Send message"
        className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-green-600 transition-colors flex-shrink-0"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
