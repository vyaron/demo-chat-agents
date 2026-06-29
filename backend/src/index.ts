import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
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

const staticDirCandidates = [
  path.resolve(process.cwd(), "dist/public"),
  path.resolve(process.cwd(), "../frontend/dist"),
]
const staticDir = staticDirCandidates.find((candidate) => fs.existsSync(candidate))

if (staticDir) {
  app.use(express.static(staticDir))
}

app.use("/api/conversations", conversationsRouter);
app.use("/api/conversations", messagesRouter);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.get("*", (req, res, next) => {
  if (!staticDir) return next()
  if (req.path.startsWith("/api")) return next()
  if (req.path.startsWith("/socket.io")) return next()
  if (req.path === "/health") return next()

  res.sendFile(path.join(staticDir, "index.html"))
})

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
