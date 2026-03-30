

## Plan: Advanced Live Map Enhancements

### What's Already Done
- Markers colored by alert status (red/orange/green) with risk scores inside
- Clustering with worst-status color
- Search + status + city filters
- Click opens Intervention Panel with full user details + quick actions
- Hover tooltip with name + city

### What's Missing (Gaps to Close)

**A. Pulsing animation for critical markers**
Add a CSS `@keyframes` pulse animation in `index.css`. Update `createUserIcon` in `GISMap.tsx` to wrap critical markers in a pulsing outer ring.

**B. Risk level filter**
The current "Status" filter uses alert-based categories (critical/warning/stable). Add a separate "Risk Level" filter dropdown: High (80+), Moderate (50-79), Low (20-49), Stable (0-19). This filters `filteredUsers` by `riskScore` band.

**C. Richer marker popup (mini user card)**
Replace the simple tooltip with a Leaflet popup that shows: name, risk score badge, city, last check-in status, sensor count, and two quick-action links ("Call" + "View"). The popup renders as styled HTML within Leaflet's native popup system.

**D. Use risk-based colors instead of alert-based**
Update `getStatusColor` in `GISMap.tsx` to use `getRiskColor(user.riskScore)` from `riskScore.ts` instead of the current alert-count logic. This makes markers truly risk-colored (red/orange/yellow/green on 4 bands) and aligns map, list, and panel visuals.

**E. Cluster risk-based coloring**
Update `createClusterIcon` to use the highest risk score among child markers rather than just checking for critical/warning alerts.

### Files
- **Modified**: `src/index.css` — add pulse keyframes for critical markers
- **Modified**: `src/components/dashboard/GISMap.tsx` — risk-based colors, pulse animation, richer popup with mini card + quick actions, risk-based cluster colors
- **Modified**: `src/pages/Dashboard.tsx` — add risk level filter dropdown

### No database changes needed.

