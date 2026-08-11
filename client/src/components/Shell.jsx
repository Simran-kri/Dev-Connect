import { Code2, FolderGit2, LogOut, MessageCircle, ShieldCheck, UserRound, UsersRound, Compass } from "lucide-react";
import { useEffect } from "react";
import { NavLink, Route, Routes } from "react-router-dom";
import { io } from "socket.io-client";
import { API_URL } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "./Avatar.jsx";
import Feed from "../pages/Feed.jsx";
import Projects from "../pages/Projects.jsx";
import ProjectDetail from "../pages/ProjectDetail.jsx";
import Network from "../pages/Network.jsx";
import UserDetail from "../pages/UserDetail.jsx";
import Chat from "../pages/Chat.jsx";
import Groups from "../pages/Groups.jsx";
import Profile from "../pages/Profile.jsx";
import Admin from "../pages/Admin.jsx";

export default function Shell() {
  const { user, logout } = useAuth();
  const links = [
    ["Feed", "/", Compass],
    ["Projects", "/projects", FolderGit2],
    ["Network", "/network", UsersRound],
    ["Chat", "/chat", MessageCircle],
    ["Groups", "/groups", Code2],
    ["Profile", "/profile", UserRound],
    ["Admin", "/admin", ShieldCheck]
  ];

  useEffect(() => {
    if (!user?._id || user._id === "demo-user") return;
    const socket = io(API_URL, { auth: { token: localStorage.getItem("devconnect_token") } });
    return () => socket.disconnect();
  }, [user?._id]);

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
            <Avatar name={user?.name} image={user?.avatar} />
            <div>
              <strong>{user?.name}</strong>
              <small>{user?.title || "Developer"}</small>
            </div>
          </div>
        </header>
        <Routes>
          <Route path="/" element={<Feed />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/network" element={<Network />} />
          <Route path="/users/:id" element={<UserDetail />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </main>
    </div>
  );
}
