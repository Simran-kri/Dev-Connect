export const demoPosts = [
  {
    _id: "p1",
    author: { name: "Simran Kumari", title: "Full Stack Developer", college: "LNCT", avatar: "" },
    body: "Solved 3 graph problems today and wrote notes for BFS patterns. Placement prep feels easier when the streak is visible.",
    tags: ["DSA", "Graphs", "Placement"],
    likes: ["1", "2", "3", "4"],
    comments: [{ _id: "c1", author: { name: "Ankit" }, text: "Share the notes?" }]
  },
  {
    _id: "p2",
    author: { name: "Rahul Verma", title: "MERN Developer", college: "UIT RGPV", avatar: "" },
    body: "Built a finance tracker with JWT auth, MongoDB aggregation, and responsive charts.",
    tags: ["React", "Node", "MongoDB"],
    likes: ["1", "2"],
    comments: []
  }
];

export const demoProjects = [
  {
    _id: "pr1",
    title: "Finance Tracker",
    description: "A MERN app for tracking expenses, budgets, and monthly analytics.",
    techStack: ["React", "Node", "MongoDB"],
    github: "https://github.com",
    liveDemo: "https://vercel.com",
    owner: { name: "Rahul Verma", title: "MERN Developer" },
    likes: ["1", "2", "3"]
  },
  {
    _id: "pr2",
    title: "CodeSync Rooms",
    description: "Real-time coding discussion rooms for placement groups.",
    techStack: ["Socket.io", "Express", "React"],
    github: "https://github.com",
    liveDemo: "https://vercel.com",
    owner: { name: "Simran Kumari", title: "Full Stack Developer" },
    likes: ["1"]
  }
];

export const demoUsers = [
  {
    _id: "u1",
    name: "Simran Kumari",
    title: "Full Stack Developer",
    college: "LNCT",
    skills: ["React", "Node", "MongoDB", "C++"],
    followers: ["1", "2"]
  },
  {
    _id: "u2",
    name: "Ankit Sharma",
    title: "Java Backend Developer",
    college: "Medicaps",
    skills: ["Java", "Spring", "SQL", "DSA"],
    followers: ["1"]
  },
  {
    _id: "u3",
    name: "Riya Patel",
    title: "Frontend Engineer",
    college: "SGSITS",
    skills: ["React", "Tailwind", "TypeScript"],
    followers: []
  }
];

export const demoGroups = [
  {
    _id: "g1",
    name: "Placement Preparation",
    description: "Daily DSA, mock interviews, referrals, and resume reviews.",
    members: demoUsers,
    posts: []
  },
  {
    _id: "g2",
    name: "MERN Developers",
    description: "Build projects, review code, and solve backend problems together.",
    members: demoUsers.slice(0, 2),
    posts: []
  }
];

