import { TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";

const CHART_COLORS = { users: "#2563eb", posts: "#17803d", projects: "#b8590a" };

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function Admin() {
  const [stats, setStats] = useState({ users: 3, posts: 2, projects: 2, groups: 2, reportedPosts: 0 });
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    api.get("/admin/stats").then(({ data }) => setStats(data)).catch(() => {});
    api.get("/admin/analytics").then(({ data }) => setAnalytics(data)).catch(() => {});
  }, []);

  return (
    <div className="admin-dashboard">
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

      {analytics && (
        <>
          <section className="panel">
            <h2><TrendingUp size={16} /> Growth, last 14 days</h2>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={analytics.growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                  <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} stroke="var(--faint)" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="var(--faint)" />
                  <Tooltip labelFormatter={formatDate} />
                  <Legend />
                  <Line type="monotone" dataKey="users" name="New users" stroke={CHART_COLORS.users} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="posts" name="Posts" stroke={CHART_COLORS.posts} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="projects" name="Projects" stroke={CHART_COLORS.projects} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="content-grid">
            <section className="panel span-2">
              <h2>Most-used tags</h2>
              {analytics.topTags.length > 0 ? (
                <div className="chart-wrap">
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={analytics.topTags}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
                      <XAxis dataKey="tag" fontSize={12} stroke="var(--faint)" />
                      <YAxis allowDecimals={false} fontSize={12} stroke="var(--faint)" />
                      <Tooltip />
                      <Bar dataKey="count" name="Posts" fill={CHART_COLORS.users} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="empty-state">No tagged posts yet.</p>
              )}
            </section>

            <section className="panel">
              <h2>Most active developers</h2>
              <div className="active-authors">
                {analytics.topAuthors.map((author, index) => (
                  <div className="active-author-row" key={author.name + index}>
                    <span className="active-author-rank">{index + 1}</span>
                    <Avatar name={author.name} image={author.avatar} size="small" />
                    <strong>{author.name}</strong>
                    <span className="active-author-count">{author.count} posts</span>
                  </div>
                ))}
                {analytics.topAuthors.length === 0 && <p className="empty-state">No posts yet.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
