import express from "express";
import { getCollections, nextId } from "../data/mongodb.js";
import { authenticate } from "../middleware/auth.js";

const router = express.Router();

function evaluateClaim(claimType, amount, triggers = [], activePolicy) {
  if (amount > activePolicy.maxWeeklyCoverage) {
    return {
      status: "rejected",
      reason: "Requested amount exceeds policy weekly coverage cap."
    };
  }

  if (amount <= 0) {
    return {
      status: "rejected",
      reason: "Claim amount must be greater than zero."
    };
  }

  if (claimType === "weather_disruption" && amount <= 300) {
    return { status: "approved", reason: "Small weather disruption claim auto-approved." };
  }

  if (triggers.includes("FLOOD_WARNING") && amount <= 500) {
    return { status: "approved", reason: "Flood trigger active and amount under auto threshold." };
  }

  return { status: "pending", reason: "Needs manual review." };
}

router.get("/", authenticate, async (req, res) => {
  const { claims } = getCollections();
  const userClaims = await claims.find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
  return res.json(userClaims);
});

router.post("/", authenticate, async (req, res) => {
  const { policyId, claimType, description, amount, triggerCodes = [] } = req.body;
  const { userPolicies, claims } = getCollections();

  if (!policyId || !claimType || !description || !amount) {
    return res.status(400).json({ message: "policyId, claimType, description and amount are required" });
  }

  const activePolicy = await userPolicies.findOne({
    id: policyId,
    userId: req.user.userId,
    status: "active"
  });

  if (!activePolicy) {
    return res.status(404).json({ message: "Active policy not found" });
  }

  const decision = evaluateClaim(claimType, Number(amount), triggerCodes, activePolicy);

  const claim = {
    id: nextId("CLM"),
    userId: req.user.userId,
    policyId,
    claimType,
    description,
    amount: Number(amount),
    status: decision.status,
    decisionReason: decision.reason,
    triggerCodes,
    createdAt: new Date().toISOString()
  };

  await claims.insertOne(claim);
  return res.status(201).json(claim);
});

export default router;
