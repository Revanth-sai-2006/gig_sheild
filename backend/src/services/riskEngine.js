import { fetchWeatherForLocation } from "./weatherService.js";

const jobRiskMap = {
  construction: 1.4,
  delivery: 1.25,
  factory: 1.2,
  office: 0.85,
  agriculture: 1.35,
  driver: 1.3,
  healthcare: 1.1,
  default: 1
};

const locationSafetyMap = {
  mumbai: 1.2,
  delhi: 1.15,
  bangalore: 0.95,
  chennai: 1.1,
  kolkata: 1.05,
  hyderabad: 0.9,
  pune: 0.88,
  default: 1
};

function deriveWeatherMultiplier(weather) {
  let weatherMultiplier = 1;

  if (["heavy_rain", "violent_rain", "thunderstorm"].includes(weather.condition)) {
    weatherMultiplier += 0.35;
  } else if (["rain", "rain_showers", "drizzle"].includes(weather.condition)) {
    weatherMultiplier += 0.15;
  } else if (weather.condition === "clear") {
    weatherMultiplier -= 0.08;
  }

  if (weather.precipitation > 10) {
    weatherMultiplier += 0.2;
  }

  if (weather.windSpeed > 35) {
    weatherMultiplier += 0.12;
  }

  return Number(weatherMultiplier.toFixed(2));
}

export async function calculateDynamicPremium({ baseWeeklyPremium, jobType, location }) {
  const weather = await fetchWeatherForLocation(location);
  const jobRisk = jobRiskMap[jobType?.toLowerCase()] || jobRiskMap.default;
  const locationRisk = locationSafetyMap[location?.toLowerCase()] || locationSafetyMap.default;
  const weatherRisk = deriveWeatherMultiplier(weather);

  const finalPremium = Number((baseWeeklyPremium * jobRisk * locationRisk * weatherRisk).toFixed(2));

  return {
    weeklyPremium: finalPremium,
    breakdown: {
      baseWeeklyPremium,
      jobRisk,
      locationRisk,
      weatherRisk,
      formula: "basePremium * jobRisk * locationRisk * weatherRisk"
    },
    weather
  };
}

export function buildAutomationTriggers(weather, location) {
  const triggers = [];

  if (weather.precipitation > 12 || ["heavy_rain", "violent_rain"].includes(weather.condition)) {
    triggers.push({
      code: "WEATHER_HEAVY_RAIN",
      label: "Heavy rain alert",
      impact: "May reduce work hours; premium uplift and claim suggestion active.",
      severity: "high"
    });
  }

  if (weather.precipitation > 20) {
    triggers.push({
      code: "FLOOD_WARNING",
      label: "Flood warning",
      impact: "High disruption risk. Zero-touch claim can be auto-submitted.",
      severity: "critical"
    });
  }

  if (weather.windSpeed > 35) {
    triggers.push({
      code: "HIGH_WIND_ALERT",
      label: "High wind alert",
      impact: "Outdoor work risk increased; safety advisory sent.",
      severity: "medium"
    });
  }

  const trafficSensitiveLocations = ["mumbai", "delhi", "bangalore", "kolkata"];
  if (trafficSensitiveLocations.includes(location.toLowerCase())) {
    triggers.push({
      code: "TRAFFIC_DISRUPTION",
      label: "Traffic disruption forecast",
      impact: "Urban commute delay likely; possible income impact.",
      severity: "medium"
    });
  }

  if (weather.temperature > 36) {
    triggers.push({
      code: "HEATWAVE_ALERT",
      label: "Heatwave alert",
      impact: "Outdoor shifts may be reduced; hydration and claim guidance sent.",
      severity: "medium"
    });
  }

  if (triggers.length === 0) {
    triggers.push({
      code: "SAFE_ZONE_STATUS",
      label: "Safe zone status",
      impact: "Current conditions are stable and low risk.",
      severity: "low"
    });
  }

  return triggers;
}
