"use client";

import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Feature, Geometry } from "geojson";
import { GeoJSON, MapContainer, TileLayer } from "react-leaflet";
import type { Layer, PathOptions } from "leaflet";
import "leaflet/dist/leaflet.css";

export type UpazilaAccess = {
  mean_travel_minutes: number | null;
  underserved_percent: number | null;
  gi_zscore: number | null;
  gi_pvalue: number | null;
  lisa_quadrant: number | null;
};

// Real WorldPop raster bounding box for Bangladesh (validated against the
// downloaded GeoTIFF), used to frame every map consistently.
const BANGLADESH_BOUNDS: [[number, number], [number, number]] = [
  [20.5, 87.9],
  [26.7, 92.75],
];

const palettes: Record<string, string[]> = {
  surface: ["#d9eee6", "#8bc9b5", "#efc55d", "#df7259"], difference: ["#d8edf1", "#82b8c5", "#efb75a", "#d95848"], catchment: ["#e4f1ed", "#b4dccc", "#61ad94", "#167b69"], e2sfca: ["#dfefe9", "#9bcdbb", "#4d9c84", "#176956"], underserved: ["#f7e2dd", "#edb09f", "#df765f", "#b94439"], hotspot: ["#d7e7f3", "#86add0", "#ef9c82", "#d4473c"], lisa: ["#4f78b7", "#9bbadd", "#efb09d", "#d5534a"], facility: ["#f5ded8", "#efb6a6", "#9dd5c4", "#268d76"], flood: ["#dceced", "#91c0c5", "#e5a326", "#d65143"], service: ["#9fcfc0", "#719fc4", "#a77bad", "#2e7d70"], equity: ["#e8e0ef", "#c0a3d0", "#8c69a8", "#5b3d76"], priority: ["#e3ede9", "#f0c767", "#df8555", "#9e352f"], flow: ["#dceee8", "#a6d1c3", "#e6ae4a", "#cc5a46"], swipe: ["#7fc1ad", "#b7d7cc", "#efa58e", "#d65c49"], isochrone: ["#dcefe9", "#a8d8c8", "#65b49c", "#1d806d"],
};

const NO_DATA_FILL = "#e4e4e0";

// Modes with a real per-area metric computed by the pipeline (see
// pipeline/scripts/spatial_statistics.py). Every other mode has no verified
// output yet and keeps the flat placeholder fill rather than inventing one.
const REAL_METRIC_FIELD: Partial<Record<string, keyof UpazilaAccess>> = {
  surface: "mean_travel_minutes",
  underserved: "underserved_percent",
  hotspot: "gi_zscore",
};

function quantileBreaks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
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
const LISA_LABEL: Record<number, string> = {
  1: "High-High cluster",
  2: "Low-High outlier",
  3: "Low-Low cluster",
  4: "High-Low outlier",
};

function mapFill(mode?: string) {
  const palette = palettes[mode ?? "surface"] ?? palettes.surface;
  return palette[0];
}

function thematicInfo(
  name: string,
  analysisMode: string | undefined,
  accessByName: Record<string, UpazilaAccess> | undefined,
  breaks: number[] | null,
): { fill: string; label: string } {
  const palette = palettes[analysisMode ?? "surface"] ?? palettes.surface;
  if (!accessByName) {
    return {
      fill: mapFill(analysisMode),
      label: "analysis output pending verified routing",
      fill: palette[0],
      label: "loading access metrics...",
    };
  }
  const record = accessByName[name];
  if (analysisMode === "lisa") {
    if (!record || record.lisa_quadrant == null) {
      return { fill: NO_DATA_FILL, label: "no modeled route" };
    }
    const palette = palettes.lisa;
    const lisaPalette = palettes.lisa;
    return {
      fill: palette[LISA_BUCKET[record.lisa_quadrant] ?? 0],
      fill: lisaPalette[LISA_BUCKET[record.lisa_quadrant] ?? 0],
      label: LISA_LABEL[record.lisa_quadrant] ?? "unclassified",
    };
  }
  if (analysisMode === "hotspot") {
    if (!record || record.gi_zscore == null || !breaks) {
      return { fill: NO_DATA_FILL, label: "no modeled route" };
    }
    if ((record.gi_pvalue ?? 1) > 0.05) {
      return {
        fill: palettes.hotspot[0],
        label: `Gi* z=${record.gi_zscore.toFixed(2)}, not significant (p=${record.gi_pvalue?.toFixed(3)})`,
      };
    }
    const bucket = bucketOf(record.gi_zscore, breaks);
    return {
      fill: palettes.hotspot[bucket],
      label: `Gi* z=${record.gi_zscore.toFixed(2)}, p=${record.gi_pvalue?.toFixed(3)}`,
    };
  }
  const field = REAL_METRIC_FIELD[analysisMode ?? ""];
  if (field) {
    const value = record?.[field];
  if (analysisMode === "underserved") {
    const value = record?.underserved_percent;
    if (value == null || !breaks) {
      return {
        fill: NO_DATA_FILL,
        label: "no modeled route (isolated network segment)",
      };
      return { fill: NO_DATA_FILL, label: "no modeled route" };
    }
    const bucket = bucketOf(value, breaks);
    const unit =
      field === "mean_travel_minutes" ? "min mean travel time" : "% underserved";
    return {
      fill: palettes[analysisMode ?? "surface"][bucket],
      label: `${value.toFixed(1)} ${unit}`,
      fill: palettes.underserved[bucket],
      label: `${value.toFixed(1)}% underserved`,
    };
  }
  const travelMin = record?.mean_travel_minutes;
  if (travelMin != null) {
    const bucket = breaks ? bucketOf(travelMin, breaks) : 0;
    const modeLabel =
      analysisMode === "difference"
        ? `${travelMin.toFixed(1)} min baseline travel`
        : analysisMode === "catchment"
          ? `${travelMin.toFixed(1)} min catchment`
          : analysisMode === "e2sfca"
            ? `${travelMin.toFixed(1)} min access time`
            : analysisMode === "facility"
              ? `${travelMin.toFixed(1)} min travel time`
              : analysisMode === "flood"
                ? `${travelMin.toFixed(1)} min (dry season ref)`
                : `${travelMin.toFixed(1)} min mean travel time`;
    return {
      fill: palette[bucket],
      label: modeLabel,
    };
  }
  return {
    fill: mapFill(analysisMode),
    label: "analysis output pending verified routing",
    fill: NO_DATA_FILL,
    label: "no modeled route (isolated network segment)",
  };
}

type BoundaryProps = {
  compact?: boolean;
  interactive?: boolean;
  level?: "district" | "subdistrict";
  analysisMode?: string;
  selectedDistrict?: string | null;
  selectedSubdistrict?: string | null;
  onDistrictSelect?: (name: string) => void;
  onSubdistrictSelect?: (name: string) => void;
  accessByName?: Record<string, UpazilaAccess>;
};

export function LeafletBoundaryMap({
  compact = false,
  interactive = false,
  level = "district",
  analysisMode,
  selectedDistrict,
  selectedSubdistrict,
  onDistrictSelect,
  onSubdistrictSelect,
  accessByName,
}: BoundaryProps) {
  const [countryBoundary, setCountryBoundary] =
    useState<FeatureCollection | null>(null);
  const [areas, setAreas] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/bangladesh-boundary.geojson")
      .then((r) => r.json())
      .then(setCountryBoundary)
      .catch(() => setCountryBoundary(null));
  }, []);

  useEffect(() => {
    if (!interactive) return;
    fetch(
      level === "subdistrict"
        ? "/bangladesh-subdistricts.geojson"
        : "/bangladesh-districts.geojson",
    )
      .then((r) => r.json())
      .then(setAreas)
      .catch(() => setAreas(null));
  }, [interactive, level]);

  const field = REAL_METRIC_FIELD[analysisMode ?? ""];
  const metricField: keyof UpazilaAccess =
    analysisMode === "hotspot"
      ? "gi_zscore"
      : analysisMode === "underserved"
        ? "underserved_percent"
        : "mean_travel_minutes";

  const breaks = useMemo(() => {
    if (!field || !accessByName) return null;
    if (!accessByName) return null;
    const values = Object.values(accessByName)
      .map((record) => record[field])
      .map((record) => record[metricField])
      .filter((value): value is number => value != null);
    return values.length ? quantileBreaks(values) : null;
  }, [field, accessByName]);
  }, [metricField, accessByName]);

  const selectedName = level === "subdistrict" ? selectedSubdistrict : selectedDistrict;
  const select = (name: string) =>
    level === "subdistrict" ? onSubdistrictSelect?.(name) : onDistrictSelect?.(name);

  function styleFeature(feature?: Feature<Geometry>): PathOptions {
    const name = feature?.properties?.shapeName ?? "";
    const selected = name === selectedName;
    const info = thematicInfo(name, analysisMode, accessByName, breaks);
    return {
      color: selected ? "#064f49" : "#7f9c94",
      weight: selected ? 2 : 0.6,
      fillColor: selected ? "#087c71" : info.fill,
      fillOpacity: selected ? 0.75 : 0.8,
      className: `${level === "subdistrict" ? "subdistrictLine" : "districtLine"} thematic${selected ? " selected" : ""}`,
    };
  }

  function onEachArea(feature: Feature<Geometry>, layer: Layer) {
    const name = feature.properties?.shapeName ?? "area";
    const info = thematicInfo(name, analysisMode, accessByName, breaks);
    layer.bindTooltip(`${name} • ${info.label}`, { sticky: true });
    layer.on("click", () => select(name));
  }

  return (
    <MapContainer
      bounds={BANGLADESH_BOUNDS}
      boundsOptions={{ padding: [6, 6] }}
      zoomControl={interactive && !compact}
      attributionControl={!compact}
      dragging={!compact}
      scrollWheelZoom={!compact}
      doubleClickZoom={!compact}
      boxZoom={!compact}
      keyboard={!compact}
      touchZoom={!compact}
      className={compact ? "leafletMiniMap" : "leafletThematicMap"}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {countryBoundary && (
        <GeoJSON
          data={countryBoundary}
          style={{ color: "#075d55", weight: 2, fillOpacity: 0.02 }}
        />
      )}
      {interactive && areas && (
        <GeoJSON
          key={`${level}-${analysisMode}-${selectedName ?? ""}-${accessByName ? "real" : "flat"}`}
          data={areas}
          style={styleFeature}
          onEachFeature={onEachArea}
        />
      )}
    </MapContainer>
  );
}
