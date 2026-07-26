"use client";

import { useEffect, useMemo, useState } from "react";

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type BoundaryData = { features: Array<{ geometry: Geometry; properties?: { shapeName?: string } }> };

export function BangladeshBoundary({ compact = false, interactive = false, level = "district", selectedDistrict, selectedSubdistrict, onDistrictSelect, onSubdistrictSelect }: { compact?: boolean; interactive?: boolean; level?: "district" | "subdistrict"; selectedDistrict?: string | null; selectedSubdistrict?: string | null; onDistrictSelect?: (name: string) => void; onSubdistrictSelect?: (name: string) => void }) {
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

  return <svg className={compact ? "realBoundary compact" : "realBoundary"} viewBox="0 0 300 350" role="img" aria-label="Accurate national boundary outline of Bangladesh">
    <path className="countryFill" d={paths.outline} fillRule="evenodd" />
    {interactive && paths.districts.map((district) => { const selected = level === "subdistrict" ? selectedSubdistrict === district.name : selectedDistrict === district.name; const select = () => level === "subdistrict" ? onSubdistrictSelect?.(district.name) : onDistrictSelect?.(district.name); return <path className={`${level === "subdistrict" ? "subdistrictLine" : "districtLine"} ${selected ? "selected" : ""}`} d={district.path} key={district.name} role="button" tabIndex={0} aria-label={`Select ${district.name} ${level}`} onClick={select} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") select(); }} />; })}
    {!compact && paths.divisions.map((path, index) => <path className="divisionLine" d={path} key={index} fillRule="evenodd" />)}
  </svg>;
}
