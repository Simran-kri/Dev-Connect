import { Code2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api.js";
import { demoGroups } from "../data/demo.js";

export default function Groups() {
  const [groups, setGroups] = useState(demoGroups);
  const [name, setName] = useState("");

  useEffect(() => {
    api.get("/groups").then(({ data }) => setGroups(data.groups)).catch(() => {});
  }, []);

  async function createGroup(event) {
    event.preventDefault();
    if (!name.trim()) return;
    const optimistic = { _id: crypto.randomUUID(), name, description: "New coding group", members: [], posts: [] };
    setGroups([optimistic, ...groups]);
    setName("");
    api.post("/groups", { name, description: "New coding group" }).catch(() => {});
  }

  return (
    <section className="panel">
      <form className="searchbar" onSubmit={createGroup}>
        <Code2 size={18} />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Create group: Leetcode Daily, MERN Developers..." />
        <button className="primary">Create</button>
      </form>
      <div className="project-grid">
        {groups.map((group) => (
          <article className="card" key={group._id}>
            <h3>{group.name}</h3>
            <p>{group.description}</p>
            <small>{group.members?.length || 0} members</small>
            <button className="secondary">Join group</button>
          </article>
        ))}
      </div>
    </section>
  );
}
