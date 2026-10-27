const REQUEST_TIMEOUT_MS = 7000;

export async function getUvForecast({ city, latitude, longitude }) {
  try {
    const location = await resolveLocation({ city, latitude, longitude });
    if (!location) {
      return {
        available: false,
        city,
        reason: "No weather location was found for this city.",
      };
    }

    const weatherUrl = new URL("https://api.open-meteo.com/v1/forecast");
    weatherUrl.search = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      daily: "uv_index_max",
      forecast_days: "1",
      timezone: location.timezone || "auto",
    }).toString();
    const response = await fetch(weatherUrl, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("UV forecast unavailable");
    const weather = await response.json();
    const uvIndex = weather.daily?.uv_index_max?.[0];
    if (typeof uvIndex !== "number" || !Number.isFinite(uvIndex)) {
      return {
        available: false,
        city: location.name,
        reason: "UV guidance is not available right now.",
      };
    }
    return {
      available: true,
      city: location.name,
      country: location.country,
      uvIndex,
      date: weather.daily.time?.[0],
      timezone: weather.timezone,
      guidance:
        uvIndex >= 3
          ? "UV exposure may call for sun protection. Use broad-spectrum sunscreen as directed and seek shade when practical."
          : "UV levels are currently lower. Follow the sunscreen label and local sun-safety guidance.",
    };
  } catch {
    return {
      available: false,
      city,
      reason: "UV guidance is temporarily unavailable.",
    };
  }
}

async function resolveLocation({ city, latitude, longitude }) {
  if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return {
      latitude,
      longitude,
      name: "Your current location",
      timezone: "auto",
    };
  }

  const geoUrl = new URL("https://geocoding-api.open-meteo.com/v1/search");
  geoUrl.search = new URLSearchParams({
    name: city,
    count: "1",
    language: "en",
    format: "json",
  }).toString();
  const response = await fetch(geoUrl, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error("Geocoding unavailable");
  return (await response.json()).results?.[0] || null;
}
