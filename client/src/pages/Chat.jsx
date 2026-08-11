import { MessageCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { demoUsers } from "../data/demo.js";
import Avatar from "../components/Avatar.jsx";

export default function Chat() {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [people, setPeople] = useState(demoUsers);
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([
    { sender: "Simran", text: "Can you explain JWT flow?" },
    { sender: "You", text: "Register/login creates token, protected routes verify it, frontend stores it and sends Bearer header." }
  ]);
  const [text, setText] = useState("");

  function formatMessages(rawMessages = [], currentUserId = user?._id) {
    return rawMessages.map((message) => ({
      sender: String(message.sender) === String(currentUserId) ? "You" : "Peer",
      text: message.text
    }));
  }

  function selectConversation(conversation) {
    setActiveConversation(conversation);
    setMessages(formatMessages(conversation.messages, user?._id));
    socketRef.current?.emit("join:conversation", conversation._id);
  }

  useEffect(() => {
    api.get("/users").then(({ data }) => setPeople(data.users)).catch(() => {});
    api.get("/chat").then(({ data }) => {
      setConversations(data.conversations);
      if (data.conversations[0]) {
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
          setMessages(formatMessages(conversation.messages, user._id));
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

  async function send(event) {
    event.preventDefault();
    if (!text.trim()) return;
    const nextText = text;
    setMessages([...messages, { sender: "You", text: nextText }]);
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
        <h2>Messages</h2>
        {conversations.map((conversation) => {
          const peer = conversation.members?.find((member) => member._id !== user?._id) || conversation.members?.[0];
          return (
            <button className="person compact conversation-button" key={conversation._id} onClick={() => selectConversation(conversation)}>
              <Avatar name={peer?.name} image={peer?.avatar} />
              <div><strong>{peer?.name || "Conversation"}</strong><small>{peer?.title || "Developer"}</small></div>
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
      </aside>
      <section className="panel chat-panel">
        <h2>{activeConversation ? "Real-time chat" : "Demo chat"}</h2>
        <div className="messages">
          {messages.map((message, index) => (
            <div className={message.sender === "You" ? "bubble mine" : "bubble"} key={`${message.sender}-${index}`}>
              <small>{message.sender}</small>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
        <form className="message-box" onSubmit={send}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." />
          <button className="primary">Send</button>
        </form>
      </section>
    </section>
  );
}
