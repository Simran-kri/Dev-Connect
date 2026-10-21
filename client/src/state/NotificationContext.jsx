import { createContext, useContext, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_URL, api } from "../api.js";
import { useAuth } from "./AuthContext.jsx";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  function refreshUnreadCount() {
    if (!user?._id || user._id === "demo-user") return;
    api.get("/notifications")
      .then(({ data }) => setUnreadCount(data.notifications.filter((item) => !item.read).length))
      .catch(() => {});
  }

  useEffect(() => {
    if (!user?._id || user._id === "demo-user") {
      setUnreadCount(0);
      return;
    }

    refreshUnreadCount();

    const socket = io(API_URL, { auth: { token: localStorage.getItem("devconnect_token") } });
    socketRef.current = socket;
    // Re-read the true unread count from the server instead of blindly
    // incrementing, so the badge always matches what's actually unread.
    socket.on("notification:new", () => refreshUnreadCount());

    return () => socket.disconnect();
  }, [user?._id]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
