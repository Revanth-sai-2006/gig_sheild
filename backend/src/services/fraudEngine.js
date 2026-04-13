const GPS_DISTANCE_THRESHOLD_KM = 5;
const FREQUENT_CLAIMS_THRESHOLD = 4;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineDistanceKm(pointA, pointB) {
  const lat1 = toNumber(pointA?.lat);
  const lon1 = toNumber(pointA?.lon);
  const lat2 = toNumber(pointB?.lat);
  const lon2 = toNumber(pointB?.lon);

  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) {
    return null;
  }

  const earthRadiusKm = 6371;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((earthRadiusKm * c).toFixed(2));
}

function normalizeCondition(condition = "") {
  return condition.toLowerCase().trim().replace(/\s+/g, "_");
}

function weatherConditionsMatch(claimedWeather, observedWeather) {
  const claimed = normalizeCondition(claimedWeather);
  const observed = normalizeCondition(observedWeather);

  if (!claimed) {
    return true;
  }

  if (claimed === observed) {
    return true;
  }

  const rainFamily = new Set(["rain", "rain_showers", "heavy_rain", "violent_rain", "drizzle", "thunderstorm"]);
  if (rainFamily.has(claimed) && rainFamily.has(observed)) {
    return true;
  }

  return false;
}

function computeMlLikeFraudProbability({ distanceKm, weatherMismatch, recentClaimCount, amountRatio }) {
  let score = -1.2;

  if (distanceKm !== null && distanceKm > GPS_DISTANCE_THRESHOLD_KM) {
    score += 1.4;
  }

  if (weatherMismatch) {
    score += 1.15;
  }

  score += Math.min(recentClaimCount / 6, 1) * 0.9;
  score += Math.min(Math.max(amountRatio, 0), 1) * 0.55;

  const probability = 1 / (1 + Math.exp(-score));
  return Number(probability.toFixed(3));
}

export function assessClaimFraud({
  amount,
  policyCoverageCap,
  claimedWeather,
  liveWeatherCondition,
  reportedLocation,
  deliveryLocation,
  recentClaimCount
}) {
  const distanceKm = haversineDistanceKm(reportedLocation, deliveryLocation);
  const weatherMismatch = !weatherConditionsMatch(claimedWeather, liveWeatherCondition);
  const frequentClaims = recentClaimCount >= FREQUENT_CLAIMS_THRESHOLD;
  const amountRatio = policyCoverageCap > 0 ? Number(amount) / Number(policyCoverageCap) : 0;
  const mlLikeProbability = computeMlLikeFraudProbability({
    distanceKm,
    weatherMismatch,
    recentClaimCount,
    amountRatio
  });

  let fraudScore = 0;
  const reasons = [];

  if (distanceKm !== null && distanceKm > GPS_DISTANCE_THRESHOLD_KM) {
    fraudScore += 40;
    reasons.push(`GPS mismatch: reported point is ${distanceKm} km away from delivery route.`);
  }

  if (weatherMismatch) {
    fraudScore += 35;
    reasons.push("Claimed weather does not match live weather feed.");
  }

  if (frequentClaims) {
    fraudScore += 25;
    reasons.push(`High claim frequency: ${recentClaimCount} claims in last 14 days.`);
  }

  fraudScore += Math.round(mlLikeProbability * 10);
  fraudScore = Math.min(fraudScore, 100);

  const riskLevel = fraudScore >= 70 ? "high" : fraudScore >= 45 ? "medium" : "low";

  return {
    riskLevel,
    fraudScore,
    mlLikeProbability,
    checks: {
      gpsMismatch: distanceKm !== null ? distanceKm > GPS_DISTANCE_THRESHOLD_KM : false,
      weatherMismatch,
      frequentClaims,
      distanceKm,
      recentClaimCount,
      claimedWeather: normalizeCondition(claimedWeather || ""),
      liveWeatherCondition: normalizeCondition(liveWeatherCondition || "")
    },
    reasons
  };
}