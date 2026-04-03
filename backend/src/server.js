import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.routes.js";
import policyRoutes from "./routes/policies.routes.js";
import claimsRoutes from "./routes/claims.routes.js";
import automationRoutes from "./routes/automation.routes.js";
import { connectToDatabase } from "./data/mongodb.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ message: "Gig Shield API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/policies", policyRoutes);
app.use("/api/claims", claimsRoutes);
app.use("/api/automation", automationRoutes);

async function startServer() {
  await connectToDatabase();

  app.listen(PORT, () => {
    console.log(`Server started at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
