import "dotenv/config";
import mongoose from "mongoose";
import { connectDb } from "./config/db.js";
import Conversation from "./models/Conversation.js";
import Group from "./models/Group.js";
import Notification from "./models/Notification.js";
import Post from "./models/Post.js";
import Project from "./models/Project.js";
import User from "./models/User.js";

const users = [
  {
    name: "Simran Kumari",
    email: "simran@devconnect.local",
    password: "password123",
    title: "Full Stack Developer",
    college: "LNCT Bhopal",
    bio: "MERN developer preparing for product-based interviews.",
    skills: ["React", "Node", "MongoDB", "C++"],
    github: "https://github.com",
    linkedin: "https://linkedin.com",
    portfolio: "https://vercel.app"
  },
  {
    name: "Ankit Sharma",
    email: "ankit@devconnect.local",
    password: "password123",
    title: "Backend Developer",
    college: "SGSITS Indore",
    bio: "Java, Node and database design enthusiast.",
    skills: ["Java", "Node", "SQL", "DSA"],
    github: "https://github.com",
    linkedin: "https://linkedin.com"
  },
  {
    name: "Riya Patel",
    email: "riya@devconnect.local",
    password: "password123",
    title: "Frontend Engineer",
    college: "Medicaps University",
    bio: "React developer who likes clean UI and accessibility.",
    skills: ["React", "TypeScript", "CSS", "UI"],
    github: "https://github.com",
    linkedin: "https://linkedin.com"
  },
  {
    name: "Admin User",
    email: "admin@devconnect.local",
    password: "password123",
    role: "admin",
    title: "Platform Admin",
    college: "DevConnect",
    skills: ["Moderation", "Security", "APIs"]
  }
];

async function seed() {
  await connectDb();

  await Promise.all([
    Conversation.deleteMany({}),
    Group.deleteMany({}),
    Notification.deleteMany({}),
    Post.deleteMany({}),
    Project.deleteMany({}),
    User.deleteMany({})
  ]);

  const [simran, ankit, riya, admin] = await User.create(users);

  simran.following = [ankit._id, riya._id];
  ankit.followers = [simran._id];
  riya.followers = [simran._id];
  await Promise.all([simran.save(), ankit.save(), riya.save()]);

  const [financeProject, codeSyncProject] = await Project.create([
    {
      owner: simran._id,
      title: "Finance Tracker",
      description: "Tracks expenses, budgets, monthly charts, and JWT-protected user data.",
      techStack: ["React", "Node", "MongoDB", "Chart.js"],
      github: "https://github.com",
      liveDemo: "https://vercel.app",
      likes: [ankit._id, riya._id]
    },
    {
      owner: ankit._id,
      title: "CodeSync Rooms",
      description: "Realtime coding discussion rooms for placement preparation groups.",
      techStack: ["Socket.io", "Express", "React"],
      github: "https://github.com",
      liveDemo: "https://vercel.app",
      likes: [simran._id]
    }
  ]);

  await Post.create([
    {
      author: simran._id,
      body: "Solved three graph problems today and wrote notes for BFS patterns.",
      tags: ["DSA", "Graphs", "Placement"],
      likes: [ankit._id, riya._id],
      comments: [{ author: ankit._id, text: "Share the notes in the group?" }]
    },
    {
      author: ankit._id,
      body: "Added Socket.io rooms and message persistence to CodeSync Rooms.",
      tags: ["Socket.io", "Node", "Projects"],
      likes: [simran._id]
    }
  ]);

  await Group.create([
    {
      name: "Placement Preparation",
      description: "Daily DSA, mock interviews, referrals, and resume reviews.",
      owner: simran._id,
      members: [simran._id, ankit._id, riya._id],
      posts: [{ author: simran._id, text: "Post today's DSA progress before 10 PM." }]
    },
    {
      name: "MERN Developers",
      description: "Build projects, review code, and solve backend problems together.",
      owner: ankit._id,
      members: [simran._id, ankit._id]
    }
  ]);

  await Conversation.create({
    members: [simran._id, ankit._id],
    messages: [
      { sender: simran._id, text: "Can you review my JWT auth flow?" },
      { sender: ankit._id, text: "Yes. Also add refresh-token notes to README." }
    ]
  });

  await Notification.create([
    { recipient: simran._id, actor: ankit._id, type: "like", text: "Ankit liked your project" },
    { recipient: ankit._id, actor: simran._id, type: "follow", text: "Simran followed you" },
    { recipient: riya._id, actor: simran._id, type: "project", text: "Simran published Finance Tracker" }
  ]);

  console.log("Seed complete");
  console.log("Demo users:");
  console.log("simran@devconnect.local / password123");
  console.log("ankit@devconnect.local / password123");
  console.log("riya@devconnect.local / password123");
  console.log("admin@devconnect.local / password123");

  await mongoose.disconnect();
}

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

