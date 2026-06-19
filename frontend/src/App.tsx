import { useState } from "react";
import { ChatList } from "./components/ChatList";
import { ChatConversation } from "./components/ChatConversation";
import type { Conversation } from "./types";

export default function App() {
  const [active, setActive] = useState<Conversation | null>(null);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200">
      <div className="w-full max-w-sm h-[700px] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {active ? (
          <ChatConversation conversation={active} onBack={() => setActive(null)} />
        ) : (
          <>
            {/* App Header */}
            <div className="bg-[#075E54] text-white px-4 py-4 flex items-center justify-between">
              <h1 className="text-lg font-bold tracking-wide">QuickChat</h1>
              <div className="w-8 h-8 rounded-full bg-green-300 flex items-center justify-center text-green-900 font-bold text-sm">
                Y
              </div>
            </div>

            {/* Search */}
            <div className="px-4 py-2 bg-white border-b border-gray-100">
              <div className="bg-gray-100 rounded-full px-4 py-2 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                  className="w-4 h-4 text-gray-400">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search"
                  className="bg-transparent text-sm outline-none flex-1 text-gray-600 placeholder-gray-400"
                />
              </div>
            </div>

            {/* Conversations */}
            <div className="flex-1 overflow-y-auto">
              <ChatList onSelect={setActive} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
