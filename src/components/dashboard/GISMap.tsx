import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.heat";
import type { GISFieldStaff, GISOffice, GISUser } from "@/hooks/useGISData";
import { SAXONY_CENTER, SAXONY_ZOOM } from "@/lib/saxonyCities";
import { getRiskBand, getRiskColor, getRiskLabel } from "@/lib/riskScore";

type GISMappableUser = GISUser & { coords: [number, number] };
type GISMappableStaff = GISFieldStaff & { coords: [number, number] };
type GISUserMarker = L.Marker & { _gisUser?: GISUser };

interface GISMapProps {
  users: GISUser[];
  offices?: GISOffice[];
  fieldStaff?: GISFieldStaff[];
  onUserClick?: (user: GISUser) => void;
  heatmapMode?: boolean;
  showUsers?: boolean;
  showOffices?: boolean;
  showFieldStaff?: boolean;
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function escapeHtml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

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
      <div style="position:relative;width:26px;height:32px;cursor:pointer;">
        ${pulseRing}
        <svg width="26" height="32" viewBox="0 0 26 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M13 32C13 32 26 20.4 26 13.1C26 5.86 20.18 0 13 0C5.82 0 0 5.86 0 13.1C0 20.4 13 32 13 32Z" fill="${color}"/>
          <circle cx="13" cy="13" r="8.5" fill="white" fill-opacity="0.95"/>
        </svg>
        <span style="position:absolute;top:5px;left:0;width:26px;text-align:center;font-size:9px;font-weight:800;font-family:Inter,sans-serif;color:${color};line-height:16px;pointer-events:none;">
          ${score}
        </span>
      </div>
    `,
  });
}

function createOfficeIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
    html: `
      <div style="width:30px;height:30px;border-radius:9px;background:#ef2424;border:3px solid #fff;box-shadow:0 6px 18px rgba(15,23,42,.22);display:flex;align-items:center;justify-content:center;color:white;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 21h18"/>
          <path d="M5 21V7l7-4 7 4v14"/>
          <path d="M9 21v-7h6v7"/>
          <path d="M9 9h.01M15 9h.01"/>
        </svg>
      </div>
    `,
  });
}

function staffStatusColor(status: string): string {
  if (status === "busy") return "#f97316";
  if (status === "offline") return "#8a8f9b";
  return "#0ea5e9";
}

function createStaffIcon(staff: GISFieldStaff): L.DivIcon {
  const color = staffStatusColor(staff.status);
  const load = Math.max(0, Math.min(staff.open_cases, 99));

  return L.divIcon({
    className: "",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
    html: `
      <div style="position:relative;width:34px;height:34px;">
        <div style="position:absolute;inset:0;border-radius:50%;background:${color};opacity:.16;"></div>
        <div style="position:absolute;left:5px;top:5px;width:24px;height:24px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 6px 18px rgba(15,23,42,.22);display:flex;align-items:center;justify-content:center;color:white;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21a8 8 0 0 0-16 0"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
        <span style="position:absolute;right:-2px;top:-2px;min-width:16px;height:16px;border-radius:999px;background:#2f3440;color:white;border:2px solid white;font-size:9px;font-weight:800;font-family:Inter,sans-serif;display:flex;align-items:center;justify-content:center;line-height:1;">
          ${load}
        </span>
      </div>
    `,
  });
}

function createClusterIcon(cluster: L.MarkerCluster): L.DivIcon {
  const markers = cluster.getAllChildMarkers();
  const count = markers.length;

  let maxScore = 0;
  for (const marker of markers) {
    const user = (marker as GISUserMarker)._gisUser;
    if (user?.riskScore != null && user.riskScore > maxScore) maxScore = user.riskScore;
  }

  const bg = getRiskColor(maxScore);

  return L.divIcon({
    className: "",
    iconSize: [36, 36],
    html: `
      <div style="width:36px;height:36px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:13px;font-family:Inter,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.25);border:2px solid white;cursor:pointer;">
        ${count}
      </div>
    `,
  });
}

function buildUserPopupHtml(user: GISUser): string {
  const score = user.riskScore ?? 0;
  const color = getRiskColor(score);
  const label = getRiskLabel(score);
  const phone = user.phone ?? "";
  const name = `${user.first_name} ${user.last_name}`;

  return `
    <div style="padding:12px;font-family:Inter,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:12px;">${score}</div>
        <div>
          <div style="font-weight:700;font-size:13px;">${escapeHtml(name)}</div>
          <div style="font-size:11px;color:#6b7280;">${escapeHtml(user.city ?? "Unknown")} - ${escapeHtml(label)}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        ${phone ? `<a href="tel:${escapeHtml(phone)}" style="flex:1;text-align:center;padding:7px 0;background:hsl(252,85%,60%);color:#fff;border-radius:8px;font-size:11px;font-weight:700;text-decoration:none;">Call</a>` : ""}
        <button onclick="document.dispatchEvent(new CustomEvent('gis-view-user',{detail:'${escapeHtml(user.id)}'}))" style="flex:1;text-align:center;padding:7px 0;background:#eef0f7;color:#25283a;border-radius:8px;font-size:11px;font-weight:700;border:none;cursor:pointer;">View</button>
      </div>
    </div>
  `;
}

function buildOfficePopupHtml(office: GISOffice): string {
  const address = [office.address, office.post_code, office.city].filter(Boolean).join(", ");

  return `
    <div style="padding:12px;font-family:Inter,sans-serif;min-width:210px;">
      <div style="font-weight:800;font-size:13px;margin-bottom:4px;">${escapeHtml(office.name)}</div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">${escapeHtml(office.office_type ?? "Office")}</div>
      ${address ? `<div style="font-size:12px;color:#374151;">${escapeHtml(address)}</div>` : ""}
      ${office.phone ? `<a href="tel:${escapeHtml(office.phone)}" style="display:block;margin-top:8px;color:hsl(252,85%,60%);font-size:12px;font-weight:700;text-decoration:none;">${escapeHtml(office.phone)}</a>` : ""}
    </div>
  `;
}

function buildStaffPopupHtml(staff: GISFieldStaff): string {
  const color = staffStatusColor(staff.status);

  return `
    <div style="padding:12px;font-family:Inter,sans-serif;min-width:210px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;"></span>
        <div>
          <div style="font-weight:800;font-size:13px;">${escapeHtml(staff.full_name)}</div>
          <div style="font-size:11px;color:#6b7280;">${escapeHtml(staff.team ?? staff.role ?? "Field staff")}</div>
        </div>
      </div>
      <div style="font-size:12px;color:#374151;">${escapeHtml(staff.status)} - ${staff.open_cases}/${staff.capacity} open cases</div>
      ${staff.phone ? `<a href="tel:${escapeHtml(staff.phone)}" style="display:block;margin-top:8px;color:hsl(252,85%,60%);font-size:12px;font-weight:700;text-decoration:none;">${escapeHtml(staff.phone)}</a>` : ""}
    </div>
  `;
}

export function GISMap({
  users,
  offices = [],
  fieldStaff = [],
  onUserClick,
  heatmapMode = false,
  showUsers = true,
  showOffices = true,
  showFieldStaff = true,
}: GISMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const officeLayerRef = useRef<L.LayerGroup | null>(null);
  const staffLayerRef = useRef<L.LayerGroup | null>(null);
  const heatRef = useRef<L.Layer | null>(null);

  const mappableUsers = useMemo(
    () => users.filter((user): user is GISMappableUser => user.coords !== null),
    [users],
  );

  const mappableStaff = useMemo(
    () => fieldStaff.filter((staff): staff is GISMappableStaff => staff.coords !== null),
    [fieldStaff],
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const userId = (event as CustomEvent).detail;
      const user = users.find((item) => String(item.id) === String(userId));
      if (user) onUserClick?.(user);
    };
    document.addEventListener("gis-view-user", handler);
    return () => document.removeEventListener("gis-view-user", handler);
  }, [users, onUserClick]);

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

    const officeLayer = L.layerGroup().addTo(map);
    const staffLayer = L.layerGroup().addTo(map);

    clusterRef.current = clusterGroup;
    officeLayerRef.current = officeLayer;
    staffLayerRef.current = staffLayer;
    mapRef.current = map;

    requestAnimationFrame(() => map.invalidateSize());

    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      clusterRef.current = null;
      officeLayerRef.current = null;
      staffLayerRef.current = null;
      heatRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const cluster = clusterRef.current;
    const officeLayer = officeLayerRef.current;
    const staffLayer = staffLayerRef.current;
    if (!map || !cluster || !officeLayer || !staffLayer) return;

    if (heatRef.current) {
      map.removeLayer(heatRef.current);
      heatRef.current = null;
    }

    cluster.clearLayers();
    officeLayer.clearLayers();
    staffLayer.clearLayers();

    const bounds = L.latLngBounds([]);
    const extend = (coords: [number, number]) => bounds.extend(coords);

    if (showUsers && heatmapMode) {
      if (map.hasLayer(cluster)) map.removeLayer(cluster);

      const heatPoints: [number, number, number][] = mappableUsers.map((user) => [
        user.coords[0],
        user.coords[1],
        (user.activeAlerts ?? 0) + (user.criticalAlerts ?? 0) + 1,
      ]);

      if (heatPoints.length > 0) {
        const heat = L.heatLayer(heatPoints, {
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

      mappableUsers.forEach((user) => extend(user.coords));
    } else if (showUsers) {
      if (!map.hasLayer(cluster)) map.addLayer(cluster);

      for (const user of mappableUsers) {
        const marker = L.marker(user.coords, { icon: createUserIcon(user) }) as GISUserMarker;
        marker._gisUser = user;
        marker.bindPopup(buildUserPopupHtml(user), {
          className: "gis-popup",
          closeButton: true,
          maxWidth: 260,
        });
        cluster.addLayer(marker);
        extend(user.coords);
      }
    } else if (map.hasLayer(cluster)) {
      map.removeLayer(cluster);
    }

    if (showOffices) {
      for (const office of offices) {
        L.marker(office.coords, { icon: createOfficeIcon() })
          .bindPopup(buildOfficePopupHtml(office), {
            className: "gis-popup",
            closeButton: true,
            maxWidth: 260,
          })
          .addTo(officeLayer);
        extend(office.coords);
      }
    }

    if (showFieldStaff) {
      for (const staff of mappableStaff) {
        L.marker(staff.coords, { icon: createStaffIcon(staff) })
          .bindPopup(buildStaffPopupHtml(staff), {
            className: "gis-popup",
            closeButton: true,
            maxWidth: 260,
          })
          .addTo(staffLayer);
        extend(staff.coords);
      }
    }

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.2), { maxZoom: 10 });
    } else {
      map.setView(SAXONY_CENTER, SAXONY_ZOOM);
    }
  }, [mappableUsers, offices, mappableStaff, heatmapMode, showUsers, showOffices, showFieldStaff]);

  return (
    <div
      ref={containerRef}
      className="relative z-0 h-[420px] w-full bg-muted/30"
      aria-label="Operational GIS map of seniors, offices, and field staff"
    />
  );
}
