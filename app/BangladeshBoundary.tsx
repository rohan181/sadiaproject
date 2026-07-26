"use client";

import { useEffect, useMemo, useState } from "react";

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type BoundaryData = { features: Array<{ geometry: Geometry; properties?: { shapeName?: string } }> };

const palettes: Record<string, string[]> = {
  surface: ["#d9eee6", "#8bc9b5", "#efc55d", "#df7259"], difference: ["#d8edf1", "#82b8c5", "#efb75a", "#d95848"], catchment: ["#e4f1ed", "#b4dccc", "#61ad94", "#167b69"], e2sfca: ["#dfefe9", "#9bcdbb", "#4d9c84", "#176956"], underserved: ["#f7e2dd", "#edb09f", "#df765f", "#b94439"], hotspot: ["#d7e7f3", "#86add0", "#ef9c82", "#d4473c"], lisa: ["#4f78b7", "#9bbadd", "#efb09d", "#d5534a"], facility: ["#f5ded8", "#efb6a6", "#9dd5c4", "#268d76"], flood: ["#dceced", "#91c0c5", "#e5a326", "#d65143"], service: ["#9fcfc0", "#719fc4", "#a77bad", "#2e7d70"], equity: ["#e8e0ef", "#c0a3d0", "#8c69a8", "#5b3d76"], priority: ["#e3ede9", "#f0c767", "#df8555", "#9e352f"], flow: ["#dceee8", "#a6d1c3", "#e6ae4a", "#cc5a46"], swipe: ["#7fc1ad", "#b7d7cc", "#efa58e", "#d65c49"], isochrone: ["#dcefe9", "#a8d8c8", "#65b49c", "#1d806d"],
};

function mapFill(name: string, mode?: string) {
  const score = name.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0) % 100;
  const palette = palettes[mode ?? "surface"] ?? palettes.surface;
  return { color: palette[Math.min(3, Math.floor(score / 25))], score };
}

export function BangladeshBoundary({ compact = false, interactive = false, level = "district", analysisMode, zoom = 1, selectedDistrict, selectedSubdistrict, onDistrictSelect, onSubdistrictSelect }: { compact?: boolean; interactive?: boolean; level?: "district" | "subdistrict"; analysisMode?: string; zoom?: number; selectedDistrict?: string | null; selectedSubdistrict?: string | null; onDistrictSelect?: (name: string) => void; onSubdistrictSelect?: (name: string) => void }) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [divisions, setDivisions] = useState<Geometry[]>([]);
  const [districts, setDistricts] = useState<Array<{ name: string; geometry: Geometry }>>([]);

  useEffect(() => {
    Promise.all([
      fetch("/bangladesh-boundary.geojson").then((response) => response.json()),
      fetch("/bangladesh-divisions.geojson").then((response) => response.json()),
      interactive ? fetch(level === "subdistrict" ? "/bangladesh-subdistricts.geojson" : "/bangladesh-districts.geojson").then((response) => response.json()) : Promise.resolve({ features: [] }),
    ])
      .then(([country, admin, districtData]: [BoundaryData, BoundaryData, BoundaryData]) => {
        setGeometry(country.features[0]?.geometry ?? null);
        setDivisions(admin.features.map((feature) => feature.geometry));
        setDistricts(districtData.features.map((feature) => ({ name: feature.properties?.shapeName ?? "District", geometry: feature.geometry })));
      })
      .catch(() => setGeometry(null));
  }, [interactive, level]);

  const paths = useMemo(() => {
    if (!geometry) return { outline: "", divisions: [] as string[], districts: [] as Array<{ name: string; path: string }> };
    const countryPolygons: Position[][][] = geometry.type === "Polygon" ? [geometry.coordinates as Position[][]] : geometry.coordinates as Position[][][];
    const points = countryPolygons.flat(2);
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const width = 300, height = 350, padding = 6;
    const project = ([lon, lat]: Position) => [
      padding + ((lon - minLon) / (maxLon - minLon)) * (width - padding * 2),
      padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2),
    ];
    const makePath = (item: Geometry) => {
      const polygons: Position[][][] = item.type === "Polygon" ? [item.coordinates as Position[][]] : item.coordinates as Position[][][];
      return polygons.map((polygon) => polygon.map((ring) => ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
      }).join(" ") + " Z").join(" ")).join(" ");
    };
    return { outline: makePath(geometry), divisions: divisions.map(makePath), districts: districts.map((district) => ({ name: district.name, path: makePath(district.geometry) })) };
  }, [geometry, divisions, districts]);

  return <svg className={compact ? "realBoundary compact" : "realBoundary"} style={{ transform: `translate(-50%, -50%) scale(${zoom})` }} viewBox="0 0 300 350" role="img" aria-label="Accurate interactive administrative map of Bangladesh">
    <path className="countryFill" d={paths.outline} fillRule="evenodd" />
    {interactive && paths.districts.map((district) => { const selected = level === "subdistrict" ? selectedSubdistrict === district.name : selectedDistrict === district.name; const select = () => level === "subdistrict" ? onSubdistrictSelect?.(district.name) : onDistrictSelect?.(district.name); const thematic = mapFill(district.name, analysisMode); return <path className={`${level === "subdistrict" ? "subdistrictLine" : "districtLine"} thematic ${selected ? "selected" : ""}`} style={selected ? undefined : { fill: thematic?.color }} d={district.path} key={district.name} role="button" tabIndex={0} aria-label={`Select ${district.name} ${level}; model index ${thematic?.score ?? 0}`} onClick={select} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(); }}><title>{district.name} • {analysisMode ?? "boundary"} model index {thematic?.score ?? 0}</title></path>; })}
    {!compact && paths.divisions.map((path, index) => <path className="divisionLine" d={path} key={index} fillRule="evenodd" />)}
  </svg>;
}
