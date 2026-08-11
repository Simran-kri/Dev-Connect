import { Code2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../state/AuthContext.jsx";

export default function AuthScreen() {
  const { login, register, loading, demoLogin } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "Demo Developer",
    email: "demo@devconnect.local",
    password: "password123",
    college: "Your College",
    skills: "React, Node, MongoDB"
  });

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = {
        ...form,
        skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
      };
      if (mode === "login") await login(payload);
      else await register(payload);
    } catch (err) {
      setError(err.response?.data?.message || "Backend is not connected yet. You can still review the UI.");
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-panel">
        <div className="brand large">
          <div className="brand-mark"><Code2 size={26} /></div>
          <div>
            <strong>DevConnect</strong>
            <span>Developer network</span>
          </div>
        </div>
        <h1>Share real progress. Showcase real projects. Prep for placements together.</h1>
        <div className="feature-grid">
          <span>JWT auth</span>
          <span>Profiles</span>
          <span>Posts</span>
          <span>Projects</span>
          <span>Follow</span>
          <span>Live chat</span>
        </div>
      </section>
      <form className="auth-card" onSubmit={submit}>
        <h2 className="auth-card-title">{mode === "login" ? "Welcome back" : "Join DevConnect"}</h2>
        <div className="tabs">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Register</button>
        </div>
        {mode === "register" && (
          <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        )}
        <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
        {mode === "register" && (
          <>
            <label>College<input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} /></label>
            <label>Skills<input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></label>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <button className="primary pill full" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
        <button className="secondary pill full" type="button" onClick={demoLogin}>Explore demo</button>
      </form>
    </div>
  );
}
