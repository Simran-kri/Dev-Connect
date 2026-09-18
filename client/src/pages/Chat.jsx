import { Check, Mic, MessageCircle, Square, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { io } from "socket.io-client";
import { API_URL, api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { demoUsers } from "../data/demo.js";
import Avatar from "../components/Avatar.jsx";

export default function Chat() {
  const { user } = useAuth();
  const location = useLocation();
  const socketRef = useRef(null);
  const [people, setPeople] = useState(demoUsers);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([
    { senderId: "demo", senderName: "Simran", text: "Can you explain JWT flow?" },
    { senderId: "you", senderName: "You", text: "Register/login creates token, protected routes verify it, frontend stores it and sends Bearer header." }
  ]);
  const [text, setText] = useState("");
  const [groupMode, setGroupMode] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupError, setGroupError] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadingVoice, setUploadingVoice] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  function peerOf(conversation) {
    return conversation.members?.find((member) => member._id !== user?._id) || conversation.members?.[0];
  }

  function formatMessages(rawMessages = [], members = [], currentUserId = user?._id) {
    return rawMessages.map((message) => {
      const senderId = message.sender?._id || message.sender;
      const isMe = String(senderId) === String(currentUserId);
      const sender = members.find((member) => String(member._id) === String(senderId));
      return {
        senderId,
        senderName: isMe ? "You" : sender?.name || "Member",
        text: message.text,
        audioUrl: message.audioUrl
      };
    });
  }

  function selectConversation(conversation) {
    setActiveConversation(conversation);
    setMessages(formatMessages(conversation.messages, conversation.members, user?._id));
    socketRef.current?.emit("join:conversation", conversation._id);
  }

  useEffect(() => {
    api.get("/users").then(({ data }) => setPeople(data.users)).catch(() => {});
    api.get("/chat").then(({ data }) => {
      setConversations(data.conversations);
      const targetId = location.state?.conversationId;
      const target = targetId && data.conversations.find((conversation) => conversation._id === targetId);
      if (target) {
        selectConversation(target);
      } else if (data.conversations[0]) {
        selectConversation(data.conversations[0]);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!user?._id || user._id === "demo-user") return;

    socketRef.current = io(API_URL, {
      auth: { token: localStorage.getItem("devconnect_token") }
    });
    socketRef.current.on("message:new", (conversation) => {
      setConversations((items) => {
        const remaining = items.filter((item) => item._id !== conversation._id);
        return [conversation, ...remaining];
      });
      setActiveConversation((current) => {
        if (current?._id === conversation._id) {
          setMessages(formatMessages(conversation.messages, conversation.members, user._id));
          return conversation;
        }
        return current;
      });
    });

    return () => socketRef.current?.disconnect();
  }, [user?._id]);

  async function startConversation(peerId) {
    const { data } = await api.post(`/chat/${peerId}`).catch(() => ({ data: null }));
    if (!data?.conversation) return;

    setConversations((items) => {
      const exists = items.some((item) => item._id === data.conversation._id);
      return exists ? items : [data.conversation, ...items];
    });
    selectConversation(data.conversation);
  }

  function toggleSelected(personId) {
    setSelectedIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );
  }

  async function createGroup(event) {
    event.preventDefault();
    setGroupError("");

    if (!groupName.trim()) {
      setGroupError("Give the group a name.");
      return;
    }
    if (selectedIds.length < 2) {
      setGroupError("Pick at least 2 other people to start a group.");
      return;
    }

    setCreatingGroup(true);
    try {
      const { data } = await api.post("/chat/group", { name: groupName, memberIds: selectedIds });
      setConversations((items) => [data.conversation, ...items]);
      selectConversation(data.conversation);
      setGroupMode(false);
      setGroupName("");
      setSelectedIds([]);
    } catch (err) {
      setGroupError(err.response?.data?.message || "Couldn't create the group. Try again.");
    } finally {
      setCreatingGroup(false);
    }
  }

  async function startRecording() {
    if (!activeConversation?._id || user?._id === "demo-user") return;
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
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
          socketRef.current?.emit("message:send", {
            conversationId: activeConversation._id,
            audioUrl: data.url
          });
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

  async function send(event) {
    event.preventDefault();
    if (!text.trim()) return;
    const nextText = text;
    setMessages([...messages, { senderId: user?._id, senderName: "You", text: nextText }]);
    setText("");

    if (!activeConversation?._id || user?._id === "demo-user") return;

    socketRef.current?.emit("message:send", {
      conversationId: activeConversation._id,
      text: nextText
    });
  }

  return (
    <section className="chat-layout">
      <aside className="panel">
        <div className="chat-sidebar-head">
          <h2>Messages</h2>
          <button className="icon-button" onClick={() => setGroupMode((value) => !value)} aria-label="Create group">
            {groupMode ? <X size={16} /> : <Users size={16} />}
          </button>
        </div>

        {groupMode ? (
          <form className="group-form" onSubmit={createGroup}>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" />
            <p className="group-form-label">Select at least 2 people</p>
            <div className="group-member-list">
              {people.map((person) => {
                const selected = selectedIds.includes(person._id);
                return (
                  <button
                    type="button"
                    key={person._id}
                    className={selected ? "person compact group-pick selected" : "person compact group-pick"}
                    onClick={() => toggleSelected(person._id)}
                  >
                    <Avatar name={person.name} image={person.avatar} size="small" />
                    <div><strong>{person.name}</strong></div>
                    {selected && <Check size={15} className="group-pick-check" />}
                  </button>
                );
              })}
            </div>
            {groupError && <p className="error">{groupError}</p>}
            <button className="primary pill full" disabled={creatingGroup}>
              {creatingGroup ? "Creating..." : `Create group${selectedIds.length ? ` (${selectedIds.length + 1})` : ""}`}
            </button>
          </form>
        ) : (
          <>
            {conversations.map((conversation) => {
              const peer = peerOf(conversation);
              return (
                <button
                  className="person compact conversation-button"
                  key={conversation._id}
                  onClick={() => selectConversation(conversation)}
                >
                  {conversation.isGroup ? (
                    <span className="avatar group-avatar"><Users size={16} /></span>
                  ) : (
                    <Avatar name={peer?.name} image={peer?.avatar} />
                  )}
                  <div>
                    <strong>{conversation.isGroup ? conversation.name : peer?.name || "Conversation"}</strong>
                    <small>{conversation.isGroup ? `${conversation.members?.length || 0} members` : peer?.title || "Developer"}</small>
                  </div>
                </button>
              );
            })}
            <h2 className="section-gap">Start chat</h2>
            {people.map((person) => (
              <div className="person compact" key={person._id}>
                <Avatar name={person.name} image={person.avatar} />
                <div><strong>{person.name}</strong><small>{person.title}</small></div>
                <button className="icon-button" onClick={() => startConversation(person._id)} aria-label={`Message ${person.name}`}>
                  <MessageCircle size={16} />
                </button>
              </div>
            ))}
          </>
        )}
      </aside>
      <section className="panel chat-panel">
        <h2>
          {activeConversation
            ? activeConversation.isGroup
              ? activeConversation.name
              : "Real-time chat"
            : "Demo chat"}
        </h2>
        <div className="messages">
          {messages.map((message, index) => (
            <div className={message.senderName === "You" ? "bubble mine" : "bubble"} key={`${message.senderId}-${index}`}>
              <small>{message.senderName}</small>
              {message.audioUrl ? (
                <audio className="voice-note-player" controls src={message.audioUrl} />
              ) : (
                <p>{message.text}</p>
              )}
            </div>
          ))}
        </div>
        {voiceError && <p className="error post-error">{voiceError}</p>}
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
    </section>
  );
}
