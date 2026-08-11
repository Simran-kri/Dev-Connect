import { Heart, MessageSquare, Rss, Sparkles, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
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

  useEffect(() => {
    api.get("/notifications")
      .then(({ data }) => setNotifications(data.notifications))
      .catch(() => setNotifications([]));
  }, []);

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
          <div className={notification.read ? "notice" : "notice unread"} key={notification._id}>
            <Icon size={15} />
            <div>
              <span>{notification.text}</span>
              <time>{timeAgo(notification.createdAt)}</time>
            </div>
          </div>
        );
      })}
    </div>
  );
}
