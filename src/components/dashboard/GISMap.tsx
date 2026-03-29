import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import type { GISUser } from "@/hooks/useGISData";
import { SAXONY_CENTER, SAXONY_ZOOM } from "@/lib/saxonyCities";

type GISMappableUser = GISUser & {
  coords: [number, number];
};

interface GISMapProps {
  users: GISUser[];
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function getMarkerColor(user: GISUser): string {
  if (user.criticalAlerts > 0) return "hsl(var(--destructive))";
  if (user.activeAlerts > 0) return "hsl(var(--accent))";
  return "hsl(var(--secondary))";
}

function getMarkerRadius(user: GISUser): number {
  if (user.criticalAlerts > 0) return 10;
  if (user.activeAlerts > 0) return 8;
  return 6;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopupContent(user: GISMappableUser): string {
  const fullName = escapeHtml(`${user.first_name} ${user.last_name}`);
  const city = escapeHtml(user.city ?? "Unknown city");
  const phone = user.phone ? `<p style="margin:0 0 6px; font-size:12px; color:hsl(var(--foreground));">${escapeHtml(user.phone)}</p>` : "";
  const critical = user.criticalAlerts > 0 ? `${user.criticalAlerts} critical · ` : "";
  const alerts = user.activeAlerts > 0 ? `${user.activeAlerts} active alerts` : "No active alerts";
  const profileHref = `/users/${encodeURIComponent(user.id)}`;

  return `
    <div style="min-width:190px; font-family:Inter, sans-serif; color:hsl(var(--foreground));">
      <p style="margin:0 0 4px; font-size:14px; font-weight:600;">${fullName}</p>
      <p style="margin:0 0 6px; font-size:12px; color:hsl(var(--muted-foreground));">${city}</p>
      ${phone}
      <p style="margin:0; font-size:12px; color:hsl(var(--muted-foreground));">${critical}${alerts}</p>
      <p style="margin:4px 0 0; font-size:12px; color:hsl(var(--muted-foreground));">
        ${user.sensorCount} sensor${user.sensorCount === 1 ? "" : "s"} · Check-in ${user.checkinEnabled ? "enabled" : "off"}
      </p>
      <a href="${profileHref}" style="display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:hsl(var(--primary)); text-decoration:none;">
        View Profile →
      </a>
    </div>
  `;
}

export function GISMap({ users }: GISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const mappableUsers = useMemo(
    () => users.filter((user): user is GISMappableUser => user.coords !== null),
    [users]
  );

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView(SAXONY_CENTER, SAXONY_ZOOM);

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 18,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    requestAnimationFrame(() => {
      map.invalidateSize();
    });

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const markersLayer = markersLayerRef.current;

    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    const bounds = L.latLngBounds([]);

    for (const user of mappableUsers) {
      const markerColor = getMarkerColor(user);
      const marker = L.circleMarker(user.coords, {
        radius: getMarkerRadius(user),
        color: markerColor,
        fillColor: markerColor,
        fillOpacity: 0.85,
        weight: 2,
      });

      marker.bindPopup(buildPopupContent(user));
      marker.addTo(markersLayer);
      bounds.extend(user.coords);
    }

    if (mappableUsers.length > 1 && bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
      return;
    }

    if (mappableUsers.length === 1) {
      map.setView(mappableUsers[0].coords, 10);
      return;
    }

    map.setView(SAXONY_CENTER, SAXONY_ZOOM);
  }, [mappableUsers]);

  return <div ref={containerRef} className="h-[420px] w-full bg-muted/30" aria-label="GIS map of users in Saxony" />;
}
