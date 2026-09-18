import { Mic, MicOff, PhoneOff, Radio, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { API_URL, api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

// Free public STUN server for NAT traversal. This works for most home/college
// networks but has no fallback (no TURN server) for stricter networks - some
// participants on restrictive corporate/mobile networks may fail to connect.
// A production version of this would add a TURN server for those cases.
const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export default function RoomDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const [room, setRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [closing, setClosing] = useState(false);

  // ---------- Voice channel state ----------
  const [inVoice, setInVoice] = useState(false);
  const [joiningVoice, setJoiningVoice] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState([]);
  const [voiceError, setVoiceError] = useState("");
  const [hostMutedNote, setHostMutedNote] = useState(false);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const audioElsRef = useRef(new Map());

  const isHost = room?.host?._id && user?._id && String(room.host._id) === String(user._id);

  useEffect(() => {
    api.get(`/rooms/${id}`)
      .then(({ data }) => {
        setRoom(data.room);
        setMessages(data.room.messages || []);
      })
      .catch((err) => setError(err.response?.data?.message || "This room doesn't exist or has been closed."));
  }, [id]);

  function createPeerConnection(targetSocketId, socket) {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("voice:signal", {
          roomId: id,
          targetSocketId,
          signal: { type: "ice-candidate", candidate: event.candidate }
        });
      }
    };

    pc.ontrack = (event) => {
      let audioEl = audioElsRef.current.get(targetSocketId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioElsRef.current.set(targetSocketId, audioEl);
      }
      audioEl.srcObject = event.streams[0];
    };

    peersRef.current.set(targetSocketId, pc);
    return pc;
  }

  function teardownVoice() {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    audioElsRef.current.forEach((el) => { el.srcObject = null; });
    audioElsRef.current.clear();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setInVoice(false);
    setMuted(false);
    setVoiceParticipants([]);
  }

  async function joinVoice() {
    setVoiceError("");
    setJoiningVoice(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      setInVoice(true);
      socketRef.current?.emit("voice:join", id);
    } catch (err) {
      setVoiceError("Couldn't access your microphone. Check your browser's permission for this site.");
    } finally {
      setJoiningVoice(false);
    }
  }

  function leaveVoice() {
    socketRef.current?.emit("voice:leave", id);
    teardownVoice();
  }

  function toggleMute() {
    if (!localStreamRef.current) return;
    const nextMuted = !muted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
    if (!nextMuted) setHostMutedNote(false);
  }

  function hostMuteParticipant(targetUserId) {
    socketRef.current?.emit("voice:host-mute", { roomId: id, targetUserId });
  }

  useEffect(() => {
    if (!user?._id || user._id === "demo-user") return;

    const socket = io(API_URL, { auth: { token: localStorage.getItem("devconnect_token") } });
    socketRef.current = socket;

    socket.emit("room:join", id);

    socket.on("room:message:new", (payload) => {
      if (payload.roomId !== id) return;
      setMessages((current) => [...current, payload.message]);
    });

    socket.on("room:presence", (payload) => {
      if (payload.roomId !== id) return;
      setParticipants(payload.participants);
    });

    // ---------- Voice signaling ----------

    socket.on("voice:existing-peers", async ({ roomId, peers }) => {
      if (roomId !== id) return;
      for (const peer of peers) {
        const pc = createPeerConnection(peer.socketId, socket);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("voice:signal", { roomId: id, targetSocketId: peer.socketId, signal: { type: "offer", sdp: offer } });
      }
    });

    socket.on("voice:signal", async ({ roomId, fromSocketId, signal }) => {
      if (roomId !== id) return;
      let pc = peersRef.current.get(fromSocketId);

      if (signal.type === "offer") {
        if (!pc) pc = createPeerConnection(fromSocketId, socket);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("voice:signal", { roomId: id, targetSocketId: fromSocketId, signal: { type: "answer", sdp: answer } });
      } else if (signal.type === "answer" && pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === "ice-candidate" && pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        } catch {
          // Late/duplicate candidates are common and harmless to ignore.
        }
      }
    });

    socket.on("voice:peer-left", ({ roomId, socketId }) => {
      if (roomId !== id) return;
      peersRef.current.get(socketId)?.close();
      peersRef.current.delete(socketId);
      audioElsRef.current.delete(socketId);
    });

    socket.on("voice:presence", (payload) => {
      if (payload.roomId !== id) return;
      setVoiceParticipants(payload.participants);
    });

    socket.on("voice:join-rejected", ({ roomId, reason }) => {
      if (roomId !== id) return;
      // We already grabbed the mic optimistically before the server could
      // confirm there was room - release it now that we know we're not in.
      teardownVoice();
      setVoiceError(reason);
    });

    socket.on("voice:force-mute", ({ roomId }) => {
      if (roomId !== id) return;
      localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = false; });
      setMuted(true);
      setHostMutedNote(true);
    });

    return () => {
      socket.emit("room:leave", id);
      teardownVoice();
      socket.disconnect();
    };
  }, [id, user?._id]);

  function send(event) {
    event.preventDefault();
    if (!text.trim()) return;
    socketRef.current?.emit("room:message", { roomId: id, text });
    setText("");
  }

  async function closeRoom() {
    if (!window.confirm("Close this room for everyone? This can't be undone.")) return;
    setClosing(true);
    try {
      await api.delete(`/rooms/${id}`);
      navigate("/rooms");
    } catch {
      setClosing(false);
    }
  }

  if (error) {
    return (
      <section className="panel empty-state">
        <Radio size={20} />
        <strong>{error}</strong>
      </section>
    );
  }

  return (
    <section className="panel chat-panel room-panel">
      <div className="room-detail-head">
        <div>
          <span className="eyebrow room-live-badge"><Radio size={13} /> Live</span>
          <h2>{room?.name || "Loading..."}</h2>
          {room?.description && <p>{room.description}</p>}
        </div>
        {isHost && (
          <button className="danger-action secondary" onClick={closeRoom} disabled={closing}>
            <X size={15} /> {closing ? "Closing..." : "Close room"}
          </button>
        )}
      </div>

      <div className="room-participants">
        <Users size={14} />
        <span>{participants.length} here now</span>
        <div className="room-participant-avatars">
          {participants.slice(0, 8).map((participant) => (
            <Avatar key={participant.userId} name={participant.name} image={participant.avatar} size="small" />
          ))}
        </div>
      </div>

      <div className="voice-panel">
        <div className="voice-panel-head">
          <strong>Voice</strong>
          <span className="voice-panel-note">Best with a few people - uses your microphone directly.</span>
        </div>

        {voiceParticipants.length > 0 && (
          <div className="voice-speakers">
            {voiceParticipants.map((peer) => {
              const isMe = String(peer.userId) === String(user?._id);
              return (
                <div className="voice-speaker" key={peer.userId}>
                  <Avatar name={peer.name} image={peer.avatar} size="small" />
                  <span>{peer.name}</span>
                  {isHost && !isMe && (
                    <button
                      className="voice-speaker-mute"
                      onClick={() => hostMuteParticipant(peer.userId)}
                      aria-label={`Mute ${peer.name}`}
                      title="Mute this person"
                    >
                      <MicOff size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {hostMutedNote && <p className="voice-panel-note voice-host-muted">The host muted you.</p>}

        {voiceError && <p className="error post-error">{voiceError}</p>}

        <div className="voice-controls">
          {!inVoice ? (
            <button className="primary pill" onClick={joinVoice} disabled={joiningVoice}>
              <Mic size={15} /> {joiningVoice ? "Requesting mic..." : "Join with mic"}
            </button>
          ) : (
            <>
              <button className="secondary pill" onClick={toggleMute}>
                {muted ? <MicOff size={15} /> : <Mic size={15} />} {muted ? "Unmute" : "Mute"}
              </button>
              <button className="danger-action secondary pill" onClick={leaveVoice}>
                <PhoneOff size={15} /> Leave voice
              </button>
            </>
          )}
        </div>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <div
            className={String(message.sender?._id) === String(user?._id) ? "bubble mine" : "bubble"}
            key={message._id}
          >
            <small>{message.sender?.name}</small>
            <p>{message.text}</p>
          </div>
        ))}
        {messages.length === 0 && <p className="empty-state">Be the first to say something in this room.</p>}
      </div>

      <form className="message-box" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something..." />
        <button className="primary">Send</button>
      </form>
    </section>
  );
}
