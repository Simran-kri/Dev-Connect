import { BriefcaseBusiness } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { demoProjects } from "../data/demo.js";
import { isValidUrl, splitList, uploadImage } from "../lib/helpers.js";
import Pagination from "../components/Pagination.jsx";

export default function Projects() {
  const [projects, setProjects] = useState(demoProjects);
  const [form, setForm] = useState({ title: "", description: "", techStack: "React, Node, MongoDB", github: "", liveDemo: "" });
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get("/projects", { params: { page } })
      .then(({ data }) => {
        setProjects(data.projects);
        setTotalPages(data.totalPages || 1);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page]);

  async function createProject(event) {
    event.preventDefault();
    setError("");
    setStatus("");

    if (!form.title.trim() || !form.description.trim()) {
      setError("Project title and description are required.");
      return;
    }

    if (!isValidUrl(form.github) || !isValidUrl(form.liveDemo)) {
      setError("GitHub and live demo must be valid URLs.");
      return;
    }

    let images = [];
    try {
      if (imageFile) {
        setStatus("Uploading image...");
        images = [await uploadImage(imageFile)];
      }
    } catch (err) {
      setError(err.response?.data?.message || "Image upload failed. Check Cloudinary configuration.");
      return;
    }

    const payload = { ...form, techStack: splitList(form.techStack), images };
    const optimistic = { ...payload, _id: crypto.randomUUID(), owner: JSON.parse(localStorage.getItem("devconnect_user") || "{}"), likes: [] };
    setProjects([optimistic, ...projects]);
    setForm({ title: "", description: "", techStack: "React, Node, MongoDB", github: "", liveDemo: "" });
    setImageFile(null);
    setStatus("Project published.");
    api.post("/projects", payload).then(({ data }) => {
      setProjects((items) => [data.project, ...items.filter((item) => item._id !== optimistic._id)]);
    }).catch((err) => setError(err.response?.data?.message || "Could not save project to backend."));
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Add project</h2>
        <form className="stack" onSubmit={createProject}>
          <input placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Tech stack" value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} />
          <input placeholder="GitHub link" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} />
          <input placeholder="Live demo link" value={form.liveDemo} onChange={(e) => setForm({ ...form, liveDemo: e.target.value })} />
          <label>Project screenshot<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /></label>
          {error && <p className="error">{error}</p>}
          {status && <p className="success">{status}</p>}
          <button className="primary">Publish project</button>
        </form>
      </section>
      <section className="panel span-2">
        <h2>Project showcase</h2>
        <div className="project-grid">
          {projects.map((project) => (
            <article className="card project-card" key={project._id}>
              {project.images?.[0] && <img className="project-image" src={project.images[0]} alt={`${project.title} screenshot`} />}
              <BriefcaseBusiness size={22} />
              <h3>{project.title}</h3>
              <p>{project.description}</p>
              <div className="tags">{project.techStack?.map((tech) => <span key={tech}>{tech}</span>)}</div>
              <small>By {project.owner?.name}</small>
              <div className="actions">
                <Link to={`/projects/${project._id}`}>Details</Link>
                <a href={project.github} target="_blank">GitHub</a>
                <a href={project.liveDemo} target="_blank">Live Demo</a>
              </div>
            </article>
          ))}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />
      </section>
    </div>
  );
}
