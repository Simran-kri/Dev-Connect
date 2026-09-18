import { Mail } from "lucide-react";
import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";

export default function VerifyBanner() {
  const { user, updateUser } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (!user || user._id === "demo-user" || user.isVerified) return null;

  async function sendCode() {
    setSending(true);
    setError("");
    setMessage("");
    try {
      await api.post("/auth/send-otp");
      setSent(true);
      setMessage("Code sent - check your email (or your server's console log, if email isn't configured yet).");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't send a code right now.");
    } finally {
      setSending(false);
    }
  }

  async function verifyCode(event) {
    event.preventDefault();
    if (!otp.trim()) return;
    setVerifying(true);
    setError("");
    try {
      const { data } = await api.post("/auth/verify-otp", { otp });
      updateUser(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "That code didn't work.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="verify-banner">
      <Mail size={16} />
      <div className="verify-banner-text">
        <strong>Verify your email</strong>
        <span>Confirm your address to unlock the full account.</span>
      </div>
      {!expanded ? (
        <button className="secondary pill" onClick={() => { setExpanded(true); sendCode(); }}>
          Verify now
        </button>
      ) : (
        <form className="verify-banner-form" onSubmit={verifyCode}>
          <input
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            placeholder="6-digit code"
            maxLength={6}
          />
          <button className="primary pill" disabled={verifying}>{verifying ? "Checking..." : "Verify"}</button>
          <button type="button" className="secondary pill" onClick={sendCode} disabled={sending}>
            {sending ? "Sending..." : sent ? "Resend" : "Send code"}
          </button>
        </form>
      )}
      {message && <span className="verify-banner-note">{message}</span>}
      {error && <span className="verify-banner-note error">{error}</span>}
    </div>
  );
}
