export const SAXONY_CITY_COORDS: Record<string, [number, number]> = {
  Dresden: [51.0504, 13.7373],
  Leipzig: [51.3397, 12.3731],
  Chemnitz: [50.8278, 12.9214],
  Zwickau: [50.7189, 12.4964],
  Plauen: [50.4974, 12.1346],
  Görlitz: [51.1529, 14.9877],
  Bautzen: [51.1814, 14.4244],
  Freiberg: [50.9119, 13.3428],
  Pirna: [50.9617, 13.9389],
  Meissen: [51.1634, 13.4737],
  Meißen: [51.1634, 13.4737],
  Radebeul: [51.1069, 13.6569],
  Freital: [51.0082, 13.6486],
  Riesa: [51.3065, 13.2928],
  Döbeln: [51.1209, 13.1163],
  Grimma: [51.2389, 12.7276],
  Delitzsch: [51.5254, 12.3428],
  Torgau: [51.5603, 12.9961],
  Annaberg: [50.5799, 13.0021],
  Hamburg: [50.5799, 13.0021],
  Berlin: [50.5799, 13.0021],
  "Annaberg-Buchholz": [50.5799, 13.0021],
};

export const SAXONY_CENTER: [number, number] = [51.0, 13.4];
export const SAXONY_ZOOM = 9;

export function getCityCoords(city: string | null): [number, number] | null {
  if (!city) return null;
  const normalized = city.trim();
  if (SAXONY_CITY_COORDS[normalized]) return SAXONY_CITY_COORDS[normalized];
  const lower = normalized.toLowerCase();
  for (const [key, coords] of Object.entries(SAXONY_CITY_COORDS)) {
    if (key.toLowerCase() === lower) return coords;
  }
  return null;
}
