import express from "express";
import { getCollections, nextId } from "../data/mongodb.js";
import { authenticate } from "../middleware/auth.js";
import { buildAutomationTriggers, calculateDynamicPremium } from "../services/riskEngine.js";

const router = express.Router();

function calculatePolicyAdjustment(policy, triggers) {
  let coverageMultiplier = 1;
  let premiumAdjustment = 1;
  const reasons = [];

  if (triggers.some((trigger) => trigger.code === "FLOOD_WARNING")) {
    coverageMultiplier += 0.2;
    premiumAdjustment += 0.08;
    reasons.push("Flood warning active: temporary +20% coverage and +8% premium loading.");
  }

  if (triggers.some((trigger) => trigger.code === "TRAFFIC_DISRUPTION")) {
    coverageMultiplier += 0.1;
    premiumAdjustment += 0.05;
    reasons.push("Traffic disruption forecast: temporary +10% commute-income coverage.");
  }

  if (triggers.some((trigger) => trigger.code === "HEATWAVE_ALERT")) {
    coverageMultiplier += 0.08;
    premiumAdjustment += 0.04;
    reasons.push("Heatwave alert: temporary +8% outdoor shift interruption coverage.");
  }

  if (triggers.some((trigger) => trigger.code === "SAFE_ZONE_STATUS")) {
    premiumAdjustment -= 0.05;
    reasons.push("Safe zone status: 5% temporary premium relief.");
  }

  return {
    policyId: policy.id,
    policyName: policy.policyName,
    previousCoverageCap: policy.maxWeeklyCoverage,
    adjustedCoverageCap: Number((policy.maxWeeklyCoverage * coverageMultiplier).toFixed(2)),
    previousPremium: policy.weeklyPremium,
    adjustedPremium: Number((policy.weeklyPremium * premiumAdjustment).toFixed(2)),
    reasons
  };
}

router.get("/status", authenticate, async (req, res) => {
  const { users, userPolicies, claims, notifications: notificationsCollection } = getCollections();
  const user = await users.findOne({ id: req.user.userId });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  const premium = await calculateDynamicPremium({
    baseWeeklyPremium: 50,
    jobType: user.jobType,
    location: user.location
  });

  const triggers = buildAutomationTriggers(premium.weather, user.location);

  const activePolicies = await userPolicies.find({ userId: user.id, status: "active" }).toArray();
  const policyAdjustments = activePolicies.map((policy) => calculatePolicyAdjustment(policy, triggers));

  for (const adjustment of policyAdjustments) {
    const policy = activePolicies.find((entry) => entry.id === adjustment.policyId);
    if (!policy) {
      continue;
    }

    policy.maxWeeklyCoverage = adjustment.adjustedCoverageCap;
    policy.weeklyPremium = adjustment.adjustedPremium;
    policy.adjustmentReasons = adjustment.reasons;

    await userPolicies.updateOne(
      { id: policy.id, userId: user.id },
      {
        $set: {
          maxWeeklyCoverage: policy.maxWeeklyCoverage,
          weeklyPremium: policy.weeklyPremium,
          adjustmentReasons: policy.adjustmentReasons,
          updatedAt: new Date().toISOString()
        }
      }
    );
  }

  const autoClaims = [];
  for (const policy of activePolicies) {
    const shouldAutoClaim = triggers.some((trigger) => ["FLOOD_WARNING", "WEATHER_HEAVY_RAIN"].includes(trigger.code));

    if (!shouldAutoClaim) {
      continue;
    }

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);

    const hasToday = await claims.findOne({
      userId: user.id,
      policyId: policy.id,
      claimType: "auto_weather_claim",
      createdAt: {
        $gte: startOfToday.toISOString(),
        $lt: endOfToday.toISOString()
      }
    });

    if (hasToday) {
      continue;
    }

    const autoClaim = {
      id: nextId("CLM"),
      userId: user.id,
      policyId: policy.id,
      claimType: "auto_weather_claim",
      description: "Zero-touch claim raised due to severe weather trigger.",
      amount: Math.min(350, policy.maxWeeklyCoverage),
      status: triggers.some((trigger) => trigger.code === "FLOOD_WARNING") ? "approved" : "pending",
      decisionReason: triggers.some((trigger) => trigger.code === "FLOOD_WARNING")
        ? "Auto-approved due to flood warning trigger."
        : "Submitted automatically, awaiting review.",
      triggerCodes: triggers.map((trigger) => trigger.code),
      createdAt: new Date().toISOString(),
      automated: true
    };

    await claims.insertOne(autoClaim);
    autoClaims.push(autoClaim);
  }

  const notifications = triggers.map((trigger) => ({
    id: nextId("NTF"),
    type: trigger.code,
    message: `${trigger.label}: ${trigger.impact}`,
    severity: trigger.severity,
    createdAt: new Date().toISOString()
  }));

  if (notifications.length > 0) {
    await notificationsCollection.insertMany(notifications);
  }

  return res.json({
    weather: premium.weather,
    benchmarkPremium: premium,
    triggers,
    notifications,
    policyAdjustments,
    autoClaims
  });
});

export default router;
