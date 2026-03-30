

## Plan: Smaller Pins + Marker Clustering

### Changes

**1. Install `leaflet.markercluster`**
- Add `leaflet.markercluster` package (provides `L.markerClusterGroup`)
- Import its CSS for default cluster styling

**2. Shrink pin icons (`GISMap.tsx`)**
- Reduce `iconSize` from `[36, 44]` to `[26, 32]`
- Scale SVG viewBox, circle radius, font size, and anchors accordingly

**3. Add marker clustering (`GISMap.tsx`)**
- Replace `L.layerGroup()` with `L.markerClusterGroup()` with custom options (max cluster radius, disable spiderfying at low counts, custom cluster icon showing count + color based on worst status in cluster)
- Import MarkerCluster CSS in the component or `index.css`

**4. Custom cluster icons**
- Color clusters by worst status inside: red if any critical, amber if any warning, green otherwise
- Show user count in the cluster bubble

### Technical Details

- `leaflet.markercluster` works with vanilla Leaflet (no React wrapper needed) — fully compatible with current setup
- The `markersLayerRef` type changes from `L.LayerGroup` to `L.MarkerClusterGroup`
- Cluster CSS will be imported via `@import` in `index.css` alongside the existing leaflet CSS

### Files Modified
- `package.json` — add `leaflet.markercluster`
- `src/components/dashboard/GISMap.tsx` — smaller icons + cluster group
- `src/index.css` — import MarkerCluster CSS

