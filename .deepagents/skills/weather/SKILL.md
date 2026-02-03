---
name: weather
description: Get weather via web_operations (Open-Meteo geocoding + forecast APIs) when no dedicated weather tool is available.
---

# Weather

Use this skill when users ask for current weather or forecast.

## Trigger hints

- "how is the weather"
- "will it rain today"
- "tomorrow temperature"
- "weather in <city>"

## Tool-first method

Use `web_operations.http_request` with Open-Meteo APIs.

1. Geocode location
- Endpoint: `https://geocoding-api.open-meteo.com/v1/search?name=<query>&count=1&language=en&format=json`
- Extract: `latitude`, `longitude`, resolved place name, timezone.

2. Fetch forecast
- Endpoint: `https://api.open-meteo.com/v1/forecast`
- Recommended query params:
  - `latitude`, `longitude`
  - `current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m`
  - `daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max`
  - `hourly=temperature_2m,precipitation_probability,weather_code`
  - `timezone=auto`

3. Present concise result
- Current: temperature, feels-like, humidity, wind, rain.
- Forecast: today + next 1-3 days.
- Mention local timezone and exact date (YYYY-MM-DD).

## Reliability rules

- If multiple places match, ask user to confirm city/country.
- If API fails, report failure reason and ask to retry with a more specific location.
- Do not fabricate weather data.

## Output template

- Location: <resolved location>
- Current (<local time/date>): ...
- Next 1-3 days: ...
- Advice: umbrella/sunscreen/warm layers (based on forecast)

## Source attribution

Adapted from OpenClaw's `weather` idea:
`https://github.com/openclaw/openclaw/tree/main/skills/weather`
