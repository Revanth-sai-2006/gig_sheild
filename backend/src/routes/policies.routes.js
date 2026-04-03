import express from "express";
import { getCollections, nextId } from "../data/mongodb.js";
import { authenticate } from "../middleware/auth.js";
import { calculateDynamicPremium } from "../services/riskEngine.js";

const router = express.Router();

router.get("/", authenticate, async (req, res) => {
  const { users, policyCatalog } = getCollections();
  const user = await users.findOne({ id: req.user.userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const policies = await policyCatalog.find({}).toArray();

  const enrichedPolicies = await Promise.all(
    policies.map(async (policy) => {
      const premium = await calculateDynamicPremium({
        baseWeeklyPremium: policy.baseWeeklyPremium,
        jobType: user.jobType,
        location: user.location
      });

      return {
        ...policy,
        dynamicPremium: premium
      };
    })
  );

  return res.json(enrichedPolicies);
});

router.post("/purchase", authenticate, async (req, res) => {
  const { policyId } = req.body;
  const { users, policyCatalog, userPolicies } = getCollections();
  const user = await users.findOne({ id: req.user.userId });

  if (!policyId) {
    return res.status(400).json({ message: "policyId is required" });
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const policy = await policyCatalog.findOne({ id: policyId });
  if (!policy) {
    return res.status(404).json({ message: "Policy not found" });
  }

  const existing = await userPolicies.findOne({ userId: user.id, policyId, status: "active" });

  if (existing) {
    return res.status(409).json({ message: "Policy already active for this user" });
  }

  const dynamicPremium = await calculateDynamicPremium({
    baseWeeklyPremium: policy.baseWeeklyPremium,
    jobType: user.jobType,
    location: user.location
  });

  const userPolicy = {
    id: nextId("UPL"),
    userId: user.id,
    policyId: policy.id,
    policyName: policy.name,
    purchasedAt: new Date().toISOString(),
    status: "active",
    weeklyPremium: dynamicPremium.weeklyPremium,
    premiumBreakdown: dynamicPremium.breakdown,
    latestWeather: dynamicPremium.weather,
    maxWeeklyCoverage: policy.maxWeeklyCoverage
  };

  await userPolicies.insertOne(userPolicy);
  return res.status(201).json(userPolicy);
});

router.get("/active", authenticate, async (req, res) => {
  const { users, userPolicies } = getCollections();
  const user = await users.findOne({ id: req.user.userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const activePolicies = await userPolicies.find({ userId: user.id, status: "active" }).toArray();

  const refreshed = await Promise.all(
    activePolicies.map(async (policy) => {
      const dynamic = await calculateDynamicPremium({
        baseWeeklyPremium: policy.premiumBreakdown.baseWeeklyPremium,
        jobType: user.jobType,
        location: user.location
      });

      return {
        ...policy,
        weeklyPremium: dynamic.weeklyPremium,
        premiumBreakdown: dynamic.breakdown,
        latestWeather: dynamic.weather
      };
    })
  );

  return res.json(refreshed);
});

export default router;
