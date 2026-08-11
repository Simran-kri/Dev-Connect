import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { demoUsers } from "../data/demo.js";
import Avatar from "../components/Avatar.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Network() {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState(demoUsers);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

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

  return (
    <section className="panel">
      <form className="searchbar" onSubmit={search}>
        <Search size={18} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by React, college, Java, DSA..." />
        <button className="primary">Search</button>
      </form>
      <div className="people-grid">
        {users.map((person) => (
          <article className="card" key={person._id}>
            <div className="person">
              <Avatar name={person.name} image={person.avatar} />
              <div>
                <strong><Link to={`/users/${person._id}`}>{person.name}</Link></strong>
                <small>{person.title} · {person.college}</small>
              </div>
            </div>
            <div className="tags">{person.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div>
            <button className="secondary">Follow</button>
          </article>
        ))}
      </div>
      {!searched && <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />}
    </section>
  );
}
