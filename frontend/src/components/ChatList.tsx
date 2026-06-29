import { useEffect, useState } from "react";
import type { Conversation } from "../types";

const API = import.meta.env.VITE_API_URL || "";

interface Props {
  onSelect: (conversation: Conversation) => void;
}

export function ChatList({ onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/api/conversations`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load conversations");
        return r.json();
      })
      .then(setConversations)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      Loading chats...
    </div>
  );
  if (error) return (
    <div className="flex items-center justify-center h-full text-red-400">
      {error}
    </div>
  );
  if (conversations.length === 0) return (
    <div className="flex items-center justify-center h-full text-gray-400">
      No conversations yet
    </div>
  );

  return (
    <ul data-testid="conversation-list">
      {conversations.map((c) => (
        <li
          key={c.id}
          data-testid="conversation-item"
          onClick={() => onSelect(c)}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 border-b border-gray-100 last:border-0"
        >
          <img
            src={c.avatar_url}
            alt={c.name}
            className="w-12 h-12 rounded-full object-cover flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-baseline">
              <span className="font-semibold text-gray-900 truncate">{c.name}</span>
              {c.last_message_at && (
                <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                  {formatTime(c.last_message_at)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">{c.last_message ?? "No messages yet"}</p>
          </div>
          {(c.unread_count ?? 0) > 0 && (
            <span className="bg-green-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
              {c.unread_count}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
