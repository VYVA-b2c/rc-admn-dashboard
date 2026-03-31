import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";
import type { GISUser } from "@/hooks/useGISData";
import { SAXONY_CENTER, SAXONY_ZOOM } from "@/lib/saxonyCities";
import { getRiskColor, getRiskBand, getRiskLabel } from "@/lib/riskScore";

type GISMappableUser = GISUser & { coords: [number, number] };

interface GISMapProps {
  users: GISUser[];
  onUserClick?: (user: GISUser) => void;
  heatmapMode?: boolean;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function createUserIcon(user: GISUser): L.DivIcon {
  const score = user.riskScore ?? 0;
  const color = getRiskColor(score);
  const band = getRiskBand(score);
  const isCritical = band === "high";

  const pulseRing = isCritical
    ? `<div style="position:absolute;top:-4px;left:-4px;width:34px;height:34px;border-radius:50%;border:3px solid ${color};" class="marker-pulse-ring"></div>`
    : "";

  return L.divIcon({
    className: "",
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -34],
    html: `
      <div style="position:relative; width:26px; height:32px; cursor:pointer;">
        ${pulseRing}
        <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 32C13 32 26 20.4 26 13.1C26 5.86 20.18 0 13 0C5.82 0 0 5.86 0 13.1C0 20.4 13 32 13 32Z" fill="${color}"/>
          <circle cx="13" cy="13" r="8.5" fill="white" fill-opacity="0.95"/>
        </svg>
        <span style="position:absolute; top:5px; left:0; width:26px; text-align:center; font-size:9px; font-weight:700; font-family:Inter,sans-serif; color:${color}; line-height:16px; pointer-events:none;">
          ${score}
        </span>
      </div>
    `,
  });
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const markers = cluster.getAllChildMarkers();
  const count = markers.length;

  let maxScore = 0;
  for (const m of markers) {
    const user = (m as any)._gisUser as GISUser | undefined;
    if (user?.riskScore != null && user.riskScore > maxScore) maxScore = user.riskScore;
  }

  const bg = getRiskColor(maxScore);

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    html: `
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white;cursor:pointer;">
        ${count}
      </div>
    `,
  });
}

function buildPopupHtml(user: GISUser): string {
  const score = user.riskScore ?? 0;
  const color = getRiskColor(score);
  const label = getRiskLabel(score);
  const phone = user.phone ?? "";

  return `
    <div style="padding:12px;font-family:Inter,sans-serif;min-width:200px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;">${score}</div>
        <div>
          <div style="font-weight:600;font-size:13px;">${user.first_name} ${user.last_name}</div>
          <div style="font-size:11px;color:#888;">${user.city ?? "Unknown"} · ${label}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${phone ? `<a href="tel:${phone}" style="flex:1;text-align:center;padding:6px 0;background:hsl(252,85%,60%);color:#fff;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;">📞 Call</a>` : ""}
        <button onclick="document.dispatchEvent(new CustomEvent('gis-view-user',{detail:'${user.id}'}))" style="flex:1;text-align:center;padding:6px 0;background:hsl(220,15%,93%);color:hsl(225,25%,12%);border-radius:6px;font-size:11px;font-weight:600;border:none;cursor:pointer;">👤 View</button>
      </div>
    </div>
  `;
}

export function GISMap({ users, onUserClick, heatmapMode = false }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);

  const mappableUsers = useMemo(
    () => users.filter((u): u is GISMappableUser => u.coords !== null),
    [users],
  );

  // Listen for "View" button clicks from popups
  useEffect(() => {
    const handler = (e: Event) => {
      const userId = (e as CustomEvent).detail;
      const user = users.find((u) => String(u.id) === String(userId));
      if (user) onUserClick?.(user);
    };
    document.addEventListener("gis-view-user", handler);
    return () => document.removeEventListener("gis-view-user", handler);
  }, [users, onUserClick]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(SAXONY_CENTER, SAXONY_ZOOM);

    L.tileLayer(TILE_URL, { attribution: TILE_ATTRIBUTION, maxZoom: 18 }).addTo(map);

    const clusterGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: createClusterIcon,
    });
    map.addLayer(clusterGroup);

    clusterRef.current = clusterGroup;
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      heatRef.current = null;
    };
  }, []);

  // Sync markers & heatmap
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    // Remove old heat layer if exists
    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    cluster.clearLayers();

    const bounds = L.latLngBounds([]);

    if (heatmapMode) {
      // Hide clusters, show heatmap
      if (map.hasLayer(cluster)) map.removeLayer(cluster);

      const heatPoints: [number, number, number][] = mappableUsers.map((u) => [
        u.coords[0],
        u.coords[1],
        (u.activeAlerts ?? 0) + (u.criticalAlerts ?? 0) + 1,
      ]);

      if (heatPoints.length > 0) {
        const heat = (L as any).heatLayer(heatPoints, {
          radius: 30,
          blur: 20,
          maxZoom: 12,
          max: 10,
          gradient: {
            0.2: "#22c55e",
            0.4: "#eab308",
            0.7: "#f97316",
            1.0: "#ef4444",
          },
        });
        heat.addTo(map);
        heatRef.current = heat;
      }

      for (const user of mappableUsers) {
        bounds.extend(user.coords);
      }
    } else {
      // Show clusters
      if (!map.hasLayer(cluster)) map.addLayer(cluster);

      for (const user of mappableUsers) {
        const marker = L.marker(user.coords, { icon: createUserIcon(user) });
        (marker as any)._gisUser = user;

        marker.bindPopup(buildPopupHtml(user), {
          className: "gis-popup",
          closeButton: true,
          maxWidth: 260,
        });

        

        cluster.addLayer(marker);
        bounds.extend(user.coords);
      }
    }

    if (mappableUsers.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
    } else if (mappableUsers.length === 1) {
      map.setView(mappableUsers[0].coords, 10);
    } else {
      map.setView(SAXONY_CENTER, SAXONY_ZOOM);
    }
  }, [mappableUsers, onUserClick, heatmapMode]);

  return <div ref={containerRef} className="relative z-0 h-[420px] w-full bg-muted/30" aria-label="GIS map of users in Saxony" />;
}
