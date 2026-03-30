import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import type { GISUser } from "@/hooks/useGISData";
import { SAXONY_CENTER, SAXONY_ZOOM } from "@/lib/saxonyCities";

type GISMappableUser = GISUser & { coords: [number, number] };

interface GISMapProps {
  users: GISUser[];
  onUserClick?: (user: GISUser) => void;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function getStatusColor(user: GISUser): string {
  if (user.criticalAlerts > 0) return "#dc2626";
  if (user.activeAlerts > 0) return "#f59e0b";
  return "#22c55e";
}

function createUserIcon(user: GISUser): L.DivIcon {
  const color = getStatusColor(user);
  const score = user.riskScore ?? 0;

  return L.divIcon({
    className: "",
    iconSize: [26, 32],
    iconAnchor: [13, 32],
    popupAnchor: [0, -32],
    html: `
      <div style="position:relative; width:26px; height:32px; cursor:pointer;">
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

  // Determine worst status color
  let hasCritical = false;
  let hasWarning = false;
  for (const m of markers) {
    const user = (m as any)._gisUser as GISUser | undefined;
    if (user?.criticalAlerts && user.criticalAlerts > 0) { hasCritical = true; break; }
    if (user?.activeAlerts && user.activeAlerts > 0) hasWarning = true;
  }

  const bg = hasCritical ? "#dc2626" : hasWarning ? "#f59e0b" : "#22c55e";

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

export function GISMap({ users, onUserClick }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  const mappableUsers = useMemo(
    () => users.filter((u): u is GISMappableUser => u.coords !== null),
    [users],
  );

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
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    if (!map || !cluster) return;

    cluster.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const user of mappableUsers) {
      const marker = L.marker(user.coords, { icon: createUserIcon(user) });
      (marker as any)._gisUser = user;

      marker.bindTooltip(
        `<strong>${user.first_name} ${user.last_name}</strong><br/>${user.city ?? "Unknown"}`,
        { direction: "top", offset: [0, -32], className: "gis-tooltip" },
      );

      marker.on("click", () => onUserClick?.(user));

      cluster.addLayer(marker);
      bounds.extend(user.coords);
    }

    if (mappableUsers.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
    } else if (mappableUsers.length === 1) {
      map.setView(mappableUsers[0].coords, 10);
    } else {
      map.setView(SAXONY_CENTER, SAXONY_ZOOM);
    }
  }, [mappableUsers, onUserClick]);

  return <div ref={containerRef} className="relative z-0 h-[420px] w-full bg-muted/30" aria-label="GIS map of users in Saxony" />;
}
