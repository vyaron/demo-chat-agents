import type { Message } from "../types";

interface Props {
  message: Message;
  isOwn: boolean;
  highlightQuery?: string;
}

export function MessageBubble({ message, isOwn, highlightQuery }: Props) {
  const content = highlightQuery
    ? highlightText(message.content, highlightQuery)
    : message.content;

  return (
    <div
      data-testid="message-bubble"
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-1`}
    >
      <div
        className={`max-w-[70%] px-3 py-2 rounded-2xl shadow-sm ${
          isOwn
            ? "bg-[#25D366] text-white rounded-br-sm"
            : "bg-white text-gray-900 rounded-bl-sm"
        }`}
      >
        {!isOwn && (
          <p className="text-xs font-semibold text-green-600 mb-0.5">{message.sender_name}</p>
        )}
        <p
          className="text-sm leading-relaxed break-words"
          data-testid={highlightQuery ? "highlighted-message" : undefined}
        >
          {typeof content === "string" ? content : content}
        </p>
        <p className={`text-[10px] mt-0.5 text-right ${isOwn ? "text-green-100" : "text-gray-400"}`}>
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;

  const regex = new RegExp(`(${query})`, "gi");
  const parts = text.split(regex);

  return parts.map((part, i) => {
    if (regex.test(part)) {
      return (
        <span key={i} className="bg-yellow-300 font-semibold text-gray-900">
          {part}
        </span>
      );
    }
    return part;
  });
}
