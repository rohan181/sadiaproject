"use client";

import { useEffect, useMemo, useState } from "react";

type Position = [number, number];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] };
type BoundaryData = { features: Array<{ geometry: Geometry }> };

export function BangladeshBoundary({ compact = false }: { compact?: boolean }) {
  const [geometry, setGeometry] = useState<Geometry | null>(null);

  useEffect(() => {
    fetch("/bangladesh-boundary.geojson")
      .then((response) => response.json())
      .then((data: BoundaryData) => setGeometry(data.features[0]?.geometry ?? null))
      .catch(() => setGeometry(null));
  }, []);

  const path = useMemo(() => {
    if (!geometry) return "";
    const polygons: Position[][][] = geometry.type === "Polygon"
      ? [geometry.coordinates as Position[][]]
      : geometry.coordinates as Position[][][];
    const points = polygons.flat(2);
    const lons = points.map(([lon]) => lon);
    const lats = points.map(([, lat]) => lat);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons);
    const minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const width = 300, height = 350, padding = 6;
    const project = ([lon, lat]: Position) => [
      padding + ((lon - minLon) / (maxLon - minLon)) * (width - padding * 2),
      padding + ((maxLat - lat) / (maxLat - minLat)) * (height - padding * 2),
    ];
    return polygons.map((polygon) => polygon.map((ring) => ring.map((point, index) => {
      const [x, y] = project(point);
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ") + " Z").join(" ")).join(" ");
  }, [geometry]);

  return <svg className={compact ? "realBoundary compact" : "realBoundary"} viewBox="0 0 300 350" role="img" aria-label="Accurate national boundary outline of Bangladesh">
    <path d={path} fillRule="evenodd" />
  </svg>;
}
