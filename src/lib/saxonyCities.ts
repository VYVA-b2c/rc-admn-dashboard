import { BASE_URL } from "./apiClient";

export const SAXONY_CENTER: [number, number] = [51.0, 13.4];
export const SAXONY_ZOOM = 9;

export async function getCityCoords(city: string | null): Promise<[number, number] | null> {
  if (!city) return null;

  try {
    const res = await fetch(`${BASE_URL}/api/v1/cities/city-coords?city=${encodeURIComponent(city)}`)
    if (!res.ok) return null;

    const data = await res.json();
    return [data.latitude, data.longitude];
  } catch (err) {
    console.error("Failed to fetch city coords:", err);
    return null;
  }
}