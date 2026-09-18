import { useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { isValidUrl, splitList, uploadImage } from "../lib/helpers.js";
import Avatar from "../components/Avatar.jsx";
import EditableField from "../components/EditableField.jsx";

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState("");

  // Every field save is independent - it PATCHes just that one field and
  // updates the shared user object, rather than one big form with one big
  // save button for everything.
  async function saveField(field, rawValue) {
    let value = rawValue;

    if (field === "name" && !rawValue.trim()) {
      throw new Error("Name can't be empty.");
    }
    if (["github", "linkedin", "portfolio"].includes(field) && !isValidUrl(rawValue)) {
      throw new Error("Enter a valid URL.");
    }
    if (field === "skills") {
      value = splitList(rawValue);
    }

    try {
      const { data } = await api.put("/users/profile/me", { [field]: value });
      updateUser(data.user);
    } catch (err) {
      throw new Error(err.response?.data?.message || "Couldn't save. Try again.");
    }
  }

  function pickAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarError("");
  }

  async function saveAvatar() {
    if (!avatarFile) return;
    setUploadingAvatar(true);
    setAvatarError("");
    try {
      const avatar = await uploadImage(avatarFile);
      const { data } = await api.put("/users/profile/me", { avatar });
      updateUser(data.user);
      setAvatarFile(null);
      setAvatarPreview("");
    } catch (err) {
      setAvatarError(err.response?.data?.message || "Image upload failed. Check Cloudinary configuration.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <section className="panel profile-editor">
      <div className="profile-head">
        <Avatar name={user?.name} image={avatarPreview || user?.avatar} size="big" />
        <div>
          <h2>{user?.name}</h2>
          <p>{user?.title || "Developer"} · {user?.college}</p>
        </div>
      </div>

      <div className="avatar-editor">
        <label className="secondary pill avatar-pick-button">
          Choose photo
          <input type="file" accept="image/*" onChange={pickAvatar} hidden />
        </label>
        {avatarFile && (
          <button className="primary pill" onClick={saveAvatar} disabled={uploadingAvatar}>
            {uploadingAvatar ? "Uploading..." : "Save photo"}
          </button>
        )}
        {avatarError && <p className="error">{avatarError}</p>}
      </div>

      <div className="editable-field-list">
        <EditableField label="Name" value={user?.name} onSave={(v) => saveField("name", v)} />
        <EditableField label="Title" value={user?.title} onSave={(v) => saveField("title", v)} placeholder="e.g. Full Stack Developer" />
        <EditableField label="College" value={user?.college} onSave={(v) => saveField("college", v)} />
        <EditableField label="Bio" value={user?.bio} onSave={(v) => saveField("bio", v)} type="textarea" />
        <EditableField label="Experience" value={user?.experience} onSave={(v) => saveField("experience", v)} type="textarea" />
        <EditableField label="Skills" value={user?.skills?.join(", ")} onSave={(v) => saveField("skills", v)} placeholder="React, Node, MongoDB" />
        <EditableField label="GitHub" value={user?.github} onSave={(v) => saveField("github", v)} placeholder="https://github.com/you" />
        <EditableField label="LinkedIn" value={user?.linkedin} onSave={(v) => saveField("linkedin", v)} placeholder="https://linkedin.com/in/you" />
        <EditableField label="Portfolio" value={user?.portfolio} onSave={(v) => saveField("portfolio", v)} placeholder="https://you.dev" />
      </div>
    </section>
  );
}
