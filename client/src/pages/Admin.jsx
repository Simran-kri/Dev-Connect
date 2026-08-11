import { useEffect, useState } from "react";
import { api } from "../api.js";

export default function Admin() {
  const [stats, setStats] = useState({ users: 3, posts: 2, projects: 2, groups: 2, reportedPosts: 0 });

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  return (
    <section className="panel">
      <h2>Admin dashboard</h2>
      <div className="stats-grid">
        {Object.entries(stats).map(([key, value]) => (
          <article className="stat" key={key}>
            <strong>{value}</strong>
            <span>{key.replace(/([A-Z])/g, " $1")}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
