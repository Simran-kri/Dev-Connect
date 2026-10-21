import { Mic, Square, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { API_URL, api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

const DELIVERY_TIMEOUT_MS = 10000;

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [connected, setConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  useEffect(() => {
    api.get(`/groups/${id}`)
      .then(({ data }) => {
        setGroup(data.group);
        setMessages(data.group.messages || []);
      })
      .catch((err) => setError(err.response?.data?.message || "This group doesn't exist."));
  }, [id]);

  useEffect(() => {
    if (!user?._id || user._id === "demo-user" || error) return;

    const socket = io(API_URL, { auth: { token: localStorage.getItem("devconnect_token") } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSendError("");
      socket.emit("group:join", id);
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("connect_error", (err) => {
      setConnected(false);
      setSendError(`Chat connection failed: ${err.message}`);
    });

    socket.on("group:message:new", (payload) => {
      if (payload.groupId !== id) return;
      const incoming = payload.message;
      const isMine = String(incoming.sender?._id) === String(user._id);

      setMessages((current) => {
        if (isMine) {
          // Replace our pending placeholder with the saved message.
          const pendingIndex = current.findIndex((m) => m.pending && m.text === incoming.text);
          if (pendingIndex >= 0) {
            const next = [...current];
            next[pendingIndex] = incoming;
            return next;
          }
        }
        return [...current, incoming];
      });
    });

    return () => {
      socket.emit("group:leave", id);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [id, user?._id, error]);

  function send(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content) return;

    const socket = socketRef.current;
    if (!socket || !connected) {
      setSendError("Not connected to the group chat. Refresh the page and try again.");
      return;
    }

    setSendError("");
    const tempId = `pending-${Date.now()}`;
    setMessages((current) => [
      ...current,
      { _id: tempId, text: content, sender: { _id: user._id, name: user.name }, pending: true }
    ]);
    setText("");

    socket.emit("group:message", { groupId: id, text: content });

    // If the server never echoes the message back, mark it as not delivered.
    setTimeout(() => {
      setMessages((current) =>
        current.map((m) => (m._id === tempId && m.pending ? { ...m, pending: false, failed: true } : m))
      );
    }, DELIVERY_TIMEOUT_MS);
  }

  async function startRecording() {
    if (user?._id === "demo-user") return;
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });

        setUploadingVoice(true);
        try {
          const formData = new FormData();
          formData.append("audio", blob, "voice-note.webm");
          const { data } = await api.post("/uploads/audio", formData, {
            headers: { "Content-Type": "multipart/form-data" }
          });
          socketRef.current?.emit("group:message", { groupId: id, audioUrl: data.url });
        } catch (err) {
          setVoiceError(err.response?.data?.message || "Couldn't send the voice note.");
        } finally {
          setUploadingVoice(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setVoiceError("Couldn't access your microphone. Check your browser's permission for this site.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  if (error) {
    return (
      <section className="panel empty-state">
        <Users size={20} />
        <strong>{error}</strong>
      </section>
    );
  }

  return (
    <section className="panel chat-panel">
      <div className="room-detail-head">
        <div>
          <h2>{group?.name || "Loading..."}</h2>
          {group?.description && <p>{group.description}</p>}
        </div>
        <div className="room-participants">
          <Users size={14} />
          <span>{group?.members?.length || 0} members</span>
        </div>
      </div>

      <div className="messages">
        {messages.map((message) => (
          <div
            className={String(message.sender?._id) === String(user?._id) ? "bubble mine" : "bubble"}
            key={message._id}
          >
            <small>{message.sender?.name}</small>
            {message.audioUrl ? (
              <audio className="voice-note-player" controls src={message.audioUrl} />
            ) : (
              <p>{message.text}</p>
            )}
            {message.pending && <small>Sending...</small>}
            {message.failed && <small className="error">Not delivered</small>}
          </div>
        ))}
        {messages.length === 0 && <p className="empty-state">Be the first to say something in this group.</p>}
      </div>

      {(sendError || voiceError) && <p className="error post-error">{sendError || voiceError}</p>}
      <form className="message-box" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." disabled={recording} />
        <button
          type="button"
          className={recording ? "icon-button recording" : "icon-button"}
          onClick={recording ? stopRecording : startRecording}
          disabled={uploadingVoice}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
        >
          {recording ? <Square size={16} /> : <Mic size={16} />}
        </button>
        <button className="primary" disabled={recording || uploadingVoice}>
          {uploadingVoice ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}