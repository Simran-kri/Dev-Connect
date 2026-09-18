import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function EditableField({ label, value, onSave, type = "text", placeholder = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      await onSave(draft);
      setEditing(false);
    } catch (err) {
      setError(err.message || "Couldn't save this field.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraft(value || "");
    setEditing(false);
    setError("");
  }

  return (
    <div className="editable-field">
      <span className="editable-field-label">{label}</span>
      {editing ? (
        <div className="editable-field-edit-row">
          {type === "textarea" ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} autoFocus />
          ) : (
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={placeholder} autoFocus />
          )}
          <div className="editable-field-actions">
            <button type="button" className="icon-button save" onClick={handleSave} disabled={saving} aria-label={`Save ${label}`}>
              <Check size={14} />
            </button>
            <button type="button" className="icon-button" onClick={handleCancel} disabled={saving} aria-label="Cancel">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <div className="editable-field-view-row">
          <span className="editable-field-value">{value || <em>Not set</em>}</span>
          <button type="button" className="icon-button" onClick={() => setEditing(true)} aria-label={`Edit ${label}`}>
            <Pencil size={14} />
          </button>
        </div>
      )}
      {error && <p className="error editable-field-error">{error}</p>}
    </div>
  );
}
