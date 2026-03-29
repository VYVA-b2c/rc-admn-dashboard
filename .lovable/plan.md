

## Plan: Transform Dashboard into a GIS Command Center for DRK Saxony

### What We're Building

Replace the current stat-cards-and-bar-chart dashboard with a **map-centric GIS dashboard** focused on Red Cross operations in Saxony. The map will be the primary element, showing user locations, sensor alerts, and check-in status geographically. Summary stats and alert feeds will surround the map.

### Technical Approach

**Map library:** `react-leaflet` + `leaflet` (free, no API key needed, uses OpenStreetMap tiles). We'll add a Red Cross-themed tile layer.

**Geocoding:** Since users have `city`, `street`, `house_number`, `post_code` fields, we'll use a static coordinate lookup for known Saxon cities (Dresden, Leipzig, Chemnitz, Zwickau, Plauen, Görlitz, Bautzen, Freiberg, Pirna, Meissen) to place markers. No external geocoding API needed for the demo data.

### Layout

```text
┌──────────────────────────────────────────────┐
│  DRK Saxony GIS Command Center               │
├────────┬────────┬────────┬────────┬──────────┤
│ Users  │Checkins│ Alerts │Sensors │Caregivers│  ← compact stat row
├────────┴────────┴────────┴────────┴──────────┤
│                                              │
│          Interactive Map (Saxony)             │
│   - Colored markers per user                 │
│   - Red = critical alert                     │
│   - Orange = warning                         │
│   - Green = stable                           │
│   - Click marker → popup with user summary   │
│                                              │
├─────────────────────┬────────────────────────┤
│  Active Alerts Feed │  City Distribution     │
│  (scrollable list)  │  (bar chart)           │
└─────────────────────┴────────────────────────┘
```

### Files Changed

1. **Install dependencies:** `leaflet`, `react-leaflet`, `@types/leaflet`

2. **`src/pages/Dashboard.tsx`** — Full rewrite:
   - Large interactive Leaflet map centered on Saxony (~51.0°N, 13.4°E, zoom 9)
   - Fetch users + alerts + sensors + checkins
   - Place circle markers colored by risk level (critical/warning/stable)
   - Click marker shows popup: name, city, active alerts count, check-in status
   - Keep stat cards row (compact) above map
   - Active alerts feed and city chart below map

3. **`src/hooks/useDashboardStats.ts`** — Extend to also return per-user alert counts and sensor status for map markers

4. **`src/index.css`** — Add Leaflet CSS import

5. **City coordinates helper** — A small utility mapping Saxon city names to lat/lng for marker placement

### Map Features
- Custom Red Cross-styled markers (red cross icon or colored circles)
- Marker clustering when zoomed out
- Popup on click with user name, alert status, link to profile
- Map defaults to Saxony region bounds

### Build Order
1. Install leaflet + react-leaflet
2. Add Leaflet CSS
3. Create city coordinates utility
4. Rewrite Dashboard.tsx with map + surrounding panels
5. Update useDashboardStats to include per-user geo data

