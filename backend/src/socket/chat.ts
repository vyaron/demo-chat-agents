import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { supabase } from "../lib/supabase";
import { AI_HISTORY_LIMIT, AI_SENDER, generateAiReply, hasAiMention } from "../lib/ai";

export function registerChatHandlers(io: Server, socket: Socket) {
  socket.on("join_room", ({ conversationId }: { conversationId: string }) => {
    socket.join(conversationId);
    socket.emit("joined_room", { conversationId });
  });

  socket.on("leave_room", ({ conversationId }: { conversationId: string }) => {
    socket.leave(conversationId);
  });

  socket.on(
    "send_message",
    async ({
      conversationId,
      senderId,
      senderName,
      content,
    }: {
      conversationId: string;
      senderId: string;
      senderName: string;
      content: string;
    }) => {
      if (!content?.trim()) return;

      const { data, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_id: senderId, sender_name: senderName, content: content.trim() })
        .select()
        .single();

      if (error) {
        socket.emit("error", { message: "Failed to save message" });
        return;
      }

      // Broadcast to all OTHER clients in the room (sender already optimistically rendered)
      socket.to(conversationId).emit("new_message", data);

      // Strictly after the user's message is saved and broadcast, so an
      // Anthropic outage can never roll either of them back. Not awaited: the
      // reply takes seconds and must not hold up the send handler.
      if (hasAiMention(content)) void replyAsAi(io, conversationId)
    }
  );

  socket.on(
    "user_typing",
    ({ conversationId, senderName }: { conversationId: string; senderName: string }) => {
      socket.to(conversationId).emit("user_typing", { senderName });
    }
  );
}

// Never throws: a Claude failure degrades to an `ai_error` notice in the room.
// An error is not chat history, so nothing is persisted for it.
async function replyAsAi(io: Server, conversationId: string) {
  io.to(conversationId).emit("ai_typing", { senderName: AI_SENDER.name })

  try {
    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select("sender_id, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(AI_HISTORY_LIMIT)

    if (historyError) throw historyError

    // Newest-first from the query so the limit keeps the *recent* messages;
    // Claude needs them oldest-first.
    const reply = await generateAiReply([...(history ?? [])].reverse())
    if (!reply) return

    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: AI_SENDER.id,
        sender_name: AI_SENDER.name,
        content: reply,
      })
      .select()
      .single()

    if (error) throw error

    // `io`, not `socket`: the sender only rendered its own text optimistically,
    // so it has to receive the reply like everyone else in the room.
    io.to(conversationId).emit("new_message", data)
  } catch (cause) {
    const requestId = randomUUID()

    console.error(
      JSON.stringify({
        level: "error",
        category: "infrastructure",
        requestId,
        operation: "ai.reply",
        conversationId,
        message: cause instanceof Error ? cause.message : String(cause),
      })
    )

    io.to(conversationId).emit("ai_error", {
      requestId,
      message: "The AI could not reply right now.",
    })
  }
}
