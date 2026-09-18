import { BriefcaseBusiness, Check, Github, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { demoProjects } from "../data/demo.js";
import { fullTimestamp, isValidUrl, splitList, uploadImage } from "../lib/helpers.js";
import { fetchGithubRepos } from "../lib/github.js";
import { toEmbedUrl } from "../lib/video.js";
import Pagination from "../components/Pagination.jsx";

export default function Projects() {
  const [projects, setProjects] = useState(demoProjects);
  const [form, setForm] = useState({ title: "", description: "", techStack: "", github: "", liveDemo: "", videoUrl: "" });
  const [imageFile, setImageFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const [githubUsername, setGithubUsername] = useState("");
  const [githubRepos, setGithubRepos] = useState(null);
  const [selectedRepoIds, setSelectedRepoIds] = useState([]);
  const [fetchingRepos, setFetchingRepos] = useState(false);
  const [githubError, setGithubError] = useState("");
  const [importing, setImporting] = useState(false);

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

    if (!isValidUrl(form.github) || !isValidUrl(form.liveDemo) || !isValidUrl(form.videoUrl)) {
      setError("GitHub, live demo, and video links must be valid URLs.");
      return;
    }

    let images = [];
    let uploadedVideo = "";
    try {
      if (imageFile) {
        setStatus("Uploading image...");
        images = [await uploadImage(imageFile)];
      }
      if (videoFile) {
        setStatus("Uploading video... this can take a moment.");
        setUploadingVideo(true);
        const formData = new FormData();
        formData.append("video", videoFile);
        const { data } = await api.post("/uploads/video", formData, {
          headers: { "Content-Type": "multipart/form-data" }
        });
        uploadedVideo = data.url;
      }
    } catch (err) {
      setUploadingVideo(false);
      setStatus("");
      setError(err.response?.data?.message || "Upload failed. Check Cloudinary configuration.");
      return;
    }
    setUploadingVideo(false);

    const payload = { ...form, techStack: splitList(form.techStack), images, videoFile: uploadedVideo };
    const optimistic = { ...payload, _id: crypto.randomUUID(), owner: JSON.parse(localStorage.getItem("devconnect_user") || "{}"), likes: [] };
    setProjects([optimistic, ...projects]);
    setForm({ title: "", description: "", techStack: "", github: "", liveDemo: "", videoUrl: "" });
    setImageFile(null);
    setVideoFile(null);
    api.post("/projects", payload).then(({ data }) => {
      setProjects((items) => [data.project, ...items.filter((item) => item._id !== optimistic._id)]);
      setStatus("Project published.");
    }).catch((err) => {
      setProjects((items) => items.filter((item) => item._id !== optimistic._id));
      setError(err.response?.data?.message || "Could not save project to backend.");
    });
  }

  async function loadGithubRepos(event) {
    event.preventDefault();
    setGithubError("");
    if (!githubUsername.trim()) {
      setGithubError("Enter a GitHub username first.");
      return;
    }
    setFetchingRepos(true);
    setGithubRepos(null);
    setSelectedRepoIds([]);
    try {
      const repos = await fetchGithubRepos(githubUsername.trim());
      if (repos.length === 0) {
        setGithubError(`${githubUsername} has no public, non-forked repositories.`);
      }
      setGithubRepos(repos);
    } catch (err) {
      setGithubError(err.message);
    } finally {
      setFetchingRepos(false);
    }
  }

  function toggleRepo(repoId) {
    setSelectedRepoIds((current) =>
      current.includes(repoId) ? current.filter((id) => id !== repoId) : [...current, repoId]
    );
  }

  async function importSelectedRepos() {
    const repos = githubRepos.filter((repo) => selectedRepoIds.includes(repo.id));
    if (repos.length === 0) return;

    setImporting(true);
    setGithubError("");
    try {
      const created = await Promise.all(
        repos.map((repo) =>
          api.post("/projects", {
            title: repo.name,
            description: repo.description || "No description provided on GitHub.",
            techStack: repo.language ? [repo.language] : [],
            github: repo.url,
            liveDemo: repo.homepage,
            images: []
          }).then(({ data }) => data.project)
        )
      );
      setProjects((items) => [...created, ...items]);
      setGithubRepos(null);
      setSelectedRepoIds([]);
      setGithubUsername("");
    } catch (err) {
      setGithubError(err.response?.data?.message || "Some repos couldn't be imported. Try again.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="content-grid">
      <section className="panel">
        <h2>Add project</h2>
        <form className="stack" onSubmit={createProject}>
          <input placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input placeholder="Tech stack, e.g. React, Node, MongoDB" value={form.techStack} onChange={(e) => setForm({ ...form, techStack: e.target.value })} />
          <input placeholder="GitHub link" value={form.github} onChange={(e) => setForm({ ...form, github: e.target.value })} />
          <input placeholder="Live demo link" value={form.liveDemo} onChange={(e) => setForm({ ...form, liveDemo: e.target.value })} />
          <label>Project screenshot<input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} /></label>
          <input
            placeholder="Demo video link (YouTube, Vimeo, Loom)"
            value={form.videoUrl}
            onChange={(e) => setForm({ ...form, videoUrl: e.target.value })}
          />
          <label>
            Or upload a demo video <span className="auth-optional">(max 50MB)</span>
            <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files?.[0] || null)} />
          </label>
          {error && <p className="error">{error}</p>}
          {status && <p className="success">{status}</p>}
          <button className="primary">Publish project</button>
        </form>

        <div className="github-import">
          <h2><Github size={16} /> Import from GitHub</h2>
          <form className="composer-row" onSubmit={loadGithubRepos}>
            <input
              placeholder="GitHub username"
              value={githubUsername}
              onChange={(e) => setGithubUsername(e.target.value)}
            />
            <button className="secondary pill" disabled={fetchingRepos}>
              {fetchingRepos ? "Fetching..." : "Fetch repos"}
            </button>
          </form>
          {githubError && <p className="error">{githubError}</p>}

          {githubRepos?.length > 0 && (
            <>
              <div className="github-repo-list">
                {githubRepos.map((repo) => {
                  const selected = selectedRepoIds.includes(repo.id);
                  return (
                    <button
                      type="button"
                      key={repo.id}
                      className={selected ? "github-repo-row selected" : "github-repo-row"}
                      onClick={() => toggleRepo(repo.id)}
                    >
                      <div>
                        <strong>{repo.name}</strong>
                        <small>{repo.description || "No description"}</small>
                        <div className="github-repo-meta">
                          {repo.language && <span>{repo.language}</span>}
                          <span><Star size={12} /> {repo.stars}</span>
                        </div>
                      </div>
                      {selected && <Check size={16} className="github-repo-check" />}
                    </button>
                  );
                })}
              </div>
              <button
                className="primary pill full"
                onClick={importSelectedRepos}
                disabled={importing || selectedRepoIds.length === 0}
              >
                {importing ? "Importing..." : `Import selected (${selectedRepoIds.length})`}
              </button>
            </>
          )}
        </div>
      </section>
      <section className="panel span-2">
        <h2>Project showcase</h2>
        <div className="project-grid">
          {projects.map((project) => {
            const embedUrl = toEmbedUrl(project.videoUrl);
            return (
              <article className="card project-card" key={project._id}>
                {project.videoFile ? (
                  <video className="project-video" controls src={project.videoFile} />
                ) : embedUrl ? (
                  <div className="project-video-embed">
                    <iframe
                      src={embedUrl}
                      title={`${project.title} demo`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : project.images?.[0] ? (
                  <img className="project-image" src={project.images[0]} alt={`${project.title} screenshot`} />
                ) : null}
                <BriefcaseBusiness size={22} />
                <h3>{project.title}</h3>
                <p>{project.description}</p>
                <div className="tags">{project.techStack?.map((tech) => <span key={tech}>{tech}</span>)}</div>
                <small>
                  By {project.owner?.name}
                  {project.createdAt && ` \u00b7 ${fullTimestamp(project.createdAt)}`}
                </small>
                <div className="actions">
                  <Link to={`/projects/${project._id}`}>Details</Link>
                  {project.github && <a href={project.github} target="_blank">GitHub</a>}
                  {project.liveDemo && <a href={project.liveDemo} target="_blank">Live Demo</a>}
                  {project.videoUrl && !embedUrl && <a href={project.videoUrl} target="_blank">Demo video</a>}
                </div>
              </article>
            );
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} onChange={setPage} loading={loading} />
      </section>
    </div>
  );
}
