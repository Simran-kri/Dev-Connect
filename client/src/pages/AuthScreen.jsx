import { Code2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

// Password field with a show/hide button.
function PasswordInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        className="icon-button"
        onClick={() => setShow((current) => !current)}
        aria-label={show ? "Hide password" : "Show password"}
        style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", margin: 0 }}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}


export default function AuthScreen() {
  const { login, register, loading, demoLogin } = useAuth();
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    college: "",
    skills: ""
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

    try {
      if (mode === "login") {
        if (!identifier.trim()) {
          setError("Enter your email or phone number.");
          return;
        }
        await login({ identifier: identifier.trim(), password: form.password });
      } else {
        if (!form.email.trim() && !form.phone.trim()) {
          setError("Provide an email or a phone number.");
          return;
        }
        await register({
          name: form.name,
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          college: form.college,
          skills: form.skills.split(",").map((skill) => skill.trim()).filter(Boolean)
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong. Please try again.");
    }
  }

  function openForgotPassword() {
    // Use whatever the user already typed, so the code goes to their own address.
    const typed = identifier.trim();
    setResetEmail(typed.includes("@") ? typed : "");
    setResetStep("request");
    setResetMessage("");
    setError("");
    setMode("forgot");
  }

  async function requestReset(event) {
    event.preventDefault();
    setError("");
    if (!resetEmail.trim()) {
      setError("Enter the email address on your account.");
      return;
    }
    setResetSubmitting(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email: resetEmail.trim() });
      setResetMessage(
        `${data.message} Check your inbox and spam folder. If you haven't set up email on the server, the code appears in the server terminal.`
      );
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
        email: resetEmail.trim(),
        otp: resetOtp.trim(),
        newPassword: resetPassword
      });
      setMode("login");
      setResetStep("request");
      setResetOtp("");
      setResetPassword("");
      setIdentifier(resetEmail.trim());
      setForm((current) => ({ ...current, password: "" }));
      setResetMessage("");
      setError("Password updated. Log in with your new password.");
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
            <label>
              Email on your account
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </label>
          ) : (
            <>
              {resetMessage && <p className="success">{resetMessage}</p>}
              <label>
                6-digit code
                <input value={resetOtp} onChange={(e) => setResetOtp(e.target.value)} maxLength={6} placeholder="123456" />
              </label>
              <label>
                New password
                <PasswordInput value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="At least 6 characters" />
              </label>
            </>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary pill full" disabled={resetSubmitting}>
            {resetSubmitting ? "Please wait..." : resetStep === "request" ? "Send reset code" : "Reset password"}
          </button>
          {resetStep === "confirm" && (
            <button
              className="secondary pill full"
              type="button"
              onClick={() => { setResetStep("request"); setResetMessage(""); setError(""); }}
            >
              Resend or change email
            </button>
          )}
          <button
            className="secondary pill full"
            type="button"
            onClick={() => { setMode("login"); setResetStep("request"); setError(""); }}
          >
            Back to login
          </button>
          <p className="auth-note">Password reset needs an email on the account. Phone-only accounts can't use it yet.</p>
        </form>
      ) : (
        <form className="auth-card" onSubmit={submit}>
          <h2 className="auth-card-title">{mode === "login" ? "Welcome back" : "Join DevConnect"}</h2>
          <div className="tabs">
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>Login</button>
            <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>Register</button>
          </div>

          {mode === "register" && (
            <label>
              Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </label>
          )}

          {mode === "login" ? (
            <label>
              Email or phone number
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@example.com or phone" />
            </label>
          ) : (
            <>
              <label>
                Email <span className="auth-optional">(or a phone number below)</span>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" />
              </label>
              <label>
                Phone number <span className="auth-optional">(optional if email is given)</span>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
              </label>
            </>
          )}

          <label>
            Password
            <PasswordInput value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder={mode === "register" ? "At least 6 characters" : ""} />
          </label>

          {mode === "register" && (
            <>
              <label>
                College
                <input value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
              </label>
              <label>
                Skills
                <input value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} placeholder="React, Node, MongoDB" />
              </label>
            </>
          )}

          {mode === "login" && (
            <button type="button" className="link-button" onClick={openForgotPassword}>
              Forgot password?
            </button>
          )}

          {error && <p className="error">{error}</p>}
          <button className="primary pill full" disabled={loading}>
            {loading ? "Please wait..." : mode === "login" ? "Login" : "Create account"}
          </button>
          <button className="secondary pill full" type="button" onClick={demoLogin}>Explore demo</button>
        </form>
      )}
    </div>
  );
}
