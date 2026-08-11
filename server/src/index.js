import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import http from "http";
import morgan from "morgan";
import { Server } from "socket.io";
import { connectDb } from "./config/db.js";
import adminRoutes from "./routes/admin.js";
import authRoutes from "./routes/auth.js";
import chatRoutes from "./routes/chat.js";
import groupRoutes from "./routes/groups.js";
import notificationRoutes from "./routes/notifications.js";
import postRoutes from "./routes/posts.js";
import projectRoutes from "./routes/projects.js";
import searchRoutes from "./routes/search.js";
import uploadRoutes from "./routes/uploads.js";
import userRoutes from "./routes/users.js";
import { registerSocket } from "./socket.js";

const app = express();
const server = http.createServer(app);
const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";

const io = new Server(server, {
  cors: {
    origin: clientUrl,
    credentials: true
  }
});

app.use(helmet());
app.use(cors({ origin: clientUrl, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(morgan("dev"));

app.get("/health", (req, res) => {
  res.json({ status: "ok", app: "DevConnect API" });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/groups", groupRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/admin", adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || "Server error" });
});

registerSocket(io);

const port = process.env.PORT || 5000;

export { app, server };

export async function startServer() {
  await connectDb();
  server.listen(port, () => {
    console.log(`DevConnect API running on http://localhost:${port}`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });
}
