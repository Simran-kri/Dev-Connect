import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { initials, isValidUrl, splitList, uploadImage } from "../lib/helpers.js";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    title: user?.title || "",
    college: user?.college || "",
    bio: user?.bio || "",
    experience: user?.experience || "",
    skills: user?.skills?.join(", ") || "",
    github: user?.github || "",
    linkedin: user?.linkedin || "",
    portfolio: user?.portfolio || ""
  });
  const [avatarFile, setAvatarFile] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }

    if (![form.github, form.linkedin, form.portfolio].every(isValidUrl)) {
      setError("GitHub, LinkedIn and portfolio must be valid URLs.");
      return;
    }

    let avatar = user?.avatar || "";
    try {
      if (avatarFile) {
        setStatus("Uploading profile picture...");
        avatar = await uploadImage(avatarFile);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Image upload failed. Check Cloudinary configuration.");
      return;
    }

    const payload = { ...form, avatar, skills: splitList(form.skills) };
    const next = { ...user, ...payload };
    updateUser(next);
    setStatus("Profile saved.");
    api.put("/users/profile/me", payload).then(({ data }) => updateUser(data.user)).catch((err) => {
      setError(err.response?.data?.message || "Could not save profile to backend.");
    });
  }

  return (
    <section className="panel profile-editor">
      <div className="profile-head">
        {user?.avatar ? <img className="avatar big image-avatar" src={user.avatar} alt={form.name} /> : <span className="avatar big">{initials(form.name)}</span>}
        <div>
          <h2>{form.name}</h2>
          <p>{form.title || "Developer"} · {form.college}</p>
        </div>
      </div>
      <form className="form-grid" onSubmit={save}>
        {Object.entries(form).map(([key, value]) => (
          key === "bio" || key === "experience" ? (
            <label key={key}>{key}<textarea value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
          ) : (
            <label key={key}>{key}<input value={value} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>
          )
        ))}
        <label>Profile picture<input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] || null)} /></label>
        {error && <p className="error form-wide">{error}</p>}
        {status && <p className="success form-wide">{status}</p>}
        <button className="primary">Save profile</button>
      </form>
    </section>
  );
}
