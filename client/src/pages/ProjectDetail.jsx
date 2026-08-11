import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { demoProjects } from "../data/demo.js";
import { initials } from "../lib/helpers.js";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(demoProjects.find((item) => item._id === id) || demoProjects[0]);

  useEffect(() => {
    api.get(`/projects/${id}`).then(({ data }) => setProject(data.project)).catch(() => {});
  }, [id]);

  return (
    <section className="panel detail-page">
      {project?.images?.[0] && <img className="detail-image" src={project.images[0]} alt={`${project.title} screenshot`} />}
      <div className="detail-header">
        <div>
          <span className="eyebrow">Project showcase</span>
          <h2>{project?.title}</h2>
          <p>{project?.description}</p>
        </div>
        <div className="profile-chip">
          <span>{initials(project?.owner?.name)}</span>
          <div>
            <strong>{project?.owner?.name}</strong>
            <small>{project?.owner?.title || "Developer"}</small>
          </div>
        </div>
      </div>
      <div className="tags">{project?.techStack?.map((tech) => <span key={tech}>{tech}</span>)}</div>
      <div className="actions">
        {project?.github && <a href={project.github} target="_blank">GitHub</a>}
        {project?.liveDemo && <a href={project.liveDemo} target="_blank">Live Demo</a>}
        {project?.owner?._id && <Link to={`/users/${project.owner._id}`}>Owner profile</Link>}
      </div>
    </section>
  );
}
