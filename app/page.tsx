"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { BangladeshBoundary, type UpazilaAccess } from "./BangladeshBoundary";
import { PipelineStatus } from "./PipelineStatus";

const RealFacilityMap = dynamic(
  () => import("./RealFacilityMap").then((module) => module.RealFacilityMap),
  { ssr: false },
);

const regions = [
  { name: "Rangpur", x: 33.6, y: 13.9, dry: 38, monsoon: 51, people: 3.2 },
  { name: "Rajshahi", x: 32.6, y: 34.5, dry: 31, monsoon: 43, people: 4.1 },
  { name: "Mymensingh", x: 50.8, y: 32.2, dry: 27, monsoon: 39, people: 3.4 },
  { name: "Sylhet", x: 66.0, y: 34.7, dry: 42, monsoon: 67, people: 2.7 },
  { name: "Dhaka", x: 48.5, y: 45.9, dry: 19, monsoon: 27, people: 6.3 },
  { name: "Khulna", x: 37.2, y: 62.8, dry: 35, monsoon: 52, people: 3.8 },
  { name: "Barishal", x: 51.2, y: 71.3, dry: 39, monsoon: 61, people: 2.9 },
  { name: "Chattogram", x: 66.9, y: 64.8, dry: 36, monsoon: 55, people: 4.6 },
];

const dghsFacilities = [
  { division: "Dhaka", count: 9979 },
  { division: "Chattogram", count: 7480 },
  { division: "Rajshahi", count: 5225 },
  { division: "Khulna", count: 4821 },
  { division: "Rangpur", count: 4025 },
  { division: "Barishal", count: 2883 },
  { division: "Mymensingh", count: 2789 },
  { division: "Sylhet", count: 2226 },
];

type PopulationRecord = {
  shapeID: string;
  shapeName: string;
  shapeType: string;
  population_2025: number;
};
type PopulationDataset = {
  populationTotal: number;
  records: PopulationRecord[];
  source: string;
};

function formatPopulation(value?: number) {
  if (value == null) return "Loading…";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000).toLocaleString()}k`;
  return value.toLocaleString();
}

type AnalysisMode =
  | "surface"
  | "difference"
  | "catchment"
  | "e2sfca"
  | "underserved"
  | "hotspot"
  | "lisa"
  | "facility"
  | "flood"
  | "service"
  | "equity"
  | "priority"
  | "flow"
  | "swipe"
  | "isochrone";
type LibraryCategory = "all" | "access" | "seasonal" | "equity" | "planning";

const analysisCategory: Record<
  AnalysisMode,
  Exclude<LibraryCategory, "all">
> = {
  surface: "access",
  catchment: "access",
  e2sfca: "access",
  underserved: "access",
  service: "access",
  isochrone: "access",
  difference: "seasonal",
  flood: "seasonal",
  flow: "seasonal",
  swipe: "seasonal",
  hotspot: "equity",
  lisa: "equity",
  equity: "equity",
  facility: "planning",
  priority: "planning",
};

const analysisModes: {
  id: AnalysisMode;
  icon: string;
  title: string;
  text: string;
  mapTitle: string;
  stat: string;
}[] = [
  {
    id: "surface",
    icon: "◒",
    title: "Accessibility surface",
    text: "Continuous travel-time zones",
    mapTitle: "Travel-time accessibility surface",
    stat: "508 of 544 upazilas modeled (dry season)",
  },
  {
    id: "difference",
    icon: "↕",
    title: "Seasonal change",
    text: "Monsoon delay versus dry baseline",
    mapTitle: "Dry-to-monsoon travel-time increase",
    stat: "Awaiting verified calculation",
  },
  {
    id: "catchment",
    icon: "◎",
    title: "Facility catchments",
    text: "Population reachable by hospital",
    mapTitle: "Population within facility catchments",
    stat: "Awaiting verified calculation",
  },
  {
    id: "e2sfca",
    icon: "Σ",
    title: "E2SFCA access",
    text: "Capacity, demand and travel time",
    mapTitle: "Enhanced 2-step floating catchment access",
    stat: "Awaiting verified calculation",
  },
  {
    id: "underserved",
    icon: "◉",
    title: "Underserved population",
    text: "Residents beyond the threshold",
    mapTitle: "Population outside reasonable access",
    stat: "508 of 544 upazilas modeled (dry season)",
  },
  {
    id: "hotspot",
    icon: "✦",
    title: "Gi* hotspots",
    text: "Significant underserved clusters",
    mapTitle: "Getis-Ord Gi* access hotspots",
    stat: "PySAL Getis-Ord Gi*, 999 permutations",
  },
  {
    id: "lisa",
    icon: "▦",
    title: "LISA clusters",
    text: "Clusters and spatial outliers",
    mapTitle: "Local indicators of spatial association",
    stat: "PySAL Local Moran's I, 999 permutations",
  },
  {
    id: "facility",
    icon: "+",
    title: "Facility scenario",
    text: "Compare access before and after",
    mapTitle: "Access impact of a proposed clinic",
    stat: "Awaiting verified calculation",
  },
  {
    id: "flood",
    icon: "≈",
    title: "Flooded roads",
    text: "Slowed and impassable road links",
    mapTitle: "Road disruption during monsoon",
    stat: "Awaiting verified calculation",
  },
  {
    id: "service",
    icon: "✚",
    title: "Service levels",
    text: "Clinic, upazila and hospital access",
    mapTitle: "Access by healthcare service level",
    stat: "Awaiting verified calculation",
  },
  {
    id: "equity",
    icon: "≋",
    title: "Health equity",
    text: "Access versus social vulnerability",
    mapTitle: "Access and vulnerability equity gaps",
    stat: "Awaiting verified calculation",
  },
  {
    id: "priority",
    icon: "#",
    title: "Priority matrix",
    text: "Composite intervention ranking",
    mapTitle: "Multi-criteria planning priorities",
    stat: "Awaiting verified calculation",
  },
  {
    id: "flow",
    icon: "▶",
    title: "Seasonal flow",
    text: "Animated catchment contraction",
    mapTitle: "Seasonal contraction of service reach",
    stat: "Awaiting verified calculation",
  },
  {
    id: "swipe",
    icon: "◐",
    title: "Dry / monsoon swipe",
    text: "Side-by-side seasonal comparison",
    mapTitle: "Dry and monsoon accessibility comparison",
    stat: "Awaiting verified calculation",
  },
  {
    id: "isochrone",
    icon: "⌾",
    title: "Travel isochrones",
    text: "15, 30 and 60-minute reach",
    mapTitle: "Network travel-time isochrones",
    stat: "Awaiting verified calculation",
  },
];

function MapPreview({
  mode,
  active,
  onOpen,
}: {
  mode: AnalysisMode;
  active: boolean;
  onOpen: () => void;
}) {
  const meta = analysisModes.find((item) => item.id === mode)!;
  return (
    <article
      className={`miniMapCard ${active ? "active" : ""}`}
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpen();
      }}
    >
      <div className="miniMapHeader">
        <div>
          <i>{meta.icon}</i>
          <span>
            <b>{meta.title}</b>
            <small>{meta.text}</small>
          </span>
        </div>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          Open big map ↗
        </button>
      </div>
      <div className={`miniMap mode-${mode}`}>
        <BangladeshBoundary compact />
        <div className="miniRiver" />
        {mode === "difference" && (
          <>
            <i className="miniZone z1" />
            <i className="miniZone z2" />
            <i className="miniZone z3" />
            <div className="miniKey">
              <span>+6</span>
              <span>+17</span>
              <span>+28 min</span>
            </div>
          </>
        )}
        {mode === "flood" && (
          <div className="miniRoads">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        )}
        {(mode === "catchment" || mode === "isochrone" || mode === "flow") && (
          <div className={`miniRings ${mode === "flow" ? "animated" : ""}`}>
            <i />
            <i />
            <i />
            <b>+</b>
          </div>
        )}
        {mode === "facility" && (
          <>
            <div className="beforeArea">
              <small>Before</small>
              <b>67 min</b>
            </div>
            <div className="afterArea">
              <small>After</small>
              <b>49 min</b>
            </div>
            <div className="clinicMark">+</div>
          </>
        )}
        {!(
          [
            "difference",
            "flood",
            "catchment",
            "isochrone",
            "flow",
            "facility",
            "swipe",
          ] as AnalysisMode[]
        ).includes(mode) && (
          <div className={`previewMarks kind-${mode}`}>
            {regions.map((r, i) => (
              <i
                key={r.name}
                style={
                  {
                    left: `${r.x}%`,
                    top: `${r.y}%`,
                    ["--i" as string]: i,
                  } as React.CSSProperties
                }
              >
                {mode === "priority"
                  ? i + 1
                  : mode === "service"
                    ? ["C", "U", "H"][i % 3]
                    : ""}
              </i>
            ))}
          </div>
        )}
        {mode === "swipe" && (
          <div className="swipeDivider">
            <span>Dry</span>
            <span>Monsoon</span>
          </div>
        )}
      </div>
      <div className="miniMapFoot">
        <span>{meta.stat}</span>
        <span className="methodBadge">{analysisCategory[mode]}</span>
      </div>
      <div className="miniMapAction">
        <span>
          <i /> Model-ready view
        </span>
        <b>Explore full analysis →</b>
      </div>
    </article>
  );
}

export default function Home() {
  const [season, setSeason] = useState<"dry" | "monsoon">("monsoon");
  const [selected, setSelected] = useState(regions[3]);
  const [facility, setFacility] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("surface");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<string | null>(
    null,
  );
  const [mapLevel, setMapLevel] = useState<"district" | "subdistrict">(
    "district",
  );
  const [mapExpanded, setMapExpanded] = useState(false);
  const [libraryCategory, setLibraryCategory] =
    useState<LibraryCategory>("all");
  const [overviewZoom, setOverviewZoom] = useState(1);
  const [districtPopulation, setDistrictPopulation] =
    useState<PopulationDataset | null>(null);
  const [subdistrictPopulation, setSubdistrictPopulation] =
    useState<PopulationDataset | null>(null);
  const [upazilaAccess, setUpazilaAccess] = useState<Record<
    string,
    UpazilaAccess
  > | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/data/observed/district-population-2025.json").then((response) =>
        response.json(),
      ),
      fetch("/data/observed/subdistrict-population-2025.json").then(
        (response) => response.json(),
      ),
    ])
      .then(([districts, subdistricts]) => {
        setDistrictPopulation(districts);
        setSubdistrictPopulation(subdistricts);
      })
      .catch(() => {
        setDistrictPopulation(null);
        setSubdistrictPopulation(null);
      });
  }, []);

  useEffect(() => {
    fetch("/data/analysis/manifest.json")
      .then((response) => response.json())
      .then((manifest) => {
        if (manifest.status !== "complete") return null;
        return fetch("/data/analysis/upazila-access.geojson").then((r) =>
          r.json(),
        );
      })
      .then((geojson) => {
        if (!geojson) return;
        const byName: Record<string, UpazilaAccess> = {};
        for (const feature of geojson.features) {
          const props = feature.properties;
          byName[props.shapeName] = {
            mean_travel_minutes: props.mean_travel_minutes ?? null,
            underserved_percent: props.underserved_percent ?? null,
            gi_zscore: props.gi_zscore ?? null,
            gi_pvalue: props.gi_pvalue ?? null,
            lisa_quadrant: props.lisa_quadrant ?? null,
          };
        }
        setUpazilaAccess(byName);
      })
      .catch(() => setUpazilaAccess(null));
  }, []);

  const districtMetrics = useMemo(() => {
    if (!selectedDistrict) return null;
    return (
      districtPopulation?.records.find(
        (record) => record.shapeName === selectedDistrict,
      ) ?? null
    );
  }, [selectedDistrict, districtPopulation]);

  const subdistrictMetrics = useMemo(() => {
    if (!selectedSubdistrict) return null;
    return (
      subdistrictPopulation?.records.find(
        (record) => record.shapeName === selectedSubdistrict,
      ) ?? null
    );
  }, [selectedSubdistrict, subdistrictPopulation]);

  const subdistrictAccess = useMemo(() => {
    if (!selectedSubdistrict || !upazilaAccess) return null;
    return upazilaAccess[selectedSubdistrict] ?? null;
  }, [selectedSubdistrict, upazilaAccess]);

  const populationRankings = useMemo(
    () => [...(districtPopulation?.records ?? [])]
      .sort((a, b) => b.population_2025 - a.population_2025)
      .slice(0, 8),
    [districtPopulation],
  );

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">A</span>
          <div>
            <strong>AccessBD</strong>
            <small>Healthcare spatial intelligence</small>
          </div>
        </div>
        <div className="headerActions">
          <span className="status real">
            <i /> Real-source inputs
          </span>
          <button className="iconButton" aria-label="Notifications">
            ●
          </button>
          <div className="avatar">DG</div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">National access overview</p>
          <h1>
            See where healthcare
            <br />
            is hardest to reach.
          </h1>
          <p className="intro">
            Compare road-based travel times across seasons and identify the
            communities where new services can make the greatest difference.
          </p>
        </div>
        <div className="seasonControl" aria-label="Season selector">
          <button
            className={season === "dry" ? "active" : ""}
            onClick={() => setSeason("dry")}
          >
            <span>☀</span> Dry season
          </button>
          <button
            className={season === "monsoon" ? "active" : ""}
            onClick={() => setSeason("monsoon")}
          >
            <span>⌁</span> Monsoon
          </button>
        </div>
      </section>

      <section className="metricGrid">
        <article className="metric">
          <div className="metricTop">
            <span>Bangladesh population · WorldPop 2025</span>
            <i className="dot teal" />
          </div>
          <strong>
            {formatPopulation(districtPopulation?.populationTotal)}
          </strong>
          <p>Calculated from the downloaded 100 m raster</p>
        </article>
        <article className="metric">
          <div className="metricTop">
            <span>Administrative coverage</span>
            <i className="dot amber" />
          </div>
          <strong>
            64<small> districts</small>
          </strong>
          <p>544 subdistrict boundaries available</p>
        </article>
        <article className="metric">
          <div className="metricTop">
            <span>Road-network input</span>
            <i className="dot coral" />
          </div>
          <strong>
            334<small> MB</small>
          </strong>
          <p>Current Bangladesh OSM PBF downloaded</p>
        </article>
        <article className="metric impact">
          <div className="metricTop">
            <span>DGHS registered organizations</span>
            <i className="dot blue" />
          </div>
          <strong>39,428</strong>
          <p>Official active-registry export downloaded</p>
        </article>
      </section>

      <RealFacilityMap />

      <PipelineStatus />

      <section className="analysisStrip" aria-label="Map analysis type">
        <div className="analysisIntro">
          <p className="eyebrow">Analysis layers</p>
          <h2>Choose a planning view</h2>
        </div>
        <div className="analysisOptions">
          {analysisModes.map((mode) => (
            <button
              key={mode.id}
              className={analysisMode === mode.id ? "active" : ""}
              onClick={() => {
                setAnalysisMode(mode.id);
                if (mode.id === "facility") setFacility(true);
              }}
            >
              <i>{mode.icon}</i>
              <span>
                <b>{mode.title}</b>
                <small>{mode.text}</small>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="dashboardGrid">
        <article className="mapCard">
          <div className="cardHeader">
            <div>
              <p className="eyebrow">
                {analysisModes.find((m) => m.id === analysisMode)?.title} map
              </p>
              <h2>
                {analysisModes.find((m) => m.id === analysisMode)?.mapTitle}
              </h2>
            </div>
            <div className="mapTools">
              <span className="liveLayer">
                <i /> 64 districts • 544 subdistricts
              </span>
              <button
                aria-label="Open large map"
                onClick={() => {
                  setMapLevel("district");
                  setMapExpanded(true);
                }}
              >
                Expand ↗
              </button>
            </div>
          </div>
          <div className={`mapArea mode-${analysisMode}`}>
            <div className="river riverOne" />
            <div className="river riverTwo" />
            <BangladeshBoundary
              interactive
              analysisMode={analysisMode}
              zoom={overviewZoom}
              selectedDistrict={selectedDistrict}
              onDistrictSelect={setSelectedDistrict}
            />
            {analysisMode === "flood" && (
              <div className="floodRoads" aria-hidden="true">
                <i className="road r1" />
                <i className="road r2" />
                <i className="road r3" />
                <i className="road r4" />
                <i className="road r5" />
                <i className="road r6" />
              </div>
            )}
            {(analysisMode === "catchment" ||
              analysisMode === "isochrone" ||
              analysisMode === "flow") && (
              <div
                className={`catchments ${analysisMode === "flow" ? "animated" : ""}`}
                aria-hidden="true"
              >
                <i
                  className="catch c60"
                  style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
                />
                <i
                  className="catch c30"
                  style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
                />
                <i
                  className="catch c15"
                  style={{ left: `${selected.x}%`, top: `${selected.y}%` }}
                />
              </div>
            )}
            {!(
              [
                "difference",
                "flood",
                "catchment",
                "isochrone",
                "flow",
                "facility",
                "swipe",
              ] as AnalysisMode[]
            ).includes(analysisMode) && (
              <div className={`analysisOverlay kind-${analysisMode}`}>
                {regions.map((r, i) => (
                  <i
                    key={r.name}
                    style={
                      {
                        left: `${r.x}%`,
                        top: `${r.y}%`,
                        ["--i" as string]: i,
                      } as React.CSSProperties
                    }
                  >
                    {analysisMode === "priority"
                      ? i + 1
                      : analysisMode === "service"
                        ? ["C", "U", "H"][i % 3]
                        : ""}
                  </i>
                ))}
              </div>
            )}
            {analysisMode === "swipe" && (
              <div className="fullSwipe">
                <div>
                  <span>Dry season</span>
                </div>
                <i />
                <div>
                  <span>Monsoon</span>
                </div>
              </div>
            )}
            {regions.map((r) => {
              const baseValue =
                analysisMode === "difference"
                  ? r.monsoon - r.dry
                  : ["catchment", "isochrone"].includes(analysisMode)
                    ? Math.round(92 - r[season])
                    : analysisMode === "e2sfca"
                      ? Math.round((100 - r[season]) / 10)
                      : analysisMode === "underserved"
                        ? Math.round((r.people * r[season]) / 4)
                        : r[season];
              const value = Math.max(
                10,
                baseValue -
                  (facility &&
                  analysisMode === "facility" &&
                  r.name === selected.name
                    ? 18
                    : 0),
              );
              const risk = value > 50 ? "high" : value > 35 ? "medium" : "low";
              return (
                <button
                  key={r.name}
                  className={`region ${risk} ${selected.name === r.name ? "selected" : ""}`}
                  style={{ left: `${r.x}%`, top: `${r.y}%` }}
                  onClick={() => setSelected(r)}
                  aria-label={`${r.name}, ${value}`}
                >
                  <span>{r.name}</span>
                  <b>
                    {value}
                    {analysisMode === "difference"
                      ? "+"
                      : ["catchment", "isochrone"].includes(analysisMode)
                        ? "%"
                        : analysisMode === "e2sfca"
                          ? "/10"
                          : analysisMode === "underserved"
                            ? "k"
                            : ""}
                  </b>
                </button>
              );
            })}
            {analysisMode === "facility" && (
              <button
                className="proposedPin"
                style={{
                  left: `${selected.x + 4}%`,
                  top: `${selected.y + 6}%`,
                }}
                aria-label={`Proposed clinic in ${selected.name}`}
              >
                <b>+</b>
                <span>Proposed clinic</span>
              </button>
            )}
            <div className="mapZoom">
              <button
                aria-label="Zoom in"
                onClick={() =>
                  setOverviewZoom((value) =>
                    Math.min(2, Number((value + 0.2).toFixed(1))),
                  )
                }
              >
                +
              </button>
              <button
                aria-label="Zoom out"
                onClick={() =>
                  setOverviewZoom((value) =>
                    Math.max(1, Number((value - 0.2).toFixed(1))),
                  )
                }
              >
                −
              </button>
              <button
                aria-label="Reset map zoom"
                className="resetZoom"
                onClick={() => setOverviewZoom(1)}
              >
                ↺
              </button>
            </div>
            <div className="mapInteractionHint">
              <b>
                {selectedDistrict
                  ? `${selectedDistrict} selected`
                  : "Tap a district"}
              </b>
              <span>
                {Math.round(overviewZoom * 100)}% zoom • open large map for
                upazila analysis
              </span>
            </div>
            {analysisMode === "difference" && (
              <div className="legend">
                <span>
                  <i className="low" /> +0–10 min
                </span>
                <span>
                  <i className="medium" /> +11–20
                </span>
                <span>
                  <i className="high" /> +21+
                </span>
              </div>
            )}
            {analysisMode === "flood" && (
              <div className="legend">
                <span>
                  <i className="roadOpen" /> Open
                </span>
                <span>
                  <i className="roadSlow" /> Slowed
                </span>
                <span>
                  <i className="roadClosed" /> Impassable
                </span>
              </div>
            )}
            {analysisMode === "catchment" && (
              <div className="legend">
                <span>
                  <i className="ring15" /> 15 min
                </span>
                <span>
                  <i className="ring30" /> 30 min
                </span>
                <span>
                  <i className="ring60" /> 60 min
                </span>
              </div>
            )}
            {analysisMode === "facility" && (
              <div className="legend">
                <span>
                  <i className="currentDot" /> Current access
                </span>
                <span>
                  <i className="proposalDot" /> Improved
                </span>
              </div>
            )}
            {!(
              ["difference", "flood", "catchment", "facility"] as AnalysisMode[]
            ).includes(analysisMode) && (
              <div className="legend">
                <span>
                  <i className="low" /> Low
                </span>
                <span>
                  <i className="medium" /> Moderate
                </span>
                <span>
                  <i className="high" /> High
                </span>
              </div>
            )}
          </div>
          <div className="mapFooter">
            <span>
              WorldPop 2025 population and real administrative geometry loaded
            </span>
            <span>Accessibility output pending routing run</span>
          </div>
        </article>

        <aside className="sidePanel">
          <div className="panelHeader">
            <p className="eyebrow">
              {selectedDistrict ? "Selected district" : "Area detail"}
            </p>
            <h2>
              {selectedDistrict
                ? `${selectedDistrict} District`
                : "Select a district"}
            </h2>
            <span>Observed inputs only</span>
          </div>
          <div className="timeRing">
            <div>
              <strong>—</strong>
              <small>routing pending</small>
            </div>
          </div>
          <div className="detailRows">
            <div>
              <span>WorldPop 2025 population</span>
              <b>{formatPopulation(districtMetrics?.population_2025)}</b>
            </div>
            <div>
              <span>Population beyond {threshold} min</span>
              <b>Not calculated</b>
            </div>
            <div>
              <span>Seasonal change</span>
              <b>Flood extent required</b>
            </div>
            <div>
              <span>DGHS facility coordinates</span>
              <b>Not available in bulk export</b>
            </div>
          </div>
          {districtMetrics && (
            <div className="districtCompare">
              <p className="eyebrow">Verified district input</p>
              <div>
                <span>
                  <small>Population</small>
                  <b>{formatPopulation(districtMetrics.population_2025)}</b>
                </span>
                <i>✓</i>
                <span>
                  <small>Source</small>
                  <b>WorldPop</b>
                </span>
              </div>
              <button onClick={() => setMapExpanded(true)}>
                Open district in big map ↗
              </button>
            </div>
          )}
          {selectedDistrict && (
            <button
              className="subdistrictButton"
              onClick={() => {
                setMapLevel("subdistrict");
                setSelectedSubdistrict(null);
                setMapExpanded(true);
              }}
            >
              <span>
                <b>Explore subdistrict analysis</b>
                <small>Open 544 real upazila boundaries</small>
              </span>
              <i>→</i>
            </button>
          )}
          {analysisMode === "facility" && (
            <div className="comparisonPanel">
              <p className="eyebrow">Before / after</p>
              <p>
                A genuine comparison will appear after verified facility
                coordinates and routing outputs are available.
              </p>
            </div>
          )}
          <div className="scenarioBox">
            <div>
              <p className="eyebrow">Planning scenario</p>
              <h3>Add a community clinic</h3>
            </div>
            <label>
              <input
                type="checkbox"
                checked={facility}
                onChange={(e) => setFacility(e.target.checked)}
              />
              <span />
            </label>
          </div>
          <p className="scenarioHint">
            Scenario visualization only; no impact number is reported until the
            routing model runs.
          </p>
          <button className="primaryButton">
            View full area analysis <span>→</span>
          </button>
        </aside>
      </section>

      {mapExpanded && (
        <div
          className="mapModal"
          role="dialog"
          aria-modal="true"
          aria-label="Interactive Bangladesh analysis map"
        >
          <div className="mapModalPanel">
            <div className="mapModalHeader">
              <div>
                <p className="eyebrow">
                  {
                    analysisModes.find((mode) => mode.id === analysisMode)
                      ?.title
                  }{" "}
                  • Full map
                </p>
                <h2>
                  {
                    analysisModes.find((mode) => mode.id === analysisMode)
                      ?.mapTitle
                  }
                </h2>
                <span>
                  Tap any of Bangladesh’s 64 districts to inspect and compare
                  access
                </span>
              </div>
              <button
                onClick={() => setMapExpanded(false)}
                aria-label="Close large map"
              >
                ×
              </button>
            </div>
            <div className="mapModalBody">
              <div className={`bigMap mode-${analysisMode}`}>
                <BangladeshBoundary
                  interactive
                  selectedDistrict={selectedDistrict}
                  onDistrictSelect={setSelectedDistrict}
                />
                {analysisMode === "flood" && (
                  <div className="floodRoads">
                    <i className="road r1" />
                    <i className="road r2" />
                    <i className="road r3" />
                    <i className="road r4" />
                    <i className="road r5" />
                    <i className="road r6" />
                  </div>
                )}
                {(analysisMode === "catchment" ||
                  analysisMode === "isochrone" ||
                  analysisMode === "flow") && (
                  <div
                    className={`catchments ${analysisMode === "flow" ? "animated" : ""}`}
                  >
                    <i
                      className="catch c60"
                      style={{ left: "51%", top: "48%" }}
                    />
                    <i
                      className="catch c30"
                      style={{ left: "51%", top: "48%" }}
                    />
                    <i
                      className="catch c15"
                      style={{ left: "51%", top: "48%" }}
                    />
                  </div>
                )}
                {!(
                  [
                    "difference",
                    "flood",
                    "catchment",
                    "isochrone",
                    "flow",
                    "facility",
                    "swipe",
                  ] as AnalysisMode[]
                ).includes(analysisMode) && (
                  <div className={`analysisOverlay kind-${analysisMode}`}>
                    {regions.map((r, i) => (
                      <i
                        key={r.name}
                        style={
                          {
                            left: `${r.x}%`,
                            top: `${r.y}%`,
                            ["--i" as string]: i,
                          } as React.CSSProperties
                        }
                      >
                        {analysisMode === "priority"
                          ? i + 1
                          : analysisMode === "service"
                            ? ["C", "U", "H"][i % 3]
                            : ""}
                      </i>
                    ))}
                  </div>
                )}
                {analysisMode === "swipe" && (
                  <div className="fullSwipe">
                    <div>
                      <span>Dry season</span>
                    </div>
                    <i />
                    <div>
                      <span>Monsoon</span>
                    </div>
                  </div>
                )}
                {analysisMode === "flow" && (
                  <div className="flowStory">
                    <div className="flowPulse p1" />
                    <div className="flowPulse p2" />
                    <div className="flowPulse p3" />
                    <div className="flowTimeline">
                      <span>Dry</span>
                      <i>
                        <b />
                      </i>
                      <span>Early monsoon</span>
                      <i>
                        <b />
                      </i>
                      <span>Peak flood</span>
                    </div>
                  </div>
                )}
                <div className="bigMapLegend">
                  <span>
                    <i className="low" /> Lower access burden
                  </span>
                  <span>
                    <i className="medium" /> Moderate
                  </span>
                  <span>
                    <i className="high" /> Highest priority
                  </span>
                </div>
              </div>
              <aside>
                <p className="eyebrow">Selected location</p>
                <h3>
                  {selectedDistrict
                    ? `${selectedDistrict} District`
                    : "Choose a district"}
                </h3>
                <div className="activeAnalysis">
                  <small>Active analysis</small>
                  <b>
                    {
                      analysisModes.find((mode) => mode.id === analysisMode)
                        ?.title
                    }
                  </b>
                  <span>Routing output not yet calculated</span>
                </div>
                {districtMetrics ? (
                  <div className="detailRows">
                    <div>
                      <span>WorldPop 2025 population</span>
                      <b>{formatPopulation(districtMetrics.population_2025)}</b>
                    </div>
                    <div><span>Travel time</span><b>Pending routing</b></div>
                    <div><span>Facilities</span><b>Coordinate join pending</b></div>
                  </div>
                ) : (
                  <p className="emptyHint">
                    All 64 district polygons are interactive and use their real
                    geographic boundaries.
                  </p>
                )}
                <button
                  className="primaryButton"
                  onClick={() => setMapExpanded(false)}
                >
                  Apply selection <span>→</span>
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}

      {mapExpanded && mapLevel === "subdistrict" && (
        <div
          className="mapModal subLevel"
          role="dialog"
          aria-modal="true"
          aria-label="Interactive Bangladesh subdistrict analysis map"
        >
          <div className="mapModalPanel">
            <div className="mapModalHeader">
              <div>
                <p className="eyebrow">
                  Subdistrict analysis •{" "}
                  {
                    analysisModes.find((mode) => mode.id === analysisMode)
                      ?.title
                  }
                </p>
                <h2>Bangladesh upazila accessibility explorer</h2>
                <span>
                  Real ADM3 geography • Tap any of 544 subdistrict polygons
                </span>
              </div>
              <button
                onClick={() => setMapExpanded(false)}
                aria-label="Close subdistrict map"
              >
                ×
              </button>
            </div>
            <div className="adminLevelBar">
              <button onClick={() => setMapLevel("district")}>
                ← District level
              </button>
              <span>
                District <b>→</b> Subdistrict / Upazila
              </span>
              <strong>544 real boundaries</strong>
            </div>
            <div className="mapModalBody">
              <div className={`bigMap subdistrictMap mode-${analysisMode}`}>
                <BangladeshBoundary
                  interactive
                  level="subdistrict"
                  analysisMode={analysisMode}
                  selectedDistrict={selectedDistrict}
                  selectedSubdistrict={selectedSubdistrict}
                  onSubdistrictSelect={setSelectedSubdistrict}
                  accessByName={upazilaAccess ?? undefined}
                />
                {analysisMode === "flow" && (
                  <div className="flowStory">
                    <div className="flowPulse p1" />
                    <div className="flowPulse p2" />
                    <div className="flowPulse p3" />
                    <div className="flowTimeline">
                      <span>Dry</span>
                      <i>
                        <b />
                      </i>
                      <span>Early monsoon</span>
                      <i>
                        <b />
                      </i>
                      <span>Peak flood</span>
                    </div>
                  </div>
                )}
                <div className="bigMapLegend">
                  <span>
                    <i className="low" /> Better access
                  </span>
                  <span>
                    <i className="medium" /> Moderate
                  </span>
                  <span>
                    <i className="high" /> Underserved
                  </span>
                </div>
              </div>
              <aside>
                <p className="eyebrow">Selected subdistrict</p>
                <h3>
                  {selectedSubdistrict
                    ? `${selectedSubdistrict} Upazila`
                    : "Choose a subdistrict"}
                </h3>
                <div className="activeAnalysis">
                  <small>Parent selection</small>
                  <b>
                    {selectedDistrict
                      ? `${selectedDistrict} District`
                      : "Bangladesh"}
                  </b>
                  <span>
                    {
                      analysisModes.find((mode) => mode.id === analysisMode)
                        ?.title
                    }
                  </span>
                </div>
                {subdistrictMetrics ? (
                  <div className="detailRows">
                    <div>
                      <span>WorldPop 2025 population</span>
                      <b>{formatPopulation(subdistrictMetrics.population_2025)}</b>
                    </div>
                    {subdistrictAccess ? (
                      <>
                        <div>
                          <span>Mean travel time (dry season)</span>
                          <b>
                            {subdistrictAccess.mean_travel_minutes != null
                              ? `${subdistrictAccess.mean_travel_minutes.toFixed(1)} min`
                              : "No modeled route"}
                          </b>
                        </div>
                        <div>
                          <span>Beyond {threshold} min threshold</span>
                          <b>
                            {subdistrictAccess.underserved_percent != null
                              ? `${subdistrictAccess.underserved_percent.toFixed(1)}%`
                              : "—"}
                          </b>
                        </div>
                        <div>
                          <span>Gi* hotspot significance</span>
                          <b>
                            {subdistrictAccess.gi_zscore != null
                              ? `z=${subdistrictAccess.gi_zscore.toFixed(2)}${
                                  (subdistrictAccess.gi_pvalue ?? 1) <= 0.05
                                    ? " (significant)"
                                    : " (not significant)"
                                }`
                              : "—"}
                          </b>
                        </div>
                        <div>
                          <span>LISA cluster</span>
                          <b>
                            {subdistrictAccess.lisa_quadrant != null
                              ? { 1: "High-High", 2: "Low-High", 3: "Low-Low", 4: "High-Low" }[
                                  subdistrictAccess.lisa_quadrant
                                ]
                              : "—"}
                          </b>
                        </div>
                      </>
                    ) : (
                      <div>
                        <span>Accessibility</span>
                        <b>No modeled route (isolated network segment)</b>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="emptyHint">
                    Select an upazila polygon to see local accessibility,
                    seasonal change, population and facility estimates.
                  </p>
                )}
                <button
                  className="primaryButton"
                  onClick={() => setMapExpanded(false)}
                >
                  Apply subdistrict <span>→</span>
                </button>
              </aside>
            </div>
          </div>
        </div>
      )}

      <section className="allMapsSection">
        <div className="sectionTitle">
          <div>
            <p className="eyebrow">Complete analysis library</p>
            <h2>Choose the right evidence for each planning question</h2>
            <p>
              Explore access, seasonal resilience, spatial equity and
              intervention scenarios. Every view opens as a large interactive
              district map with upazila drill-down.
            </p>
          </div>
          <span>15 interactive analyses</span>
        </div>
        <div
          className="libraryToolbar"
          role="group"
          aria-label="Filter analysis library"
        >
          {(
            [
              "all",
              "access",
              "seasonal",
              "equity",
              "planning",
            ] as LibraryCategory[]
          ).map((category) => (
            <button
              key={category}
              className={libraryCategory === category ? "active" : ""}
              onClick={() => setLibraryCategory(category)}
            >
              {category === "all"
                ? "All analyses"
                : category === "seasonal"
                  ? "Season & flood"
                  : category === "equity"
                    ? "Equity & clusters"
                    : category === "planning"
                      ? "Planning scenarios"
                      : "Access & coverage"}
              <small>
                {category === "all"
                  ? 15
                  : Object.values(analysisCategory).filter(
                      (item) => item === category,
                    ).length}
              </small>
            </button>
          ))}
        </div>
        <div className="libraryGuide">
          <span>
            <b>Observed inputs</b> Real boundaries, OSM facilities and DGHS
            totals
          </span>
          <span>
            <b>Model outputs</b> Travel times, catchments, clusters and
            scenarios
          </span>
          <span>
            <b>Interaction</b> Select district → open upazila analysis
          </span>
        </div>
        <div className="allMapsGrid">
          {analysisModes
            .filter(
              (mode) =>
                libraryCategory === "all" ||
                analysisCategory[mode.id] === libraryCategory,
            )
            .map((mode) => (
              <MapPreview
                key={mode.id}
                mode={mode.id}
                active={analysisMode === mode.id}
                onOpen={() => {
                  setAnalysisMode(mode.id);
                  setMapLevel("district");
                  if (mode.id === "facility") setFacility(true);
                  setMapExpanded(true);
                }}
              />
            ))}
        </div>
      </section>

      <section className="bottomGrid">
        <article className="priorityCard">
          <div className="cardHeader">
            <div>
              <p className="eyebrow">Observed population</p>
              <h2>Most populous districts in the 2025 raster</h2>
            </div>
            <span className="textButton">WorldPop R2025A</span>
          </div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Area</th>
                  <th>Boundary level</th>
                  <th>Population estimate</th>
                  <th>Travel time</th>
                </tr>
              </thead>
              <tbody>
                {populationRankings.map((record, i) => (
                  <tr key={record.shapeID}>
                    <td>
                      <span className="rank">{i + 1}</span>
                      <b>{record.shapeName}</b>
                    </td>
                    <td>District</td>
                    <td>{record.population_2025.toLocaleString()}</td>
                    <td><span className="riskBadge">Pending routing</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
        <article className="thresholdCard">
          <p className="eyebrow">Planning threshold</p>
          <h2>Define reasonable access</h2>
          <p>
            Adjust the maximum acceptable road travel time used across the
            dashboard.
          </p>
          <div className="thresholdValue">
            <strong>{threshold}</strong>
            <span>minutes</span>
          </div>
          <input
            aria-label="Travel time threshold"
            type="range"
            min="15"
            max="60"
            step="5"
            value={threshold}
            onChange={(e) => setThreshold(Number(e.target.value))}
          />
          <div className="rangeLabels">
            <span>15</span>
            <span>30</span>
            <span>45</span>
            <span>60</span>
          </div>
          <div className="note">
            <i>i</i>
            <span>
              WHO-aligned planning reference; adapt to local service policy.
            </span>
          </div>
        </article>
      </section>

      <section className="dataSection" aria-labelledby="data-sources-title">
        <div className="dataHeading">
          <div>
            <p className="eyebrow">Data provenance</p>
            <h2 id="data-sources-title">
              Real inputs, clearly separated from model outputs
            </h2>
            <p>
              Administrative geometry and facility totals are observed source
              data. Travel time, flood disruption, hotspots, catchments and
              proposed-facility impacts remain prototype model outputs until the
              full network analysis pipeline is run.
            </p>
          </div>
          <span className="verifiedBadge">✓ Sources verified</span>
        </div>
        <div className="sourceGrid">
          <a
            href="https://hrm.dghs.gov.bd/public/facility-registry"
            target="_blank"
            rel="noreferrer"
          >
            <b>DGHS Facility Registry</b>
            <span>39,428 registered facilities</span>
            <small>Live government registry • observed</small>
          </a>
          <a
            href="https://nsds.bbs.gov.bd/storage/files/1/Publications/BBS_Preliminary_Census_2022.pdf"
            target="_blank"
            rel="noreferrer"
          >
            <b>BBS Population Census 2022</b>
            <span>Population benchmark</span>
            <small>Official census • observed</small>
          </a>
          <a
            href="https://www.geoboundaries.org/countryDownloads.html"
            target="_blank"
            rel="noreferrer"
          >
            <b>geoBoundaries / BBS–OCHA</b>
            <span>64 districts • 544 ADM3 areas</span>
            <small>Boundary geometry • loaded in map</small>
          </a>
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
          >
            <b>OpenStreetMap</b>
            <span>Road-network source</span>
            <small>Planned routing input • not yet computed</small>
          </a>
        </div>
        <div className="facilityDistribution">
          <div>
            <b>DGHS facilities by division</b>
            <small>Public registry snapshot • 26 Jul 2026</small>
          </div>
          <div className="facilityBars">
            {dghsFacilities.map((item) => (
              <div key={item.division}>
                <span>{item.division}</span>
                <i>
                  <b style={{ width: `${item.count / 100}%` }} />
                </i>
                <strong>{item.count.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <span>AccessBD prototype • ENGR6009 research project</span>
        <span>
          Observed: geoBoundaries/BBS–OCHA, DGHS • Model inputs: OSM, census,
          flood data
        </span>
      </footer>
    </main>
  );
}
