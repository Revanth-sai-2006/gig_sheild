import express from "express";
import { getCollections, nextId } from "../data/mongodb.js";
import { authenticate } from "../middleware/auth.js";
import { fetchWeatherForLocation } from "../services/weatherService.js";
import { assessClaimFraud } from "../services/fraudEngine.js";
import {
  getSupportedPayoutGateways,
  normalizePayoutGateway,
  simulatePayoutSettlement
} from "../services/paymentGateway.js";

const router = express.Router();

function evaluateClaim(claimType, amount, triggers = [], activePolicy, fraudAssessment) {
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

  if (fraudAssessment?.riskLevel === "high") {
    return {
      status: "rejected",
      reason: "Fraud check failed: high confidence mismatch across signals."
    };
  }

  if (fraudAssessment?.riskLevel === "medium") {
    return {
      status: "pending",
      reason: "Claim flagged by fraud checks and sent for enhanced review."
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

function startOfDayIso(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function createTimelineEntry(stage, title, detail) {
  return {
    id: nextId("EVT"),
    stage,
    title,
    detail,
    at: new Date().toISOString()
  };
}

function buildClaimTimeline({ fraudAssessment, decisionReason, payoutGatewayInfo }) {
  const timeline = [createTimelineEntry("submitted", "Claim submitted", "Worker submitted claim request.")];

  timeline.push(
    createTimelineEntry(
      "fraud_scored",
      `Fraud score calculated (${fraudAssessment.fraudScore}/100)`,
      `Risk level: ${fraudAssessment.riskLevel}.`
    )
  );

  const checks = fraudAssessment?.checks || {};
  if (checks.gpsMismatch) {
    timeline.push(
      createTimelineEntry(
        "gps_check",
        "GPS mismatch detected",
        `Reported location deviates by ${checks.distanceKm ?? "N/A"} km from delivery route.`
      )
    );
  }

  if (checks.weatherMismatch) {
    timeline.push(
      createTimelineEntry(
        "weather_check",
        "Weather mismatch detected",
        `Claimed ${checks.claimedWeather || "unknown"}, observed ${checks.liveWeatherCondition || "unknown"}.`
      )
    );
  }

  if (checks.frequentClaims) {
    timeline.push(
      createTimelineEntry(
        "frequency_check",
        "High claim frequency detected",
        `${checks.recentClaimCount} claims in the last 14 days.`
      )
    );
  }

  timeline.push(createTimelineEntry("decision", "Initial decision generated", decisionReason));
  timeline.push(
    createTimelineEntry(
      "gateway_selected",
      "Payout gateway selected",
      `Selected gateway: ${payoutGatewayInfo.label}.`
    )
  );

  return timeline;
}

function queuePayoutSettlement(claimsCollection, claim) {
  setTimeout(async () => {
    try {
      const settlement = simulatePayoutSettlement({
        gatewayCode: claim.payoutGateway,
        amount: claim.amount,
        claimId: claim.id
      });

      await claimsCollection.updateOne(
        { id: claim.id },
        {
          $set: {
            payoutStatus: settlement.status,
            payoutGateway: settlement.gatewayCode,
            payoutTransactionId: settlement.transactionId,
            payoutMessage: `INR ${claim.amount} credited successfully via ${settlement.gatewayLabel}. Transaction: ${settlement.transactionId}`,
            payoutProcessedAt: settlement.settledAt,
            updatedAt: new Date().toISOString()
          },
          $push: {
            timeline: createTimelineEntry(
              "payout_settled",
              "Payout settled",
              `INR ${claim.amount} settled via ${settlement.gatewayLabel}.`
            )
          }
        }
      );
    } catch (error) {
      console.error("Failed to complete simulated payout", error);
    }
  }, 2000);
}

router.get("/metrics", authenticate, async (req, res) => {
  const { claims, userPolicies } = getCollections();
  const [allClaims, userClaims, allPolicies] = await Promise.all([
    claims.find({}).toArray(),
    claims.find({ userId: req.user.userId }).toArray(),
    userPolicies.find({ userId: req.user.userId, status: "active" }).toArray()
  ]);

  const approvedClaims = allClaims.filter((claim) => claim.status === "approved");
  const totalApprovedAmount = approvedClaims.reduce((sum, claim) => sum + Number(claim.amount || 0), 0);
  const protectedCoverage = allPolicies.reduce((sum, policy) => sum + Number(policy.maxWeeklyCoverage || 0), 0);
  const lossRatio = protectedCoverage > 0 ? Number((totalApprovedAmount / protectedCoverage).toFixed(2)) : 0;

  const fraudFlaggedClaims = allClaims.filter((claim) =>
    ["high", "medium"].includes(claim?.fraudAssessment?.riskLevel)
  );
  const highFraudClaims = allClaims.filter((claim) => claim?.fraudAssessment?.riskLevel === "high");
  const weatherMismatchClaims = allClaims.filter((claim) => claim?.fraudAssessment?.checks?.weatherMismatch);

  const lastWeekStart = startOfDayIso(7);
  const previousWeekStart = startOfDayIso(14);
  const lastWeekClaims = allClaims.filter((claim) => claim.createdAt >= lastWeekStart).length;
  const previousWeekClaims = allClaims.filter(
    (claim) => claim.createdAt >= previousWeekStart && claim.createdAt < lastWeekStart
  ).length;
  const predictedClaims = Math.ceil(lastWeekClaims * 1.2);

  const weeklyTrend = Array.from({ length: 6 }).map((_, index) => {
    const start = new Date();
    start.setDate(start.getDate() - (5 - index) * 7);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 7);

    const total = allClaims.filter((claim) => claim.createdAt >= start.toISOString() && claim.createdAt < end.toISOString()).length;
    return {
      weekLabel: `W${index + 1}`,
      total
    };
  });

  const workerApprovedAmount = userClaims
    .filter((claim) => claim.status === "approved")
    .reduce((sum, claim) => sum + Number(claim.amount || 0), 0);
  const workerClaimHistory = userClaims
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .slice(-8)
    .map((claim, index) => ({
      label: `C${index + 1}`,
      amount: Number(claim.amount || 0),
      status: claim.status
    }));

  return res.json({
    worker: {
      totalProtectedEarnings: workerApprovedAmount,
      activeCoverage: protectedCoverage,
      totalClaims: userClaims.length,
      approvedClaims: userClaims.filter((claim) => claim.status === "approved").length,
      claimHistory: workerClaimHistory
    },
    admin: {
      totalClaims: allClaims.length,
      approvedClaims: approvedClaims.length,
      pendingClaims: allClaims.filter((claim) => claim.status === "pending").length,
      rejectedClaims: allClaims.filter((claim) => claim.status === "rejected").length,
      lossRatio,
      fraudFlaggedClaims: fraudFlaggedClaims.length,
      highFraudClaims: highFraudClaims.length,
      weatherMismatchClaims: weatherMismatchClaims.length,
      predictedClaimsNextWeek: predictedClaims,
      lastWeekClaims,
      previousWeekClaims,
      weeklyTrend
    }
  });
});

router.get("/", authenticate, async (req, res) => {
  const { claims } = getCollections();
  const userClaims = await claims.find({ userId: req.user.userId }).sort({ createdAt: -1 }).toArray();
  return res.json(userClaims);
});

router.get("/payout-gateways", authenticate, (_req, res) => {
  return res.json(getSupportedPayoutGateways());
});

router.patch("/:claimId/review", authenticate, async (req, res) => {
  const { claimId } = req.params;
  const { decision, reviewReason } = req.body;
  const { claims } = getCollections();

  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ message: "decision must be either 'approve' or 'reject'" });
  }

  const claim = await claims.findOne({ id: claimId, userId: req.user.userId });
  if (!claim) {
    return res.status(404).json({ message: "Claim not found" });
  }

  if (claim.status !== "pending") {
    return res.status(400).json({ message: "Only pending claims can be reviewed" });
  }

  const approved = decision === "approve";
  const nextStatus = approved ? "approved" : "rejected";
  const nextPayoutStatus = approved ? "processing" : "not_started";
  const reason = reviewReason || (approved ? "Approved during manual review." : "Rejected during manual review.");
  const reviewTimelineEntry = createTimelineEntry(
    "manual_review",
    approved ? "Manual review approved" : "Manual review rejected",
    reason
  );

  const updatedClaim = {
    ...claim,
    status: nextStatus,
    decisionReason: reason,
    payoutStatus: nextPayoutStatus,
    payoutMessage: approved
      ? `Payout processing initiated via ${normalizePayoutGateway(claim.payoutGateway).label}.`
      : "Payout not initiated.",
    reviewedAt: new Date().toISOString(),
    reviewedBy: req.user.userId,
    timeline: [...(claim.timeline || []), reviewTimelineEntry],
    updatedAt: new Date().toISOString()
  };

  await claims.updateOne(
    { id: claim.id },
    {
      $set: {
        status: updatedClaim.status,
        decisionReason: updatedClaim.decisionReason,
        payoutStatus: updatedClaim.payoutStatus,
        payoutMessage: updatedClaim.payoutMessage,
        reviewedAt: updatedClaim.reviewedAt,
        reviewedBy: updatedClaim.reviewedBy,
        updatedAt: updatedClaim.updatedAt
      },
      $push: {
        timeline: reviewTimelineEntry
      }
    }
  );

  if (approved) {
    queuePayoutSettlement(claims, updatedClaim);
  }

  return res.json(updatedClaim);
});

router.post("/", authenticate, async (req, res) => {
  const {
    policyId,
    claimType,
    description,
    amount,
    triggerCodes = [],
    reportedLocation,
    deliveryLocation,
    claimedWeather,
    payoutGateway
  } = req.body;
  const { users, userPolicies, claims } = getCollections();

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

  const user = await users.findOne({ id: req.user.userId });
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  fourteenDaysAgo.setHours(0, 0, 0, 0);

  const recentClaimCount = await claims.countDocuments({
    userId: req.user.userId,
    createdAt: { $gte: fourteenDaysAgo.toISOString() }
  });

  const weather = await fetchWeatherForLocation(user?.location || "mumbai");
  const fraudAssessment = assessClaimFraud({
    amount: Number(amount),
    policyCoverageCap: Number(activePolicy.maxWeeklyCoverage),
    claimedWeather,
    liveWeatherCondition: weather.condition,
    reportedLocation,
    deliveryLocation,
    recentClaimCount
  });

  const decision = evaluateClaim(claimType, Number(amount), triggerCodes, activePolicy, fraudAssessment);
  const payoutGatewayInfo = normalizePayoutGateway(payoutGateway);
  const payoutStatus = decision.status === "approved" ? "processing" : "not_started";

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
    claimedWeather: claimedWeather || null,
    observedWeather: weather.condition,
    reportedLocation: reportedLocation || null,
    deliveryLocation: deliveryLocation || null,
    fraudAssessment,
    payoutStatus,
    payoutGateway: payoutGatewayInfo.code,
    payoutAmount: decision.status === "approved" ? Number(amount) : 0,
    payoutMessage:
      decision.status === "approved"
        ? `Payout processing initiated via ${payoutGatewayInfo.label}.`
        : "Payout not initiated.",
    timeline: buildClaimTimeline({
      fraudAssessment,
      decisionReason: decision.reason,
      payoutGatewayInfo
    }),
    createdAt: new Date().toISOString()
  };

  if (claim.status === "approved") {
    claim.timeline.push(
      createTimelineEntry(
        "payout_processing",
        "Payout processing started",
        `Gateway ${payoutGatewayInfo.label} started payout processing.`
      )
    );
  }

  await claims.insertOne(claim);

  if (claim.status === "approved") {
    queuePayoutSettlement(claims, claim);
  }

  return res.status(201).json(claim);
});

export default router;
