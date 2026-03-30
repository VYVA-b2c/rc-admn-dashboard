

## Plan: Heatmap Toggle for Intervention Frequency

### Overview
Add a toggle button above the map that switches between the current marker/cluster view and a heatmap layer visualizing intervention density by geographic area. The heatmap uses `leaflet.heat` to render intensity based on how many alerts/interventions each location has.

### Changes

**1. Install `leaflet.heat`**
Add `leaflet-heat` package (provides `L.heatLayer`). Add type declaration since it has no @types package.

**2. Add type declaration (`src/types/leaflet-heat.d.ts`)**
Declare the `L.heatLayer` extension on the Leaflet namespace.

**3. Update `src/components/dashboard/GISMap.tsx`**
- Accept new prop `heatmapMode: boolean`
- When `heatmapMode` is true:
  - Hide the marker cluster layer
  - Show a heat layer where each user's coordinates are weighted by their `activeAlerts + criticalAlerts` count (minimum weight 1 so all users appear)
  - Gradient: green → yellow → orange → red
- When toggled off, remove heat layer and restore clusters
- The heat layer data points are: `[lat, lng, intensity]` where intensity = `user.activeAlerts + user.criticalAlerts + 1`

**4. Update `src/pages/Dashboard.tsx`**
- Add a `heatmapMode` state boolean (default false)
- Add a toggle button in the filter bar (next to existing filters) using the `Flame` lucide icon
- Label: "Heatmap" — styled as a toggle button (outlined when off, filled when on)
- Pass `heatmapMode` prop to `<GISMap>`

### No database changes needed.

### Files
- **New**: `src/types/leaflet-heat.d.ts`
- **Modified**: `src/components/dashboard/GISMap.tsx`, `src/pages/Dashboard.tsx`
- **Package**: `leaflet-heat`

