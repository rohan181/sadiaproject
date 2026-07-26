"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection } from "geojson";
import { CircleMarker, GeoJSON, MapContainer, Popup, TileLayer } from "react-leaflet";

type Facility = { id: number; lat: number; lon: number; tags?: Record<string, string> };
type Boundary = FeatureCollection;
const QUERY = `[out:json][timeout:35];nwr["amenity"~"^(hospital|clinic)$"](20.55,88.0,26.65,92.75);out center tags;`;

export function RealFacilityMap() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [boundary, setBoundary] = useState<Boundary | null>(null);
  const [filter, setFilter] = useState<"all" | "hospital" | "clinic">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/bangladesh-boundary.geojson", { signal: controller.signal }).then((r) => r.json()),
      fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(QUERY)}`, { signal: controller.signal }).then((r) => { if (!r.ok) throw new Error("Overpass request failed"); return r.json(); }),
    ]).then(([shape, data]) => {
      setBoundary(shape);
      setFacilities(data.elements.map((item: Facility & { center?: { lat: number; lon: number } }) => ({ ...item, lat: item.lat ?? item.center?.lat, lon: item.lon ?? item.center?.lon })).filter((item: Facility) => Number.isFinite(item.lat) && Number.isFinite(item.lon)));
    }).catch((reason) => { if (reason?.name !== "AbortError") setError(true); }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const visible = useMemo(() => filter === "all" ? facilities : facilities.filter((item) => item.tags?.amenity === filter), [facilities, filter]);
  return <section className="realMapSection" aria-labelledby="real-map-title">
    <div className="realMapHeader"><div><p className="eyebrow">Observed locations • OpenStreetMap</p><h2 id="real-map-title">Live healthcare facility map</h2><p>Pan and zoom the real basemap. Tap a mapped hospital or clinic for its recorded details.</p></div><div className="realMapFilters"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>All</button><button className={filter === "hospital" ? "active" : ""} onClick={() => setFilter("hospital")}>Hospitals</button><button className={filter === "clinic" ? "active" : ""} onClick={() => setFilter("clinic")}>Clinics</button></div></div>
    <div className="leafletWrap"><MapContainer center={[23.75, 90.35]} zoom={7} minZoom={6} maxZoom={17} scrollWheelZoom className="leafletMap"><TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{boundary && <GeoJSON data={boundary} style={{ color: "#075d55", weight: 2, fillOpacity: .02 }} />}{visible.map((f) => <CircleMarker key={f.id} center={[f.lat, f.lon]} radius={f.tags?.amenity === "hospital" ? 5 : 3.5} pathOptions={{ color: "#fff", weight: 1, fillColor: f.tags?.amenity === "hospital" ? "#d65343" : "#087c71", fillOpacity: .9 }}><Popup><div className="facilityPopup"><b>{f.tags?.name ?? f.tags?.["name:bn"] ?? "Unnamed mapped facility"}</b><span>{f.tags?.amenity === "hospital" ? "Hospital" : "Clinic"}</span>{f.tags?.operator && <small>Operator: {f.tags.operator}</small>}{f.tags?.phone && <small>{f.tags.phone}</small>}<a href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lon}#map=16/${f.lat}/${f.lon}`} target="_blank" rel="noreferrer">Open source record ↗</a></div></Popup></CircleMarker>)}</MapContainer><div className="realMapCount">{loading ? "Loading observed facilities…" : error ? "Live facility feed unavailable" : <><b>{visible.length.toLocaleString()}</b> mapped facilities shown</>}</div></div>
    <div className="realMapFoot"><span><i className="hospitalKey" /> Hospital</span><span><i className="clinicKey" /> Clinic</span><b>Live OSM query • not simulated</b></div>
  </section>;
}
