import { Code2, Link2, MessageSquare, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import Avatar from "../components/Avatar.jsx";

// Accepts a full invite link, a "?join=" URL, or just the code itself.
function extractInviteCode(value) {
  const trimmed = value.trim();
  const match = trimmed.match(/join=([a-f0-9]+)/i);
  if (match) return match[1];
  return trimmed.split("/").filter(Boolean).pop() || "";
}


export default function Groups() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [joinInput, setJoinInput] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [people, setPeople] = useState([]);
  const [pickedUser, setPickedUser] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  function loadGroups() {
    setLoading(true);
    return api.get("/groups")
      .then(({ data }) => setGroups(data.groups))
      .catch(() => setError("Couldn't load your groups."))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadGroups();
    // Opening an invite link (/groups?join=CODE) joins that group automatically.
    const code = searchParams.get("join");
    if (code) {
      joinWithCode(code).finally(() => setSearchParams({}, { replace: true }));
    }
  }, []);

  const isOwner = (group) => String(group.owner?._id || group.owner) === String(user?._id);

  async function joinWithCode(code) {
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/groups/join/${code}`);
      setNotice(`You joined "${data.group.name}".`);
      await loadGroups();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't join with that link.");
    }
  }

  async function handleJoinSubmit(event) {
    event.preventDefault();
    const code = extractInviteCode(joinInput);
    if (!code) {
      setError("Paste an invite link first.");
      return;
    }
    setJoinInput("");
    await joinWithCode(code);
  }

  async function createGroup(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!name.trim()) return;
    try {
      const { data } = await api.post("/groups", { name, description: "New coding group" });
      setGroups((current) => [data.group, ...current]);
      setName("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the group.");
    }
  }

  async function copyInvite(group, reset = false) {
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/groups/${group._id}/invite-link`, { reset });
      const link = `${window.location.origin}/groups?join=${data.inviteCode}`;
      await navigator.clipboard.writeText(link);
      setNotice(
        reset
          ? "New invite link copied. The old link no longer works."
          : "Invite link copied. Anyone with it can join this group."
      );
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create an invite link.");
    }
  }

  function toggleManage(group) {
    if (expandedId === group._id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(group._id);
    setPickedUser("");
    if (people.length === 0) {
      api.get("/users", { params: { limit: 100 } })
        .then(({ data }) => setPeople(data.users))
        .catch(() => {});
    }
  }

  async function addMember(group) {
    if (!pickedUser) return;
    setBusyId(group._id);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(`/groups/${group._id}/members`, { userId: pickedUser });
      setGroups((current) => current.map((g) => (g._id === group._id ? data.group : g)));
      setPickedUser("");
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't add that person.");
    } finally {
      setBusyId(null);
    }
  }

  async function removeMember(group, memberId) {
    if (!window.confirm("Remove this person from the group?")) return;
    setBusyId(group._id);
    setError("");
    try {
      await api.delete(`/groups/${group._id}/members/${memberId}`);
      setGroups((current) =>
        current.map((g) =>
          g._id === group._id
            ? { ...g, members: g.members.filter((m) => String(m._id) !== String(memberId)) }
            : g
        )
      );
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't remove that person.");
    } finally {
      setBusyId(null);
    }
  }

  async function leaveGroup(group) {
    if (!window.confirm(`Leave "${group.name}"?`)) return;
    setError("");
    setNotice("");
    try {
      await api.post(`/groups/${group._id}/leave`);
      setGroups((current) => current.filter((g) => g._id !== group._id));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't leave the group.");
    }
  }

  async function deleteGroup(group) {
    if (!window.confirm("Delete this group for everyone? This can't be undone.")) return;
    setError("");
    setNotice("");
    try {
      await api.delete(`/groups/${group._id}`);
      setGroups((current) => current.filter((g) => g._id !== group._id));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't delete the group.");
    }
  }

  return (
    <section className="panel">
      <form className="searchbar" onSubmit={createGroup}>
        <Code2 size={18} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Create a private group..." />
        <button className="primary">Create</button>
      </form>

      <form className="searchbar" onSubmit={handleJoinSubmit}>
        <Link2 size={18} />
        <input value={joinInput} onChange={(e) => setJoinInput(e.target.value)} placeholder="Paste an invite link to join a group" />
        <button className="secondary pill">Join</button>
      </form>

      {notice && <p className="success">{notice}</p>}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="empty-state">Loading your groups...</p>
      ) : groups.length === 0 ? (
        <div className="empty-state">
          <Users size={20} />
          <strong>No groups yet</strong>
          <span>Create one, or join with an invite link from a friend.</span>
        </div>
      ) : (
        <div className="project-grid">
          {groups.map((group) => {
            const members = group.members || [];
            const owner = isOwner(group);
            const available = people.filter((p) => !members.some((m) => String(m._id) === String(p._id)));

            return (
              <article className="card" key={group._id}>
                <h3>{group.name}</h3>
                <p>{group.description}</p>
                <small>
                  {members.length} members{owner ? " · you own this group" : ""}
                </small>

                <div className="group-card-actions">
                  <Link className="primary pill" to={`/groups/${group._id}`}>
                    <MessageSquare size={15} /> Open chat
                  </Link>
                  <button className="secondary pill" onClick={() => copyInvite(group)}>
                    <Link2 size={15} /> Invite link
                  </button>
                  <button className="secondary pill" onClick={() => toggleManage(group)}>
                    <Users size={15} /> Members
                  </button>
                  {owner ? (
                    <button className="secondary pill danger-action" onClick={() => deleteGroup(group)}>
                      <Trash2 size={15} /> Delete
                    </button>
                  ) : (
                    <button className="secondary pill" onClick={() => leaveGroup(group)}>
                      <UserMinus size={15} /> Leave
                    </button>
                  )}
                </div>

                {expandedId === group._id && (
                  <div className="group-member-list">
                    {members.map((m) => {
                      const isGroupOwner = String(m._id) === String(group.owner?._id || group.owner);
                      return (
                        <div className="person compact" key={m._id}>
                          <Avatar name={m.name} image={m.avatar} size="small" />
                          <div>
                            <strong>{m.name}</strong>
                            {isGroupOwner && <small>Owner</small>}
                          </div>
                          {owner && !isGroupOwner && (
                            <button
                              className="icon-button"
                              onClick={() => removeMember(group, m._id)}
                              disabled={busyId === group._id}
                              aria-label={`Remove ${m.name}`}
                            >
                              <UserMinus size={14} />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    <div className="composer-row">
                      <select
                        className="tags-input"
                        value={pickedUser}
                        onChange={(e) => setPickedUser(e.target.value)}
                      >
                        <option value="">Add a person...</option>
                        {available.map((p) => (
                          <option key={p._id} value={p._id}>{p.name}</option>
                        ))}
                      </select>
                      <button
                        className="primary pill"
                        onClick={() => addMember(group)}
                        disabled={!pickedUser || busyId === group._id}
                      >
                        <UserPlus size={15} /> Add
                      </button>
                    </div>

                    {owner && (
                      <button className="secondary pill" onClick={() => copyInvite(group, true)}>
                        Reset invite link
                      </button>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
