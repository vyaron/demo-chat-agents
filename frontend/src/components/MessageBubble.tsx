import type { Message } from "../types";

interface Props {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: Props) {
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
        <p className="text-sm leading-relaxed break-words">{message.content}</p>
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
