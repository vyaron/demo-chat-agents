import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { conversationsRouter } from "./routes/conversations";
import { messagesRouter } from "./routes/messages";
import { registerChatHandlers } from "./socket/chat";

dotenv.config();

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:5173" }));
app.use(express.json());

app.use("/api/conversations", conversationsRouter);
app.use("/api/conversations", messagesRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

io.on("connection", (socket) => {
  registerChatHandlers(io, socket);
});

const PORT = process.env.PORT || 3001;
if (!process.env.VITEST) {
  httpServer.listen(PORT, () => {
    console.log(`QuickChat backend running on http://localhost:${PORT}`);
  });
}

export { app, io };
