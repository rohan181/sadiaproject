"use client";

import { useEffect, useMemo, useState } from "react";

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type BoundaryData = { features: Array<{ geometry: Geometry; properties?: { shapeName?: string } }> };

export type UpazilaAccess = {
  mean_travel_minutes: number | null;
  underserved_percent: number | null;
  gi_zscore: number | null;
  gi_pvalue: number | null;
  lisa_quadrant: number | null;
};

const palettes: Record<string, string[]> = {
  surface: ["#d9eee6", "#8bc9b5", "#efc55d", "#df7259"], difference: ["#d8edf1", "#82b8c5", "#efb75a", "#d95848"], catchment: ["#e4f1ed", "#b4dccc", "#61ad94", "#167b69"], e2sfca: ["#dfefe9", "#9bcdbb", "#4d9c84", "#176956"], underserved: ["#f7e2dd", "#edb09f", "#df765f", "#b94439"], hotspot: ["#d7e7f3", "#86add0", "#ef9c82", "#d4473c"], lisa: ["#4f78b7", "#9bbadd", "#efb09d", "#d5534a"], facility: ["#f5ded8", "#efb6a6", "#9dd5c4", "#268d76"], flood: ["#dceced", "#91c0c5", "#e5a326", "#d65143"], service: ["#9fcfc0", "#719fc4", "#a77bad", "#2e7d70"], equity: ["#e8e0ef", "#c0a3d0", "#8c69a8", "#5b3d76"], priority: ["#e3ede9", "#f0c767", "#df8555", "#9e352f"], flow: ["#dceee8", "#a6d1c3", "#e6ae4a", "#cc5a46"], swipe: ["#7fc1ad", "#b7d7cc", "#efa58e", "#d65c49"], isochrone: ["#dcefe9", "#a8d8c8", "#65b49c", "#1d806d"],
};

const NO_DATA_FILL = "#e4e4e0";

// Modes with a real per-upazila metric computed by the pipeline (see
// pipeline/scripts/spatial_statistics.py). Every other mode has no verified
// output yet and keeps the flat placeholder fill rather than inventing one.
const REAL_METRIC_FIELD: Partial<Record<string, keyof UpazilaAccess>> = {
  surface: "mean_travel_minutes",
  underserved: "underserved_percent",
  hotspot: "gi_zscore",
};

function quantileBreaks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return [at(0.25), at(0.5), at(0.75)];
}

function bucketOf(value: number, breaks: number[]) {
  if (value <= breaks[0]) return 0;
  if (value <= breaks[1]) return 1;
  if (value <= breaks[2]) return 2;
  return 3;
}

// esda's Moran_Local quadrant convention: 1=HH, 2=LH, 3=LL, 4=HL. Our metric
// (underserved_percent) is "higher is worse", so HH (a cluster of
// underserved areas) gets the worst color and LL the best.
const LISA_BUCKET: Record<number, number> = { 1: 3, 2: 1, 3: 0, 4: 2 };
const LISA_LABEL: Record<number, string> = { 1: "High-High cluster", 2: "Low-High outlier", 3: "Low-Low cluster", 4: "High-Low outlier" };

function mapFill(mode?: string) {
  const palette = palettes[mode ?? "surface"] ?? palettes.surface;
  return palette[0];
}

export function BangladeshBoundary({ compact = false, interactive = false, level = "district", analysisMode, zoom = 1, selectedDistrict, selectedSubdistrict, onDistrictSelect, onSubdistrictSelect, accessByName }: { compact?: boolean; interactive?: boolean; level?: "district" | "subdistrict"; analysisMode?: string; zoom?: number; selectedDistrict?: string | null; selectedSubdistrict?: string | null; onDistrictSelect?: (name: string) => void; onSubdistrictSelect?: (name: string) => void; accessByName?: Record<string, UpazilaAccess> }) {
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

  const field = level === "subdistrict" ? REAL_METRIC_FIELD[analysisMode ?? ""] : undefined;
  const breaks = useMemo(() => {
    if (!field || !accessByName) return null;
    const values = Object.values(accessByName)
      .map((record) => record[field])
      .filter((value): value is number => value != null);
    return values.length ? quantileBreaks(values) : null;
  }, [field, accessByName]);

  function thematicInfo(name: string): { fill: string; label: string } {
    if (!accessByName) return { fill: mapFill(analysisMode), label: "analysis output pending verified routing" };
    const record = accessByName[name];
    if (analysisMode === "lisa") {
      if (!record || record.lisa_quadrant == null) return { fill: NO_DATA_FILL, label: "no modeled route" };
      const palette = palettes.lisa;
      return { fill: palette[LISA_BUCKET[record.lisa_quadrant] ?? 0], label: LISA_LABEL[record.lisa_quadrant] ?? "unclassified" };
    }
    if (analysisMode === "hotspot") {
      if (!record || record.gi_zscore == null || !breaks) return { fill: NO_DATA_FILL, label: "no modeled route" };
      if ((record.gi_pvalue ?? 1) > 0.05) return { fill: palettes.hotspot[0], label: `Gi* z=${record.gi_zscore.toFixed(2)}, not significant (p=${record.gi_pvalue?.toFixed(3)})` };
      const bucket = bucketOf(record.gi_zscore, breaks);
      return { fill: palettes.hotspot[bucket], label: `Gi* z=${record.gi_zscore.toFixed(2)}, p=${record.gi_pvalue?.toFixed(3)}` };
    }
    if (field) {
      const value = record?.[field];
      if (value == null || !breaks) return { fill: NO_DATA_FILL, label: "no modeled route (isolated network segment)" };
      const bucket = bucketOf(value, breaks);
      const unit = field === "mean_travel_minutes" ? "min mean travel time" : "% underserved";
      return { fill: palettes[analysisMode ?? "surface"][bucket], label: `${value.toFixed(1)} ${unit}` };
    }
    return { fill: mapFill(analysisMode), label: "analysis output pending verified routing" };
  }

  return <svg className={compact ? "realBoundary compact" : "realBoundary"} style={{ transform: `translate(-50%, -50%) scale(${zoom})` }} viewBox="0 0 300 350" role="img" aria-label="Accurate interactive administrative map of Bangladesh">
    <path className="countryFill" d={paths.outline} fillRule="evenodd" />
    {interactive && paths.districts.map((district) => { const selected = level === "subdistrict" ? selectedSubdistrict === district.name : selectedDistrict === district.name; const select = () => level === "subdistrict" ? onSubdistrictSelect?.(district.name) : onDistrictSelect?.(district.name); const info = thematicInfo(district.name); return <path className={`${level === "subdistrict" ? "subdistrictLine" : "districtLine"} thematic ${selected ? "selected" : ""}`} style={selected ? undefined : { fill: info.fill }} d={district.path} key={district.name} role="button" tabIndex={0} aria-label={`Select ${district.name} ${level}`} onClick={select} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(); }}><title>{district.name} • {info.label}</title></path>; })}
    {!compact && paths.divisions.map((path, index) => <path className="divisionLine" d={path} key={index} fillRule="evenodd" />)}
  </svg>;
}
