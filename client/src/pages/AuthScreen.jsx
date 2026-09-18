import { Code2 } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function AuthScreen() {
  const { login, register, loading, demoLogin } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("demo@devconnect.local");
  const [form, setForm] = useState({
    name: "Demo Developer",
    email: "demo@devconnect.local",
    phone: "",
    password: "password123",
    college: "Your College",
    skills: "React, Node, MongoDB"
  });

  const [resetEmail, setResetEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStep, setResetStep] = useState("request");
  const [resetMessage, setResetMessage] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");

    if (mode === "register" && !form.email.trim() && !form.phone.trim()) {
      setError("Provide an email or a phone number.");
      return;
    }

    try {
      if (mode === "login") {
        await login({ identifier, password: form.password });
      } else {
        await register({
          ...form,
          skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Backend is not connected yet. You can still review the UI.");
    }
  }

  async function requestReset(event) {
    event.preventDefault();
    setError("");
    setResetSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: resetEmail });
      setResetMessage(data.message + " (Check your email, or your server's console log if email isn't configured yet.)");
      setResetStep("confirm");
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setResetSubmitting(false);
    }
  }

  async function confirmReset(event) {
    event.preventDefault();
    setError("");
    setResetSubmitting(true);
    try {
      await api.post("/auth/reset-password", {
        email: resetEmail,
        otp: resetOtp,
        newPassword: resetPassword
      });
      setMode("login");
      setResetStep("request");
      setResetOtp("");
      setResetPassword("");
      setIdentifier(resetEmail);
      setForm((current) => ({ ...current, password: "" }));
      setResetMessage("");
      setError("");
    } catch (err) {
      setError(err.response?.data?.message || "That code didn't work. Try again.");
    } finally {
      setResetSubmitting(false);
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

      {mode === "forgot" ? (
        <form className="auth-card" onSubmit={resetStep === "request" ? requestReset : confirmReset}>
          <h2 className="auth-card-title">Reset your password</h2>
          {resetStep === "request" ? (
            <label>Email<input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@example.com" /></label>
          ) : (
            <>
              {resetMessage && <p className="success">{resetMessage}</p>}
              <label>Code from email<input value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} maxLength={6} placeholder="6-digit code" /></label>
              <label>New password<input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} /></label>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary pill full" disabled={resetSubmitting}>
            {resetSubmitting ? "Please wait..." : resetStep === "request" ? "Send reset code" : "Reset password"}
          </button>
          <button className="secondary pill full" type="button" onClick={() => { setMode("login"); setResetStep("request"); setError(""); }}>
            Back to login
          </button>
          <p className="auth-note">Password reset currently needs an email on the account - phone-only accounts can't use this yet.</p>
        </form>
      ) : (
        <form className="auth-card" onSubmit={submit}>
          <h2 className="auth-card-title">{mode === "login" ? "Welcome back" : "Join DevConnect"}</h2>
          <div className="tabs">
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Login</button>
            <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Register</button>
          </div>
          {mode === "register" && (
            <label>Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          )}

          {mode === "login" ? (
            <label>Email or phone number<input value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></label>
          ) : (
            <>
              <label>Email <span className="auth-optional">(or provide a phone number below)</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </label>
              <label>Phone number <span className="auth-optional">(optional if email is given)</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              </label>
            </>
          )}

          <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></label>
          {mode === "register" && (
            <>
              <label>College<input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} /></label>
              <label>Skills<input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} /></label>
            </>
          )}
          {mode === "login" && (
            <button type="button" className="link-button" onClick={() => { setMode("forgot"); setResetEmail(form.email); setError(""); }}>
              Forgot password?
            </button>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary pill full" disabled={loading}>{loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}</button>
          <button className="secondary pill full" type="button" onClick={demoLogin}>Explore demo</button>
        </form>
      )}
    </div>
  );
}
