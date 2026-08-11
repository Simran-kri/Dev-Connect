import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { demoProjects, demoUsers } from "../data/demo.js";
import { initials } from "../lib/helpers.js";

export default function UserDetail() {
  const { id } = useParams();
  const [person, setPerson] = useState(demoUsers.find((item) => item._id === id) || demoUsers[0]);
  const [projects, setProjects] = useState(demoProjects);

  useEffect(() => {
    api.get(`/users/${id}`).then(({ data }) => setPerson(data.user)).catch(() => {});
    api.get(`/projects?owner=${id}`).then(({ data }) => setProjects(data.projects)).catch(() => {});
  }, [id]);

  return (
    <div className="content-grid">
      <section className="panel">
        <div className="profile-head">
          {person?.avatar ? <img className="avatar big image-avatar" src={person.avatar} alt={person.name} /> : <span className="avatar big">{initials(person?.name)}</span>}
          <div>
            <h2>{person?.name}</h2>
            <p>{person?.title || "Developer"}</p>
            <small>{person?.college}</small>
          </div>
        </div>
        <p>{person?.bio || "Developer profile is ready for projects, skills and collaboration requests."}</p>
        <div className="tags">{person?.skills?.map((skill) => <span key={skill}>{skill}</span>)}</div>
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
