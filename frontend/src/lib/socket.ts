import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const apiUrl = import.meta.env.VITE_API_URL
    socket = apiUrl
      ? io(apiUrl, {
        autoConnect: true,
        reconnectionAttempts: 5,
      })
      : io({
        autoConnect: true,
        reconnectionAttempts: 5,
      })
  }
  return socket;
}

export function joinRoom(conversationId: string) {
  getSocket().emit("join_room", { conversationId });
}

export function leaveRoom(conversationId: string) {
  getSocket().emit("leave_room", { conversationId });
}

export function sendSocketMessage(conversationId: string, senderId: string, senderName: string, content: string) {
  getSocket().emit("send_message", { conversationId, senderId, senderName, content });
}

export function emitTyping(conversationId: string, senderName: string) {
  getSocket().emit("user_typing", { conversationId, senderName });
}
