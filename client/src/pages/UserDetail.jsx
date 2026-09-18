import { MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import { useAuth } from "../state/AuthContext.jsx";
import { demoProjects, demoUsers } from "../data/demo.js";
import Avatar from "../components/Avatar.jsx";

export default function UserDetail() {
  const { id } = useParams();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [person, setPerson] = useState(demoUsers.find((item) => item._id === id) || demoUsers[0]);
  const [projects, setProjects] = useState(demoProjects);
  const [messaging, setMessaging] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [error, setError] = useState("");

  const isMe = user?._id && String(user._id) === String(id);
  const isFollowing = (user?.following || []).map(String).includes(String(id));

  useEffect(() => {
    api.get(`/users/${id}`).then(({ data }) => setPerson(data.user)).catch(() => {});
    api.get(`/projects?owner=${id}`).then(({ data }) => setProjects(data.projects)).catch(() => {});
  }, [id]);

  async function startMessage() {
    if (messaging || user?._id === "demo-user") return;
    setMessaging(true);
    setError("");
    try {
      const { data } = await api.post(`/chat/${id}`);
      navigate("/chat", { state: { conversationId: data.conversation._id } });
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't start a conversation.");
    } finally {
      setMessaging(false);
    }
  }

  async function toggleFollow() {
    if (followPending || user?._id === "demo-user") return;
    setFollowPending(true);
    setError("");
    try {
      const { data } = await api.post(`/users/${id}/follow`);
      updateUser(data.user);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't update follow status.");
    } finally {
      setFollowPending(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="profile-head">
          <Avatar name={person?.name} image={person?.avatar} size="big" />
          <div>
            <h2>{person?.name}</h2>
            <p>{person?.title || "Developer"}</p>
            <small>{person?.college}</small>
          </div>
        </div>
        <p>{person?.bio || "Developer profile is ready for projects, skills and collaboration requests."}</p>
        <div className="tags">{person?.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div>

        {!isMe && (
          <div className="profile-primary-actions">
            <button className="primary pill" onClick={startMessage} disabled={messaging}>
              <MessageCircle size={15} /> {messaging ? "Starting..." : "Message"}
            </button>
            <button
              className={isFollowing ? "secondary pill following" : "secondary pill"}
              onClick={toggleFollow}
              disabled={followPending}
            >
              {isFollowing ? "Following" : "Follow"}
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}

        <div className="actions">
          {person?.github && <a href={person.github} target="_blank">GitHub</a>}
          {person?.linkedin && <a href={person.linkedin} target="_blank">LinkedIn</a>}
          {person?.portfolio && <a href={person.portfolio} target="_blank">Portfolio</a>}
        </div>
      </section>
      <section className="panel span-2">
        <h2>Projects by {person?.name}</h2>
        <div className="project-grid">
          {projects.map((project) => (
            <article className="card project-card" key={project._id}>
              {project.images?.[0] && <img className="project-image" src={project.images[0]} alt={`${project.title} screenshot`} />}
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="tags">{project.techStack?.map((tech) => <span key={tech}>{tech}</span>)}</div>
              <div className="actions"><Link to={`/projects/${project._id}`}>Details</Link></div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
