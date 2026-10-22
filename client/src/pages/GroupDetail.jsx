import { Mic, Square, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

// How often the chat checks for new messages from other members.
const REFRESH_MS = 4000;

export default function GroupDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const bottomRef = useRef(null);

  // Returns true if the group loaded, false if the user can't see it.
  async function loadGroup() {
    try {
      const { data } = await api.get(`/groups/${id}`);
      setGroup(data.group);
      setMessages(data.group.messages || []);
      setError("");
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "This group doesn't exist.");
      return false;
    }
  }

  // Load the chat, then keep refreshing it while the page is open.
  useEffect(() => {
    let cancelled = false;
    let timer;

    async function tick() {
      const ok = await loadGroup();
      if (!cancelled && ok) timer = setTimeout(tick, REFRESH_MS);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length]);

  async function send(event) {
    event.preventDefault();
    const content = text.trim();
    if (!content || sending) return;

    setSending(true);
    setSendError("");
    try {
      const { data } = await api.post(`/groups/${id}/messages`, { text: content });
      setMessages((current) => [...current.filter((m) => m._id !== data.message._id), data.message]);
      setText("");
    } catch (err) {
      // The text stays in the box so nothing is lost.
      setSendError(err.response?.data?.message || "Message not delivered. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  }

  async function postVoiceNote(blob) {
    setUploadingVoice(true);
    setVoiceError("");
    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");
      const { data: upload } = await api.post("/uploads/audio", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      const { data } = await api.post(`/groups/${id}/messages`, { audioUrl: upload.url });
      setMessages((current) => [...current.filter((m) => m._id !== data.message._id), data.message]);
    } catch (err) {
      setVoiceError(err.response?.data?.message || "Couldn't send the voice note.");
    } finally {
      setUploadingVoice(false);
    }
  }

  async function startRecording() {
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        postVoiceNote(blob);
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
          </div>
        ))}
        {messages.length === 0 && <p className="empty-state">Be the first to say something in this group.</p>}
        <div ref={bottomRef} />
      </div>

      {(sendError || voiceError) && <p className="error post-error">{sendError || voiceError}</p>}
      <form className="message-box" onSubmit={send}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={recording || sending}
        />
        <button
          type="button"
          className={recording ? "icon-button recording" : "icon-button"}
          onClick={recording ? stopRecording : startRecording}
          disabled={uploadingVoice}
          aria-label={recording ? "Stop recording" : "Record a voice note"}
        >
          {recording ? <Square size={16} /> : <Mic size={16} />}
        </button>
        <button className="primary" disabled={recording || sending || uploadingVoice}>
          {uploadingVoice ? "Sending..." : sending ? "Sending..." : "Send"}
        </button>
      </form>
    </section>
  );
}