import axios from "axios";

const locationCoordinates = {
  mumbai: { lat: 19.076, lon: 72.8777 },
  delhi: { lat: 28.6139, lon: 77.209 },
  bangalore: { lat: 12.9716, lon: 77.5946 },
  chennai: { lat: 13.0827, lon: 80.2707 },
  kolkata: { lat: 22.5726, lon: 88.3639 },
  hyderabad: { lat: 17.385, lon: 78.4867 },
  pune: { lat: 18.5204, lon: 73.8567 }
};

const weatherCodeMap = {
  0: "clear",
  1: "mainly_clear",
  2: "partly_cloudy",
  3: "overcast",
  45: "fog",
  48: "fog",
  51: "drizzle",
  53: "drizzle",
  55: "drizzle",
  56: "freezing_drizzle",
  57: "freezing_drizzle",
  61: "rain",
  63: "rain",
  65: "heavy_rain",
  66: "freezing_rain",
  67: "freezing_rain",
  71: "snow",
  73: "snow",
  75: "heavy_snow",
  80: "rain_showers",
  81: "rain_showers",
  82: "violent_rain",
  95: "thunderstorm",
  96: "hail_storm",
  99: "hail_storm"
};

function mockWeather(location) {
  const seeded = location.length * 17;
  const precipitation = seeded % 3 === 0 ? 14 : seeded % 2 === 0 ? 4 : 0;
  const windSpeed = seeded % 5 === 0 ? 38 : 14;
  const temperature = 21 + (seeded % 13);
  const condition = precipitation > 12 ? "heavy_rain" : precipitation > 3 ? "rain" : "clear";

  return {
    source: "mock",
    temperature,
    windSpeed,
    precipitation,
    condition
  };
}

export async function fetchWeatherForLocation(location = "") {
  const normalized = location.toLowerCase().trim();
  const coords = locationCoordinates[normalized] || locationCoordinates.mumbai;

  try {
    const { data } = await axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: coords.lat,
        longitude: coords.lon,
        current: "temperature_2m,wind_speed_10m,weather_code",
        daily: "precipitation_sum",
        forecast_days: 1,
        timezone: "auto"
      },
      timeout: 5000
    });

    const code = data?.current?.weather_code;
    const condition = weatherCodeMap[code] || "unknown";

    return {
      source: "open-meteo",
      temperature: data?.current?.temperature_2m ?? 25,
      windSpeed: data?.current?.wind_speed_10m ?? 10,
      precipitation: data?.daily?.precipitation_sum?.[0] ?? 0,
      condition
    };
  } catch (error) {
    return mockWeather(normalized || "default");
  }
}
