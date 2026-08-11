import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("devconnect_user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("devconnect_token");
    if (!token) return;

    api.get("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        localStorage.setItem("devconnect_user", JSON.stringify(data.user));
      })
      .catch(() => logout());
  }, []);

  async function login(payload) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", payload);
      localStorage.setItem("devconnect_token", data.token);
      localStorage.setItem("devconnect_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  async function register(payload) {
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", payload);
      localStorage.setItem("devconnect_token", data.token);
      localStorage.setItem("devconnect_user", JSON.stringify(data.user));
      setUser(data.user);
      return data.user;
    } finally {
      setLoading(false);
    }
  }

  function updateUser(nextUser) {
    setUser(nextUser);
    localStorage.setItem("devconnect_user", JSON.stringify(nextUser));
  }

  function demoLogin() {
    const demoUser = {
      _id: "demo-user",
      name: "Demo Developer",
      title: "Full Stack Developer",
      college: "Your College",
      bio: "Building placement-ready MERN projects.",
      skills: ["React", "Node", "MongoDB", "Socket.io"],
      role: "admin"
    };
    localStorage.setItem("devconnect_token", "demo-token");
    localStorage.setItem("devconnect_user", JSON.stringify(demoUser));
    setUser(demoUser);
  }

  function logout() {
    localStorage.removeItem("devconnect_token");
    localStorage.removeItem("devconnect_user");
    setUser(null);
  }

  const value = useMemo(
    () => ({ user, loading, login, register, logout, updateUser, demoLogin }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
