import type { Server, Socket } from "socket.io";
import { supabase } from "../lib/supabase";

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
    }
  );

  socket.on(
    "user_typing",
    ({ conversationId, senderName }: { conversationId: string; senderName: string }) => {
      socket.to(conversationId).emit("user_typing", { senderName });
    }
  );
}
