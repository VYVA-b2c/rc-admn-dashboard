import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
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
  const initials = `${(user.first_name?.[0] ?? "").toUpperCase()}${(user.last_name?.[0] ?? "").toUpperCase()}`;

  return L.divIcon({
    className: "",
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -44],
    html: `
      <div style="position:relative; width:36px; height:44px; cursor:pointer;">
        <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M18 44C18 44 36 28 36 18C36 8.059 27.941 0 18 0C8.059 0 0 8.059 0 18C0 28 18 44 18 44Z" fill="${color}"/>
          <circle cx="18" cy="18" r="12" fill="white" fill-opacity="0.95"/>
        </svg>
        <span style="position:absolute; top:8px; left:0; width:36px; text-align:center; font-size:11px; font-weight:700; font-family:Inter,sans-serif; color:${color}; line-height:20px; pointer-events:none;">
          ${initials}
        </span>
      </div>
    `,
  });
}

export function GISMap({ users, onUserClick }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

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

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds = L.latLngBounds([]);

    for (const user of mappableUsers) {
      const marker = L.marker(user.coords, { icon: createUserIcon(user) });

      // Tooltip on hover
      marker.bindTooltip(
        `<strong>${user.first_name} ${user.last_name}</strong><br/>${user.city ?? "Unknown"}`,
        { direction: "top", offset: [0, -44], className: "gis-tooltip" },
      );

      // Click → open modal
      marker.on("click", () => onUserClick?.(user));

      marker.addTo(layer);
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
