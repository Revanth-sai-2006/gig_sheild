import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getCollections, nextId } from "../data/mongodb.js";

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "smart-worker-secret";

router.post("/register", async (req, res) => {
  const { name, email, password, jobType, location } = req.body;
  const { users } = getCollections();

  if (!name || !email || !password || !jobType || !location) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const emailLower = email.toLowerCase();
  const exists = await users.findOne({ emailLower });
  if (exists) {
    return res.status(409).json({ message: "User with this email already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = {
    id: nextId("USR"),
    name,
    email,
    emailLower,
    passwordHash,
    jobType,
    location,
    createdAt: new Date().toISOString()
  };

  await users.insertOne(user);

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  return res.status(201).json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      jobType: user.jobType,
      location: user.location
    }
  });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const { users } = getCollections();

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  const user = await users.findOne({ emailLower: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, { expiresIn: "7d" });

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      jobType: user.jobType,
      location: user.location
    }
  });
});

export default router;
