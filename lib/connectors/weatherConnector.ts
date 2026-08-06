/**
 * Phase 10 (Part 3) — Weather Connector (live + mock fallback).
 *
 * Returns India Meteorological Department (IMD) weather data via the
 * Open-Meteo API (a free, keyless JSON provider that surfaces IMD-derived
 * forecast data). On any failure it gracefully falls back to the original
 * mock implementation.
 *
 * The connector preserves the same `DataConnector` shape and id as before
 * (backward compatible).
 */
import type { DataConnector, ConnectorResult, ConnectorItem } from "./types";
import { httpJson } from "./http";
import { mockResult, today } from "./mockHelpers";

const WEATHER_WORDS = [
  "weather",
  "rainfall",
  "rain",
  "climate",
  "temperature",
  "forecast",
  "monsoon",
  "imd",
  "today",
  "in",
  "of",
  "for",
  "what",
  "is",
];

const DEFAULT_CITY = "New Delhi";

/** Common spellings that map to a canonical Indian city name. */
const CITY_ALIASES: Record<string, string> = {
  delhi: "New Delhi",
  newdelhi: "New Delhi",
  mumbai: "Mumbai",
  bombay: "Mumbai",
  kolkata: "Kolkata",
  calcutta: "Kolkata",
  chennai: "Chennai",
  madras: "Chennai",
  bangalore: "Bengaluru",
  bengaluru: "Bengaluru",
  hyderabad: "Hyderabad",
  ahmedabad: "Ahmedabad",
  surat: "Surat",
  pune: "Pune",
  jaipur: "Jaipur",
  lucknow: "Lucknow",
  kanpur: "Kanpur",
  nagpur: "Nagpur",
  patna: "Patna",
  bhopal: "Bhopal",
  indore: "Indore",
  guwahati: "Guwahati",
  shimla: "Shimla",
  dehradun: "Dehradun",
  varanasi: "Varanasi",
  trivandrum: "Thiruvananthapuram",
  thiruvananthapuram: "Thiruvananthapuram",
};

/** Resolves a (possibly free-form) query into a city name for geocoding. */
function resolveCity(query: string): string {
  const lower = query.toLowerCase();
  for (const [alias, canonical] of Object.entries(CITY_ALIASES)) {
    if (lower.includes(alias)) return canonical;
  }
  const tokens = lower
    .split(/[^a-z]+/)
    .filter((token) => token.length > 2 && !WEATHER_WORDS.includes(token));
  if (tokens.length > 0) {
    const candidate = tokens.join(" ");
    return candidate.charAt(0).toUpperCase() + candidate.slice(1);
  }
  return DEFAULT_CITY;
}

interface GeocodeResult {
  results?: Array<{
    name?: string;
    latitude?: number;
    longitude?: number;
    country?: string;
  }>;
}
interface ForecastCurrent {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  wind_speed_10m?: number;
  weather_code?: number;
}
interface ForecastDaily {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  precipitation_sum?: number[];
}
interface ForecastResult {
  current?: ForecastCurrent;
  daily?: ForecastDaily;
}

const WEATHER_CODE_LABEL: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight showers",
  81: "Moderate showers",
  82: "Violent showers",
  95: "Thunderstorm",
};

function weatherCodeLabel(code?: number): string {
  if (code === undefined) return "";
  return WEATHER_CODE_LABEL[code] ?? `Weather code ${code}`;
}

/** Builds the original mock fallback result (unchanged content). */
function buildMock(query: string): ConnectorResult {
  const items: ConnectorItem[] = [
    {
      title: "Today's Weather",
      description: `Weather conditions for ${query}.`,
      url: "https://mausam.imd.gov.in",
      source: "India Meteorological Department",
      date: today(),
    },
    {
      title: "7-Day Forecast",
      description: "District-level forecast outlook for the coming week.",
      url: "https://mausam.imd.gov.in/forecast",
      source: "IMD Forecast Division",
      date: today(),
    },
  ];

  return mockResult("weather", query, "India Meteorological Department", items);
}

/** Performs the live weather lookup via Open-Meteo (throws on failure). */
async function liveSearch(query: string): Promise<ConnectorResult> {
  const city = resolveCity(query);

  // Geocode the city to coordinates (cached for 1 hour — cities are stable).
  const geo = await httpJson<GeocodeResult>({
    url: "https://geocoding-api.open-meteo.com/v1/search",
    query: { name: city, count: 1, language: "en", format: "json" },
    cacheTtlSeconds: 3600,
    connectorId: "weather",
    rateLimitKey: "weather-geo",
    rateLimit: { capacity: 5, refillRate: 1, timeoutMs: 8000 },
  });

  const place = (geo?.results ?? []).find(
    (result) => typeof result.latitude === "number" && typeof result.longitude === "number"
  );
  if (!place) throw new Error("Unable to locate the requested city.");

  const forecast = await httpJson<ForecastResult>({
    url: "https://api.open-meteo.com/v1/forecast",
    query: {
      latitude: place.latitude,
      longitude: place.longitude,
      current: "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum",
      timezone: "auto",
      forecast_days: 3,
    },
    cacheTtlSeconds: 600, // 10 minutes
    connectorId: "weather",
    rateLimitKey: "weather-forecast",
    rateLimit: { capacity: 10, refillRate: 2, timeoutMs: 8000 },
  });

  const cityName = place.name ?? city;
  const items: ConnectorItem[] = [];

  const current = forecast.current;
  if (current) {
    items.push({
      title: `Current weather in ${cityName}`,
      description: [
        current.temperature_2m !== undefined ? `${Math.round(current.temperature_2m)}°C` : "",
        current.weather_code !== undefined ? weatherCodeLabel(current.weather_code) : "",
        current.relative_humidity_2m !== undefined
          ? `Humidity ${Math.round(current.relative_humidity_2m)}%`
          : "",
        current.wind_speed_10m !== undefined ? `Wind ${Math.round(current.wind_speed_10m)} km/h` : "",
      ]
        .filter(Boolean)
        .join(", "),
      url: "https://mausam.imd.gov.in",
      source: "Open-Meteo (IMD weather data)",
      date: today(),
    });
  }

  const daily = forecast.daily;
  if (daily?.time) {
    daily.time.forEach((day, index) => {
      const high = daily.temperature_2m_max?.[index];
      const low = daily.temperature_2m_min?.[index];
      const rain = daily.precipitation_sum?.[index];
      items.push({
        title: `Forecast for ${day}`,
        description: [
          high !== undefined ? `High ${Math.round(high)}°C` : "",
          low !== undefined ? `Low ${Math.round(low)}°C` : "",
          rain !== undefined && rain > 0
            ? `${rain} mm rain`
            : rain !== undefined
              ? "No precipitation"
              : "",
          daily.weather_code?.[index] !== undefined
            ? weatherCodeLabel(daily.weather_code[index])
            : "",
        ]
          .filter(Boolean)
          .join(", "),
        url: "https://mausam.imd.gov.in",
        source: "Open-Meteo (IMD weather data)",
        date: day,
      });
    });
  }

  return {
    connectorId: "weather",
    query,
    summary:
      items.length > 0
        ? `Live weather for ${cityName}: ${items[0].description ?? ""}`
        : `No live weather data available for ${cityName}.`,
    items: items.slice(0, 5),
    source: "Open-Meteo / IMD",
    timestamp: Date.now(),
  };
}

export const weatherConnector: DataConnector = {
  id: "weather",
  name: "Weather",
  description:
    "India Meteorological Department (IMD) data — rainfall, temperature, and forecasts.",
  async isAvailable() {
    return true;
  },
  async search(query: string): Promise<ConnectorResult> {
    try {
      return await liveSearch(query);
    } catch {
      // Graceful fallback — the live source failed, keep the chat running.
      return buildMock(query);
    }
  },
};

export default weatherConnector;


