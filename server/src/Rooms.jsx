import { Check, Lock, Plus, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import Avatar from "../components/Avatar.jsx";
import Pagination from "../components/Pagination.jsx";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [people, setPeople] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  function loadRooms() {
    setLoading(true);
    api.get("/rooms", { params: { page } })
      .then(({ data }) => {
        setRooms(data.rooms);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(loadRooms, [page]);

  useEffect(() => {
    if (isPrivate && people.length === 0) {
      api.get("/users").then(({ data }) => setPeople(data.users)).catch(() => {});
    }
  }, [isPrivate]);

  function toggleSelected(personId) {
    setSelectedIds((current) =>
      current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]
    );
  }

  async function createRoom(event) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Give the room a name.");
      return;
    }
    if (isPrivate && selectedIds.length === 0) {
      setError("Pick at least one person who's allowed in, or turn off Private.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/rooms", {
        name,
        description,
        isPrivate,
        allowedUserIds: isPrivate ? selectedIds : []
      });
      setName("");
      setDescription("");
      setIsPrivate(false);
      setSelectedIds([]);
      setPage(1);
      loadRooms();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't create the room.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Start a room</h2>
        <form className="stack" onSubmit={createRoom}>
          <input placeholder="Room name, e.g. 'Mock Interview Practice'" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea placeholder="What's this room about? (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />

          <label className="room-private-toggle">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            <Lock size={14} /> Private room - only people I pick can enter
          </label>

          {isPrivate && (
            <div className="group-member-list">
              {people.map((person) => {
                const selected = selectedIds.includes(person._id);
                return (
                  <button
                    type="button"
                    key={person._id}
                    className={selected ? "person compact group-pick selected" : "person compact group-pick"}
                    onClick={() => toggleSelected(person._id)}
                  >
                    <Avatar name={person.name} image={person.avatar} size="small" />
                    <div><strong>{person.name}</strong></div>
                    {selected && <Check size={15} className="group-pick-check" />}
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="error">{error}</p>}
          <button className="primary pill" disabled={creating}>{creating ? "Starting..." : "Start room"}</button>
        </form>
      </section>
      <section className="panel span-2">
        <h2>Live rooms</h2>
        <div className="project-grid">
          {rooms.map((room) => (
            <Link className="card room-card" to={`/rooms/${room._id}`} key={room._id}>
              <div className="room-card-head">
                {room.isPrivate ? <Lock size={16} /> : <Radio size={16} className="room-live-icon" />}
                <span>{room.isPrivate ? "Private" : "Live"}</span>
              </div>
              <h3>{room.name}</h3>
              {room.description && <p>{room.description}</p>}
              <div className="person compact">
                <Avatar name={room.host?.name} image={room.host?.avatar} size="small" />
                <small>Hosted by {room.host?.name}</small>
              </div>
            </Link>
          ))}
          {!loading && rooms.length === 0 && (
            <div className="empty-state">
              <Plus size={20} />
              <strong>No rooms yet</strong>
              <span>Start one on the left - anyone online can join and talk in real time.</span>
            </div>
          )}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />
      </section>
    </div>
  );
}
