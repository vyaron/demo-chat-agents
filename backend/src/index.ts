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

const isProduction = process.env.NODE_ENV === "production"

const configuredOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)

// Vite falls through to the next free port when 5173 is taken, so pinning one
// dev port here breaks CORS the moment that happens. Outside production, trust
// any localhost origin. In production the frontend is served from this same
// origin (see staticDir below), so only FRONTEND_URL is honoured.
const isLocalhost = (origin: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(origin)

const allowOrigin: cors.CorsOptions["origin"] = (origin, callback) => {
  if (!origin) return callback(null, true)
  if (configuredOrigins.includes(origin)) return callback(null, true)
  if (!isProduction && isLocalhost(origin)) return callback(null, true)
  callback(null, false)
}

const io = new Server(httpServer, {
  cors: {
    origin: allowOrigin,
    methods: ["GET", "POST"],
  },
});

app.use(cors({ origin: allowOrigin }));
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
