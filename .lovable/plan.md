

## Plan: Integrate Backend API for Dashboard Stats

### Overview
Replace the Supabase-based stat queries with a fetch to the external API endpoint. The Dashboard currently gets its stats from `useGISData()` (which queries multiple Supabase tables). We'll update `useGISData` to fetch the top-level stats from the API instead, while keeping the rest of the GIS logic intact for now.

### API
```
GET https://20f8-209-101-30-182.ngrok-free.app/api/v1/dashboard/stats
→ { total_users, checkins_active, active_alerts, sensors, caregivers }
```

### Changes

**1. Create `src/lib/apiClient.ts`**
- Export a `BASE_URL` constant pointing to the ngrok endpoint
- Export a reusable `apiFetch(path)` helper that adds the `ngrok-skip-browser-warning` header (required for ngrok free tier) and handles JSON parsing + error throwing

**2. Update `src/hooks/useGISData.ts`**
- Import `apiFetch` from the new API client
- In the `queryFn`, fetch `/api/v1/dashboard/stats` in parallel with the existing Supabase calls (alerts, users for GIS, etc.)
- Use the API response for the 5 top-level stats: `totalUsers`, `checkinsEnabled`, `activeAlertCount`, `totalSensors`, `caregiversLinked`
- Keep existing Supabase queries for GIS user positions, alerts list, city distribution, and risk scoring (these aren't served by this endpoint yet)

**3. Clean up `src/hooks/useDashboardStats.ts`**
- This hook is not imported anywhere. Delete it to avoid confusion since the dashboard stats now come from the API via `useGISData`.

### Files
- **New**: `src/lib/apiClient.ts`
- **Modified**: `src/hooks/useGISData.ts`
- **Deleted**: `src/hooks/useDashboardStats.ts`

### No database changes needed.

