import Conversation from "./models/Conversation.js";
import Notification from "./models/Notification.js";
import User from "./models/User.js";
import { verifyToken } from "./utils/tokens.js";

// Every socket must present a valid JWT (same one used for REST auth) before
// it can join rooms or send messages. This prevents a connected client from
// spoofing another user's identity by simply passing a different senderId.
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select("_id status");

    if (!user || user.status === "banned") {
      return next(new Error("Invalid account"));
    }

    socket.data.userId = String(user._id);
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
}

export function registerSocket(io) {
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    // Auto-join the caller's own notification room; identity comes from the
    // verified token, never from client-supplied input.
    socket.join(`user:${socket.data.userId}`);

    socket.on("join:conversation", async (conversationId) => {
      if (!conversationId) return;

      const conversation = await Conversation.findById(conversationId).select("members");
      const isMember = conversation?.members.some((id) => String(id) === socket.data.userId);
      if (!isMember) return;

      socket.join(`conversation:${conversationId}`);
    });

    socket.on("message:send", async ({ conversationId, text }) => {
      const senderId = socket.data.userId;
      if (!conversationId || !text) return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const isMember = conversation.members.some((id) => String(id) === senderId);
      if (!isMember) return;

      conversation.messages.push({ sender: senderId, text });
      await conversation.save();

      const populated = await conversation.populate("members", "name avatar title");
      io.to(`conversation:${conversationId}`).emit("message:new", populated);

      const recipient = conversation.members.find((id) => String(id) !== senderId);
      if (recipient) {
        await Notification.create({
          recipient,
          actor: senderId,
          type: "message",
          text: "You have a new message"
        });
        io.to(`user:${recipient}`).emit("notification:new");
      }
    });
  });
}

