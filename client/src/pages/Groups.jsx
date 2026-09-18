import { Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { demoGroups } from "../data/demo.js";

export default function Groups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState(demoGroups);
  const [name, setName] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/groups").then(({ data }) => setGroups(data.groups)).catch(() => {});
  }, []);

  async function createGroup(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) return;

    const optimistic = { _id: crypto.randomUUID(), name, description: "New coding group", members: [], posts: [] };
    setGroups([optimistic, ...groups]);
    setName("");

    try {
      const { data } = await api.post("/groups", { name, description: "New coding group" });
      setGroups((current) => current.map((item) => item._id === optimistic._id ? data.group : item));
    } catch (err) {
      // Roll back the placeholder since it was never actually saved.
      setGroups((current) => current.filter((item) => item._id !== optimistic._id));
      setError(err.response?.data?.message || "Couldn't create the group. Try again.");
    }
  }

  function isMember(group) {
    return user?._id && group.members?.some((member) => String(member._id || member) === String(user._id));
  }

  async function toggleMembership(group) {
    if (pendingId || user?._id === "demo-user") return;
    setError("");
    setPendingId(group._id);

    const wasMember = isMember(group);
    try {
      const { data } = await api.post(`/groups/${group._id}/${wasMember ? "leave" : "join"}`);
      setGroups((current) => current.map((item) => item._id === group._id ? data.group : item));
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update group membership. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="panel">
      <form className="searchbar" onSubmit={createGroup}>
        <Code2 size={18} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Create group: Leetcode Daily, MERN Developers..." />
        <button className="primary">Create</button>
      </form>
      {error && <p className="error">{error}</p>}
      <div className="project-grid">
        {groups.map((group) => {
          const member = isMember(group);
          return (
            <article className="card" key={group._id}>
              <h3>{group.name}</h3>
              <p>{group.description}</p>
              <small>{group.members?.length || 0} members</small>
              <button
                className={member ? "secondary pill following" : "secondary pill"}
                onClick={() => toggleMembership(group)}
                disabled={pendingId === group._id}
              >
                {member ? "Joined" : "Join group"}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
