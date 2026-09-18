import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { demoUsers } from "../data/demo.js";
import Avatar from "../components/Avatar.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Network() {
  const { user, updateUser } = useAuth();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState(demoUsers);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [followingIds, setFollowingIds] = useState([]);
  const [pendingId, setPendingId] = useState(null);
  const [followError, setFollowError] = useState("");

  useEffect(() => {
    setFollowingIds((user?.following || []).map(String));
  }, [user?.following]);

  useEffect(() => {
    if (searched) return; // don't clobber active search results with the browse list
    setLoading(true);
    api.get("/users", { params: { page } })
      .then(({ data }) => {
        setUsers(data.users);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, searched]);

  async function search(event) {
    event.preventDefault();
    if (!query.trim()) {
      setSearched(false);
      setPage(1);
      return;
    }
    const { data } = await api.get(`/search?q=${encodeURIComponent(query)}`).catch(() => ({ data: { users: demoUsers } }));
    setUsers(data.users);
    setSearched(true);
  }

  async function toggleFollow(personId) {
    if (pendingId || user?._id === "demo-user") return;
    setFollowError("");
    setPendingId(personId);

    const isFollowing = followingIds.includes(personId);
    // Optimistic update, rolled back on failure.
    setFollowingIds((current) =>
      isFollowing ? current.filter((id) => id !== personId) : [...current, personId]
    );

    try {
      const { data } = await api.post(`/users/${personId}/follow`);
      updateUser(data.user);
    } catch (err) {
      setFollowingIds((current) =>
        isFollowing ? [...current, personId] : current.filter((id) => id !== personId)
      );
      setFollowError(err.response?.data?.message || "Couldn't update follow status. Try again.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <section className="panel">
      <form className="searchbar" onSubmit={search}>
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by React, college, Java, DSA..." />
        <button className="primary">Search</button>
      </form>
      {followError && <p className="error">{followError}</p>}
      <div className="people-grid">
        {users.map((person) => {
          const isFollowing = followingIds.includes(person._id);
          return (
            <article className="card" key={person._id}>
              <div className="person">
                <Avatar name={person.name} image={person.avatar} />
                <div>
                  <strong><Link to={`/users/${person._id}`}>{person.name}</Link></strong>
                  <small>{person.title} · {person.college}</small>
                </div>
              </div>
              <div className="tags">{person.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div>
              <button
                className={isFollowing ? "secondary pill following" : "secondary pill"}
                onClick={() => toggleFollow(person._id)}
                disabled={pendingId === person._id}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </article>
          );
        })}
      </div>
      {!searched && <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />}
    </section>
  );
}
