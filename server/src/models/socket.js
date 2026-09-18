import Conversation from "./models/Conversation.js";
import Notification from "./models/Notification.js";
import Room from "./models/Room.js";
import User from "./models/User.js";
import { roomPresence } from "./state/roomPresence.js";
import { verifyToken } from "./utils/tokens.js";

// Every socket must present a valid JWT (same one used for REST auth) before
// it can join rooms or send messages. This prevents a connected client from
// spoofing another user's identity by simply passing a different senderId.
async function authenticateSocket(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication required"));

    const payload = verifyToken(token);
    const user = await User.findById(payload.id).select("_id name avatar status");

    if (!user || user.status === "banned") {
      return next(new Error("Invalid account"));
    }

    socket.data.userId = String(user._id);
    socket.data.name = user.name;
    socket.data.avatar = user.avatar;
    next();
  } catch (error) {
    next(new Error("Invalid or expired token"));
  }
}
export function registerSocket(io) {
  io.use(authenticateSocket);

  // In-memory presence for live public rooms: roomId -> Map<socketId, participant>.
  // Deliberately not persisted - presence is "who's here right now", not history,
  // and resets naturally if the server restarts (same as any live-room product).
  // (Imported from state/roomPresence.js so REST routes can read real counts too.)

  // Separate presence just for who has opted into voice (mic access is an
  // explicit, separate action from just being in the room to chat).
  const voicePresence = new Map();

  function broadcastPresence(roomId) {
    const sockets = roomPresence.get(roomId);
    const participants = sockets ? [...new Map([...sockets.values()].map((p) => [p.userId, p])).values()] : [];
    io.to(`room:${roomId}`).emit("room:presence", { roomId, participants, count: participants.length });
  }

  function broadcastVoicePresence(roomId) {
    const sockets = voicePresence.get(roomId);
    const participants = sockets
      ? [...new Map([...sockets.values()].map((p) => [p.userId, p])).values()]
      : [];
    io.to(`room:${roomId}`).emit("voice:presence", { roomId, participants });
  }

  io.on("connection", (socket) => {
    // Auto-join the caller's own notification room; identity comes from the
    // verified token, never from client-supplied input.
    socket.join(`user:${socket.data.userId}`);
    socket.data.joinedRooms = new Set();

    socket.on("join:conversation", async (conversationId) => {
      if (!conversationId) return;

      const conversation = await Conversation.findById(conversationId).select("members");
      const isMember = conversation?.members.some((id) => String(id) === socket.data.userId);
      if (!isMember) return;

      socket.join(`conversation:${conversationId}`);
    });

    socket.on("message:send", async ({ conversationId, text, audioUrl }) => {
      const senderId = socket.data.userId;
      if (!conversationId || (!text?.trim() && !audioUrl)) return;

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) return;

      const isMember = conversation.members.some((id) => String(id) === senderId);
      if (!isMember) return;

      conversation.messages.push({ sender: senderId, text: text || "", audioUrl: audioUrl || "" });
      await conversation.save();

      const populated = await conversation.populate("members", "name avatar title");
      io.to(`conversation:${conversationId}`).emit("message:new", populated);

      const recipients = conversation.members.filter((id) => String(id) !== senderId);
      if (recipients.length) {
        await Notification.insertMany(
          recipients.map((recipient) => ({
            recipient,
            actor: senderId,
            type: "message",
            text: conversation.isGroup ? `New message in ${conversation.name}` : "You have a new message"
          }))
        );
        recipients.forEach((recipient) => {
          io.to(`user:${recipient}`).emit("notification:new");
        });
      }
    });

    // ---------- Public live rooms ----------

    socket.on("room:join", async (roomId) => {
      if (!roomId) return;
      const room = await Room.findById(roomId).select("isPrivate host allowedUsers");
      if (!room || !room.canEnter(socket.data.userId)) return;

      socket.join(`room:${roomId}`);
      socket.data.joinedRooms.add(roomId);

      if (!roomPresence.has(roomId)) roomPresence.set(roomId, new Map());
      roomPresence.get(roomId).set(socket.id, {
        userId: socket.data.userId,
        name: socket.data.name,
        avatar: socket.data.avatar
      });

      broadcastPresence(roomId);
    });

    socket.on("room:leave", (roomId) => {
      if (!roomId) return;
      socket.leave(`room:${roomId}`);
      socket.data.joinedRooms.delete(roomId);
      roomPresence.get(roomId)?.delete(socket.id);
      broadcastPresence(roomId);
    });

    socket.on("room:message", async ({ roomId, text }) => {
      if (!roomId || !text?.trim()) return;

      const room = await Room.findById(roomId);
      if (!room) return;

      const message = { sender: socket.data.userId, text: text.trim() };
      room.messages.push(message);
      await room.save();

      const saved = room.messages[room.messages.length - 1];
      io.to(`room:${roomId}`).emit("room:message:new", {
        roomId,
        message: {
          _id: saved._id,
          text: saved.text,
          createdAt: saved.createdAt,
          sender: { _id: socket.data.userId, name: socket.data.name, avatar: socket.data.avatar }
        }
      });
    });

    // ---------- Voice channel (WebRTC signaling relay) ----------
    // The server never touches audio itself - it only relays signaling
    // messages (offers/answers/ICE candidates) between peers so their
    // browsers can establish a direct connection. This is a mesh setup: the
    // newly-joining peer connects to every existing voice participant
    // individually, which works well for small groups but doesn't scale
    // past a handful of simultaneous speakers.

    const VOICE_CAP = 15;

    socket.on("voice:join", async (roomId) => {
      if (!roomId || !socket.rooms.has(`room:${roomId}`)) return;

      const existingPeers = [...(voicePresence.get(roomId)?.values() || [])];

      if (existingPeers.length >= VOICE_CAP) {
        socket.emit("voice:join-rejected", { roomId, reason: `Voice is full (${VOICE_CAP} people max).` });
        return;
      }

      if (!voicePresence.has(roomId)) voicePresence.set(roomId, new Map());
      voicePresence.get(roomId).set(socket.id, {
        socketId: socket.id,
        userId: socket.data.userId,
        name: socket.data.name,
        avatar: socket.data.avatar
      });
      socket.data.inVoiceRooms = socket.data.inVoiceRooms || new Set();
      socket.data.inVoiceRooms.add(roomId);

      // Tell the new joiner who's already here, so they know who to send
      // offers to. Existing peers just wait for an incoming offer.
      socket.emit("voice:existing-peers", { roomId, peers: existingPeers });
      socket.to(`room:${roomId}`).emit("voice:peer-joined", {
        roomId,
        peer: { socketId: socket.id, userId: socket.data.userId, name: socket.data.name, avatar: socket.data.avatar }
      });

      broadcastVoicePresence(roomId);
    });

    socket.on("voice:leave", (roomId) => {
      if (!roomId) return;
      voicePresence.get(roomId)?.delete(socket.id);
      socket.data.inVoiceRooms?.delete(roomId);
      socket.to(`room:${roomId}`).emit("voice:peer-left", { roomId, socketId: socket.id });
      broadcastVoicePresence(roomId);
    });

    socket.on("voice:signal", ({ roomId, targetSocketId, signal }) => {
      if (!roomId || !targetSocketId || !signal) return;
      // Only relay to someone actually in this room's voice channel - stops
      // a socket from using this as a generic message-anyone relay.
      if (!voicePresence.get(roomId)?.has(targetSocketId)) return;

      io.to(targetSocketId).emit("voice:signal", {
        roomId,
        fromSocketId: socket.id,
        fromUserId: socket.data.userId,
        signal
      });
    });

    // Host mute is a REQUEST the target's own browser honors, not something
    // the host can force directly - WebRTC gives no peer control over
    // another peer's microphone. This matches how Zoom/Meet/Discord do it
    // too (soft mute); a determined client could in principle ignore it,
    // which a production system would harden with a media server (SFU)
    // that can actually drop the audio track server-side.
    socket.on("voice:host-mute", async ({ roomId, targetUserId }) => {
      if (!roomId || !targetUserId) return;

      const room = await Room.findById(roomId).select("host");
      if (!room || String(room.host) !== socket.data.userId) return;

      const targetEntry = [...(voicePresence.get(roomId)?.values() || [])]
        .find((peer) => String(peer.userId) === String(targetUserId));
      if (!targetEntry) return;

      io.to(targetEntry.socketId).emit("voice:force-mute", { roomId });
    });

    socket.on("disconnect", () => {
      socket.data.joinedRooms?.forEach((roomId) => {
        roomPresence.get(roomId)?.delete(socket.id);
        broadcastPresence(roomId);
      });
      socket.data.inVoiceRooms?.forEach((roomId) => {
        voicePresence.get(roomId)?.delete(socket.id);
        socket.to(`room:${roomId}`).emit("voice:peer-left", { roomId, socketId: socket.id });
        broadcastVoicePresence(roomId);
      });
    });
  });
}
