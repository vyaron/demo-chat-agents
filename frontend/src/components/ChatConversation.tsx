import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "../types";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { SearchInput } from "./SearchInput";
import { getSocket, joinRoom, leaveRoom, sendSocketMessage, emitTyping } from "../lib/socket";

const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:3001" : "")
const MY_ID = "demo-user";
const MY_NAME = "You";

interface Props {
  conversation: Conversation;
  onBack: () => void;
}

export function ChatConversation({ conversation, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [disconnected, setDisconnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredMessages, setFilteredMessages] = useState<Message[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`${API}/api/conversations/${conversation.id}/messages`)
      .then((r) => r.json())
      .then(setMessages)
      .finally(() => setLoading(false));

    joinRoom(conversation.id);
    const socket = getSocket();

    socket.on("new_message", (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
    });

    socket.on("user_typing", ({ senderName }: { senderName: string }) => {
      if (senderName === MY_NAME) return;
      setTypingUser(senderName);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingUser(null), 2000);
    });

    socket.on("disconnect", () => setDisconnected(true));
    socket.on("connect", () => setDisconnected(false));

    return () => {
      leaveRoom(conversation.id);
      socket.off("new_message");
      socket.off("user_typing");
      socket.off("disconnect");
      socket.off("connect");
    };
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [filteredMessages, typingUser]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setFilteredMessages([]);
      setSearchQuery("");
      return;
    }

    setSearchQuery(query);
    setSearchLoading(true);

    try {
      const response = await fetch(
        `${API}/api/conversations/${conversation.id}/messages/search?q=${encodeURIComponent(
          query
        )}`
      );
      if (response.ok) {
        const results = await response.json();
        setFilteredMessages(results);
      } else {
        setFilteredMessages([]);
      }
    } catch (error) {
      console.error("Search error:", error);
      setFilteredMessages([]);
    } finally {
      setSearchLoading(false);
    }
  }, [conversation.id]);

  function handleSend(text: string) {
    const optimistic: Message = {
      id: crypto.randomUUID(),
      conversation_id: conversation.id,
      sender_id: MY_ID,
      sender_name: MY_NAME,
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    sendSocketMessage(conversation.id, MY_ID, MY_NAME, text);
  }

  function handleTyping() {
    emitTyping(conversation.id, MY_NAME);
  }

  const isSearchActive = searchQuery.length > 0;
  const displayedMessages = isSearchActive ? filteredMessages : messages;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#075E54] text-white shadow">
        <button onClick={onBack} aria-label="Back" className="text-white hover:opacity-75 mr-1">
          <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
        </button>
        <img src={conversation.avatar_url} alt={conversation.name}
          className="w-9 h-9 rounded-full object-cover" />
        <div>
          <p className="font-semibold text-sm">{conversation.name}</p>
          <p className="text-xs text-green-200 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-300 inline-block" />
            online
          </p>
        </div>
      </div>

      {disconnected && (
        <div className="bg-yellow-400 text-yellow-900 text-xs text-center py-1 px-3">
          Reconnecting...
        </div>
      )}

      {/* Search Bar */}
      <SearchInput
        onSearch={handleSearch}
        isLoading={searchLoading}
        resultCount={isSearchActive ? filteredMessages.length : undefined}
      />

      {/* Messages */}
      <div
        data-testid="message-list"
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ background: "#ECE5DD url(\"data:image/svg+xml,%3Csvg...%3E\") repeat" }}
      >
        {loading && !isSearchActive && (
          <p className="text-center text-gray-400 text-sm mt-8">Loading messages...</p>
        )}
        {!loading && messages.length === 0 && !isSearchActive && (
          <p className="text-center text-gray-400 text-sm mt-8">No messages yet. Say hi!</p>
        )}
        {isSearchActive && displayedMessages.length === 0 && !searchLoading && (
          <p className="text-center text-gray-400 text-sm mt-8">No messages match your search.</p>
        )}
        {displayedMessages.map((m) => (
          <MessageBubble
            key={m.id}
            message={m}
            isOwn={m.sender_id === MY_ID}
            highlightQuery={isSearchActive ? searchQuery : undefined}
          />
        ))}
        {typingUser && !isSearchActive && (
          <div data-testid="typing-indicator" className="flex justify-start mb-1">
            <div className="bg-white rounded-2xl rounded-bl-sm px-4 py-2 shadow-sm">
              <p className="text-xs text-gray-400 italic">{typingUser} is typing...</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {!isSearchActive && <ChatInput onSend={handleSend} onTyping={handleTyping} />}
    </div>
  );
}
