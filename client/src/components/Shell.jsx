import { Bell, Code2, FolderGit2, LogOut, MessageCircle, Moon, Radio, ShieldCheck, Sun, UserRound, UsersRound, Compass } from "lucide-react";
import { Suspense, lazy } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "../state/AuthContext.jsx";
import { useNotifications } from "../state/NotificationContext.jsx";
import { useTheme } from "../state/ThemeContext.jsx";
import Avatar from "./Avatar.jsx";
import VerifyBanner from "./VerifyBanner.jsx";
import Feed from "../pages/Feed.jsx";
import Projects from "../pages/Projects.jsx";
import ProjectDetail from "../pages/ProjectDetail.jsx";
import Network from "../pages/Network.jsx";
import UserDetail from "../pages/UserDetail.jsx";
import Chat from "../pages/Chat.jsx";
import Groups from "../pages/Groups.jsx";
import Rooms from "../pages/Rooms.jsx";
import RoomDetail from "../pages/RoomDetail.jsx";
import Profile from "../pages/Profile.jsx";

// Admin pulls in recharts, which is a heavy dependency only the small
// fraction of admin users ever need - lazy-loading it keeps that weight out
// of the bundle everyone else downloads just to use the feed.
const Admin = lazy(() => import("../pages/Admin.jsx"));

export default function Shell() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const links = [
    ["Feed", "/", Compass],
    ["Projects", "/projects", FolderGit2],
    ["Network", "/network", UsersRound],
    ["Chat", "/chat", MessageCircle],
    ["Rooms", "/rooms", Radio],
    ["Groups", "/groups", Code2],
    ["Profile", "/profile", UserRound],
    ["Admin", "/admin", ShieldCheck]
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Code2 size={24} /></div>
          <div>
            <strong>DevConnect</strong>
            <span>Developer network</span>
          </div>
        </div>
        <nav>
          {links.map(([label, to, Icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => isActive ? "active" : ""}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar-holder">
            <Avatar name={user?.name} image={user?.avatar} />
            <i className="status-dot" />
          </span>
          <div>
            <strong>{user?.name}</strong>
            <small>{user?.title || "Developer"}</small>
          </div>
        </div>
        <button className="ghost theme-toggle" onClick={toggleTheme}>
          {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          {theme === "dark" ? "Light mode" : "Dark mode"}
        </button>
        <button className="ghost danger" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <span className="eyebrow">Developer Feed</span>
            <h1>See what developers are building right now.</h1>
          </div>
          <div className="profile-chip">
            <button className="notif-bell" onClick={() => navigate("/")} aria-label="Notifications">
              <Bell size={18} />
              {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>
            <Avatar name={user?.name} image={user?.avatar} />
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.title || "Developer"}</small>
            </div>
          </div>
        </header>
        <VerifyBanner />
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/network" element={<Network />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/rooms" element={<Rooms />} />
          <Route path="/rooms/:id" element={<RoomDetail />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile" element={<Profile />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<p className="empty-state">Loading dashboard...</p>}>
                <Admin />
              </Suspense>
            }
          />
        </Routes>
      </main>
    </div>
  );
}
