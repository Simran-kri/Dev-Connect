import { Heart, MessageSquare, Rss, Sparkles, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import { useNotifications } from "../state/NotificationContext.jsx";
import { timeAgo } from "../lib/helpers.js";

const ICONS = {
  like: Heart,
  comment: MessageSquare,
  follow: UserPlus,
  message: Rss,
  project: Sparkles,
  group: Users
};

export default function NotificationList() {
  const [notifications, setNotifications] = useState(null);
  const navigate = useNavigate();
  const { refreshUnreadCount } = useNotifications();

  useEffect(() => {
    api.get("/notifications")
      .then(({ data }) => setNotifications(data.notifications))
      .catch(() => setNotifications([]));
  }, []);

  function markRead(id) {
    setNotifications((current) =>
      current.map((item) => item._id === id ? { ...item, read: true } : item)
    );
    api.patch(`/notifications/${id}/read`)
      .then(() => refreshUnreadCount())
      .catch(() => {
        // Not critical enough to surface an error for - it'll just stay
        // marked read locally until the next full refresh.
      });
  }

  function handleClick(notification) {
    if (!notification.read) markRead(notification._id);
    // Every notification type here has a person behind it (who liked,
    // commented, followed, messaged, etc.) - jump straight to their profile.
    if (notification.actor?._id) {
      navigate(`/users/${notification.actor._id}`);
    }
  }

  if (notifications === null) {
    return <p className="empty-state">Loading...</p>;
  }

  if (notifications.length === 0) {
    return (
      <div className="empty-state">
        <Sparkles size={20} />
        <strong>You're all caught up</strong>
        <span>New likes, follows, and comments will show up here.</span>
      </div>
    );
  }

  return (
    <div className="notification-list">
      {notifications.map((notification) => {
        const Icon = ICONS[notification.type] || Sparkles;
        return (
          <button
            className={notification.read ? "notice" : "notice unread"}
            key={notification._id}
            onClick={() => handleClick(notification)}
          >
            {!notification.read && <span className="notice-dot" />}
            <Icon size={15} />
            <div>
              <span>{notification.text}</span>
              <time>{timeAgo(notification.createdAt)}</time>
            </div>
          </button>
        );
      })}
    </div>
  );
}
