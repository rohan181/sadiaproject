"use client";

import { useMemo, useState } from "react";
import { BangladeshBoundary } from "./BangladeshBoundary";

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

const highRisk = [
  { area: "Sunamganj", division: "Sylhet", dry: 58, monsoon: 92, pop: "421k" },
  { area: "Kurigram", division: "Rangpur", dry: 51, monsoon: 78, pop: "387k" },
  { area: "Bhola", division: "Barishal", dry: 49, monsoon: 73, pop: "352k" },
  { area: "Satkhira", division: "Khulna", dry: 46, monsoon: 69, pop: "318k" },
];

type AnalysisMode = "surface" | "difference" | "catchment" | "e2sfca" | "underserved" | "hotspot" | "lisa" | "facility" | "flood" | "service" | "equity" | "priority" | "flow" | "swipe" | "isochrone";

const analysisModes: { id: AnalysisMode; icon: string; title: string; text: string; mapTitle: string; stat: string }[] = [
  { id: "surface", icon: "◒", title: "Accessibility surface", text: "Continuous travel-time zones", mapTitle: "Travel-time accessibility surface", stat: "31.6M beyond 30 min" },
  { id: "difference", icon: "↕", title: "Seasonal change", text: "Monsoon delay versus dry baseline", mapTitle: "Dry-to-monsoon travel-time increase", stat: "+16 min national average" },
  { id: "catchment", icon: "◎", title: "Facility catchments", text: "Population reachable by hospital", mapTitle: "Population within facility catchments", stat: "3.8M people covered" },
  { id: "e2sfca", icon: "Σ", title: "E2SFCA access", text: "Capacity, demand and travel time", mapTitle: "Enhanced 2-step floating catchment access", stat: "0.74 median score" },
  { id: "underserved", icon: "◉", title: "Underserved population", text: "Residents beyond the threshold", mapTitle: "Population outside reasonable access", stat: "18.6% underserved" },
  { id: "hotspot", icon: "✦", title: "Gi* hotspots", text: "Significant underserved clusters", mapTitle: "Getis-Ord Gi* access hotspots", stat: "12 high-confidence clusters" },
  { id: "lisa", icon: "▦", title: "LISA clusters", text: "Clusters and spatial outliers", mapTitle: "Local indicators of spatial association", stat: "8 spatial outliers" },
  { id: "facility", icon: "+", title: "Facility scenario", text: "Compare access before and after", mapTitle: "Access impact of a proposed clinic", stat: "−18 min improvement" },
  { id: "flood", icon: "≈", title: "Flooded roads", text: "Slowed and impassable road links", mapTitle: "Road disruption during monsoon", stat: "18.4% roads exposed" },
  { id: "service", icon: "✚", title: "Service levels", text: "Clinic, upazila and hospital access", mapTitle: "Access by healthcare service level", stat: "3 service tiers" },
  { id: "equity", icon: "≋", title: "Health equity", text: "Access versus social vulnerability", mapTitle: "Access and vulnerability equity gaps", stat: "0.41 equity gap" },
  { id: "priority", icon: "#", title: "Priority matrix", text: "Composite intervention ranking", mapTitle: "Multi-criteria planning priorities", stat: "24 priority unions" },
  { id: "flow", icon: "▶", title: "Seasonal flow", text: "Animated catchment contraction", mapTitle: "Seasonal contraction of service reach", stat: "34.2% access loss" },
  { id: "swipe", icon: "◐", title: "Dry / monsoon swipe", text: "Side-by-side seasonal comparison", mapTitle: "Dry and monsoon accessibility comparison", stat: "+16 min difference" },
  { id: "isochrone", icon: "⌾", title: "Travel isochrones", text: "15, 30 and 60-minute reach", mapTitle: "Network travel-time isochrones", stat: "3 travel bands" },
];

function MapPreview({ mode, active, onOpen }: { mode: AnalysisMode; active: boolean; onOpen: () => void }) {
  const meta = analysisModes.find((item) => item.id === mode)!;
  return <article className={`miniMapCard ${active ? "active" : ""}`} role="button" tabIndex={0} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") onOpen(); }}>
    <div className="miniMapHeader"><div><i>{meta.icon}</i><span><b>{meta.title}</b><small>{meta.text}</small></span></div><button onClick={(event) => { event.stopPropagation(); onOpen(); }}>Open big map ↗</button></div>
    <div className={`miniMap mode-${mode}`}>
      <BangladeshBoundary compact /><div className="miniRiver" />
      {mode === "difference" && <><i className="miniZone z1" /><i className="miniZone z2" /><i className="miniZone z3" /><div className="miniKey"><span>+6</span><span>+17</span><span>+28 min</span></div></>}
      {mode === "flood" && <div className="miniRoads"><i /><i /><i /><i /><i /></div>}
      {(mode === "catchment" || mode === "isochrone" || mode === "flow") && <div className={`miniRings ${mode === "flow" ? "animated" : ""}`}><i /><i /><i /><b>+</b></div>}
      {mode === "facility" && <><div className="beforeArea"><small>Before</small><b>67 min</b></div><div className="afterArea"><small>After</small><b>49 min</b></div><div className="clinicMark">+</div></>}
      {!(["difference", "flood", "catchment", "isochrone", "flow", "facility", "swipe"] as AnalysisMode[]).includes(mode) && <div className={`previewMarks kind-${mode}`}>{regions.map((r, i) => <i key={r.name} style={{ left: `${r.x}%`, top: `${r.y}%`, ["--i" as string]: i } as React.CSSProperties}>{mode === "priority" ? i + 1 : mode === "service" ? ["C", "U", "H"][i % 3] : ""}</i>)}</div>}
      {mode === "swipe" && <div className="swipeDivider"><span>Dry</span><span>Monsoon</span></div>}
    </div>
    <div className="miniMapFoot"><span>{meta.stat}</span><span>Prototype</span></div>
  </article>;
}

export default function Home() {
  const [season, setSeason] = useState<"dry" | "monsoon">("monsoon");
  const [selected, setSelected] = useState(regions[3]);
  const [facility, setFacility] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("surface");
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(null);
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<string | null>(null);
  const [mapLevel, setMapLevel] = useState<"district" | "subdistrict">("district");
  const [mapExpanded, setMapExpanded] = useState(false);

  const metrics = useMemo(() => {
    const reduction = facility ? 9 : 0;
    return season === "monsoon"
      ? { avg: 48 - reduction, underserved: facility ? 14.2 : 18.7, population: facility ? 24.1 : 31.6 }
      : { avg: 32 - reduction, underserved: facility ? 8.1 : 11.4, population: facility ? 13.8 : 19.2 };
  }, [season, facility]);

  const districtMetrics = useMemo(() => {
    if (!selectedDistrict) return null;
    const seed = selectedDistrict.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    const dry = 18 + seed % 38;
    return { dry, monsoon: dry + 8 + seed % 24, population: (0.45 + (seed % 190) / 100).toFixed(2), underserved: 14 + seed % 39, facilities: 9 + seed % 36 };
  }, [selectedDistrict]);

  const subdistrictMetrics = useMemo(() => {
    if (!selectedSubdistrict) return null;
    const seed = selectedSubdistrict.split("").reduce((sum, letter) => sum + letter.charCodeAt(0), 0);
    const dry = 12 + seed % 42;
    return { dry, monsoon: dry + 7 + seed % 22, population: (0.08 + (seed % 62) / 100).toFixed(2), underserved: 9 + seed % 48, facilities: 2 + seed % 13 };
  }, [selectedSubdistrict]);

  return (
    <main>
      <header className="topbar">
        <div className="brand">
          <span className="brandmark">A</span>
          <div><strong>AccessBD</strong><small>Healthcare spatial intelligence</small></div>
        </div>
        <div className="headerActions">
          <span className="status"><i /> Prototype data</span>
          <button className="iconButton" aria-label="Notifications">●</button>
          <div className="avatar">DG</div>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">National access overview</p>
          <h1>See where healthcare<br />is hardest to reach.</h1>
          <p className="intro">Compare road-based travel times across seasons and identify the communities where new services can make the greatest difference.</p>
        </div>
        <div className="seasonControl" aria-label="Season selector">
          <button className={season === "dry" ? "active" : ""} onClick={() => setSeason("dry")}><span>☀</span> Dry season</button>
          <button className={season === "monsoon" ? "active" : ""} onClick={() => setSeason("monsoon")}><span>⌁</span> Monsoon</button>
        </div>
      </section>

      <section className="metricGrid">
        <article className="metric"><div className="metricTop"><span>Average travel time</span><i className="dot teal" /></div><strong>{metrics.avg}<small> min</small></strong><p><b className={season === "monsoon" ? "bad" : "good"}>{season === "monsoon" ? "+16 min" : "−16 min"}</b> vs. {season === "monsoon" ? "dry" : "monsoon"} season</p></article>
        <article className="metric"><div className="metricTop"><span>Underserved unions</span><i className="dot amber" /></div><strong>{metrics.underserved}<small>%</small></strong><p>{facility ? "Scenario estimate" : "1,061 of 4,554 unions"}</p></article>
        <article className="metric"><div className="metricTop"><span>Population beyond {threshold} min</span><i className="dot coral" /></div><strong>{metrics.population}<small>M</small></strong><p>{facility ? "7.5M fewer people at risk" : "18.6% of national population"}</p></article>
        <article className="metric impact"><div className="metricTop"><span>Seasonal access loss</span><i className="dot blue" /></div><strong>{season === "monsoon" ? "34.2" : "0"}<small>%</small></strong><p>Road access affected by flooding</p></article>
      </section>

      <section className="analysisStrip" aria-label="Map analysis type">
        <div className="analysisIntro"><p className="eyebrow">Analysis layers</p><h2>Choose a planning view</h2></div>
        <div className="analysisOptions">
          {analysisModes.map((mode) => <button key={mode.id} className={analysisMode === mode.id ? "active" : ""} onClick={() => { setAnalysisMode(mode.id); if (mode.id === "facility") setFacility(true); }}><i>{mode.icon}</i><span><b>{mode.title}</b><small>{mode.text}</small></span></button>)}
        </div>
      </section>

      <section className="dashboardGrid">
        <article className="mapCard">
          <div className="cardHeader">
            <div><p className="eyebrow">{analysisModes.find((m) => m.id === analysisMode)?.title} map</p><h2>{analysisModes.find((m) => m.id === analysisMode)?.mapTitle}</h2></div>
            <div className="mapTools"><span className="liveLayer"><i /> 64 districts • 544 subdistricts</span><button aria-label="Open large map" onClick={() => { setMapLevel("district"); setMapExpanded(true); }}>Expand ↗</button></div>
          </div>
          <div className={`mapArea mode-${analysisMode}`}>
            <div className="river riverOne" /><div className="river riverTwo" />
            <BangladeshBoundary interactive selectedDistrict={selectedDistrict} onDistrictSelect={setSelectedDistrict} />
            {analysisMode === "flood" && <div className="floodRoads" aria-hidden="true"><i className="road r1" /><i className="road r2" /><i className="road r3" /><i className="road r4" /><i className="road r5" /><i className="road r6" /></div>}
            {(analysisMode === "catchment" || analysisMode === "isochrone" || analysisMode === "flow") && <div className={`catchments ${analysisMode === "flow" ? "animated" : ""}`} aria-hidden="true"><i className="catch c60" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /><i className="catch c30" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /><i className="catch c15" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /></div>}
            {!(["difference", "flood", "catchment", "isochrone", "flow", "facility", "swipe"] as AnalysisMode[]).includes(analysisMode) && <div className={`analysisOverlay kind-${analysisMode}`}>{regions.map((r, i) => <i key={r.name} style={{ left: `${r.x}%`, top: `${r.y}%`, ["--i" as string]: i } as React.CSSProperties}>{analysisMode === "priority" ? i + 1 : analysisMode === "service" ? ["C", "U", "H"][i % 3] : ""}</i>)}</div>}
            {analysisMode === "swipe" && <div className="fullSwipe"><div><span>Dry season</span></div><i /><div><span>Monsoon</span></div></div>}
            {regions.map((r) => {
              const baseValue = analysisMode === "difference" ? r.monsoon - r.dry : ["catchment", "isochrone"].includes(analysisMode) ? Math.round(92 - r[season]) : analysisMode === "e2sfca" ? Math.round((100 - r[season]) / 10) : analysisMode === "underserved" ? Math.round(r.people * r[season] / 4) : r[season];
              const value = Math.max(10, baseValue - (facility && analysisMode === "facility" && r.name === selected.name ? 18 : 0));
              const risk = value > 50 ? "high" : value > 35 ? "medium" : "low";
              return <button key={r.name} className={`region ${risk} ${selected.name === r.name ? "selected" : ""}`} style={{ left: `${r.x}%`, top: `${r.y}%` }} onClick={() => setSelected(r)} aria-label={`${r.name}, ${value}`}><span>{r.name}</span><b>{value}{analysisMode === "difference" ? "+" : ["catchment", "isochrone"].includes(analysisMode) ? "%" : analysisMode === "e2sfca" ? "/10" : analysisMode === "underserved" ? "k" : ""}</b></button>;
            })}
            {analysisMode === "facility" && <button className="proposedPin" style={{ left: `${selected.x + 4}%`, top: `${selected.y + 6}%` }} aria-label={`Proposed clinic in ${selected.name}`}><b>+</b><span>Proposed clinic</span></button>}
            <div className="mapZoom"><button>+</button><button>−</button></div>
            {analysisMode === "difference" && <div className="legend"><span><i className="low" /> +0–10 min</span><span><i className="medium" /> +11–20</span><span><i className="high" /> +21+</span></div>}
            {analysisMode === "flood" && <div className="legend"><span><i className="roadOpen" /> Open</span><span><i className="roadSlow" /> Slowed</span><span><i className="roadClosed" /> Impassable</span></div>}
            {analysisMode === "catchment" && <div className="legend"><span><i className="ring15" /> 15 min</span><span><i className="ring30" /> 30 min</span><span><i className="ring60" /> 60 min</span></div>}
            {analysisMode === "facility" && <div className="legend"><span><i className="currentDot" /> Current access</span><span><i className="proposalDot" /> Improved</span></div>}
            {!(["difference", "flood", "catchment", "facility"] as AnalysisMode[]).includes(analysisMode) && <div className="legend"><span><i className="low" /> Low</span><span><i className="medium" /> Moderate</span><span><i className="high" /> High</span></div>}
          </div>
          <div className="mapFooter"><span>{analysisMode === "flood" ? "BWDB flood zones • OSM road network" : analysisMode === "catchment" ? "Network isochrones • Population-weighted" : "Road-network model • Union-level estimate"}</span><span>Prototype analysis</span></div>
        </article>

        <aside className="sidePanel">
          <div className="panelHeader"><p className="eyebrow">{selectedDistrict ? "Selected district" : "Area detail"}</p><h2>{selectedDistrict ? `${selectedDistrict} District` : `${selected.name} Division`}</h2><span>{season === "monsoon" ? "Monsoon scenario" : "Dry-season baseline"}</span></div>
          <div className="timeRing"><div><strong>{districtMetrics ? districtMetrics[season] : Math.max(10, selected[season] - (facility ? 18 : 0))}</strong><small>min avg.</small></div></div>
          <div className="detailRows">
            <div><span>Population</span><b>{districtMetrics ? districtMetrics.population : selected.people}M</b></div>
            <div><span>Population beyond {threshold} min</span><b>{districtMetrics ? districtMetrics.underserved : facility ? "21" : selected[season] > 50 ? "46" : "28"}%</b></div>
            <div><span>Seasonal change</span><b className="bad">+{districtMetrics ? districtMetrics.monsoon - districtMetrics.dry : selected.monsoon - selected.dry} min</b></div>
            {districtMetrics && <div><span>Mapped facilities</span><b>{districtMetrics.facilities}</b></div>}
          </div>
          {districtMetrics && <div className="districtCompare"><p className="eyebrow">Dry / monsoon comparison</p><div><span><small>Dry</small><b>{districtMetrics.dry} min</b></span><i>→</i><span><small>Monsoon</small><b>{districtMetrics.monsoon} min</b></span></div><button onClick={() => setMapExpanded(true)}>Open district in big map ↗</button></div>}
          {selectedDistrict && <button className="subdistrictButton" onClick={() => { setMapLevel("subdistrict"); setSelectedSubdistrict(null); setMapExpanded(true); }}><span><b>Explore subdistrict analysis</b><small>Open 544 real upazila boundaries</small></span><i>→</i></button>}
          {analysisMode === "facility" && <div className="comparisonPanel"><p className="eyebrow">Before / after</p><div><span><small>Current</small><b>{selected[season]} min</b></span><i>→</i><span className="improved"><small>With clinic</small><b>{Math.max(10, selected[season] - 18)} min</b></span></div><p><b>{Math.min(820, Math.round(selected.people * 126))}k</b> people gain access within {threshold} minutes</p></div>}
          <div className="scenarioBox"><div><p className="eyebrow">Planning scenario</p><h3>Add a community clinic</h3></div><label><input type="checkbox" checked={facility} onChange={(e) => setFacility(e.target.checked)} /><span /></label></div>
          <p className="scenarioHint">{facility ? `Estimated access improvement applied to ${selected.name}.` : "Turn on to estimate the local impact of one new facility."}</p>
          <button className="primaryButton">View full area analysis <span>→</span></button>
        </aside>
      </section>

      {mapExpanded && <div className="mapModal" role="dialog" aria-modal="true" aria-label="Interactive Bangladesh analysis map"><div className="mapModalPanel"><div className="mapModalHeader"><div><p className="eyebrow">{analysisModes.find((mode) => mode.id === analysisMode)?.title} • Full map</p><h2>{analysisModes.find((mode) => mode.id === analysisMode)?.mapTitle}</h2><span>Tap any of Bangladesh’s 64 districts to inspect and compare access</span></div><button onClick={() => setMapExpanded(false)} aria-label="Close large map">×</button></div><div className="mapModalBody"><div className={`bigMap mode-${analysisMode}`}><BangladeshBoundary interactive selectedDistrict={selectedDistrict} onDistrictSelect={setSelectedDistrict} />{analysisMode === "flood" && <div className="floodRoads"><i className="road r1" /><i className="road r2" /><i className="road r3" /><i className="road r4" /><i className="road r5" /><i className="road r6" /></div>}{(analysisMode === "catchment" || analysisMode === "isochrone" || analysisMode === "flow") && <div className={`catchments ${analysisMode === "flow" ? "animated" : ""}`}><i className="catch c60" style={{ left: "51%", top: "48%" }} /><i className="catch c30" style={{ left: "51%", top: "48%" }} /><i className="catch c15" style={{ left: "51%", top: "48%" }} /></div>}{!(["difference", "flood", "catchment", "isochrone", "flow", "facility", "swipe"] as AnalysisMode[]).includes(analysisMode) && <div className={`analysisOverlay kind-${analysisMode}`}>{regions.map((r, i) => <i key={r.name} style={{ left: `${r.x}%`, top: `${r.y}%`, ["--i" as string]: i } as React.CSSProperties}>{analysisMode === "priority" ? i + 1 : analysisMode === "service" ? ["C", "U", "H"][i % 3] : ""}</i>)}</div>}{analysisMode === "swipe" && <div className="fullSwipe"><div><span>Dry season</span></div><i /><div><span>Monsoon</span></div></div>}{analysisMode === "flow" && <div className="flowStory"><div className="flowPulse p1" /><div className="flowPulse p2" /><div className="flowPulse p3" /><div className="flowTimeline"><span>Dry</span><i><b /></i><span>Early monsoon</span><i><b /></i><span>Peak flood</span></div></div>}<div className="bigMapLegend"><span><i className="low" /> Lower access burden</span><span><i className="medium" /> Moderate</span><span><i className="high" /> Highest priority</span></div></div><aside><p className="eyebrow">Selected location</p><h3>{selectedDistrict ? `${selectedDistrict} District` : "Choose a district"}</h3><div className="activeAnalysis"><small>Active analysis</small><b>{analysisModes.find((mode) => mode.id === analysisMode)?.title}</b><span>{analysisModes.find((mode) => mode.id === analysisMode)?.stat}</span></div>{districtMetrics ? <><div className="modalCompare"><span><small>Dry travel</small><b>{districtMetrics.dry} min</b></span><span><small>Monsoon</small><b>{districtMetrics.monsoon} min</b></span></div><div className="detailRows"><div><span>Population</span><b>{districtMetrics.population}M</b></div><div><span>Beyond threshold</span><b>{districtMetrics.underserved}%</b></div><div><span>Facilities</span><b>{districtMetrics.facilities}</b></div></div></> : <p className="emptyHint">All 64 district polygons are interactive and use their real geographic boundaries.</p>}<button className="primaryButton" onClick={() => setMapExpanded(false)}>Apply selection <span>→</span></button></aside></div></div></div>}

      {mapExpanded && mapLevel === "subdistrict" && <div className="mapModal subLevel" role="dialog" aria-modal="true" aria-label="Interactive Bangladesh subdistrict analysis map"><div className="mapModalPanel"><div className="mapModalHeader"><div><p className="eyebrow">Subdistrict analysis • {analysisModes.find((mode) => mode.id === analysisMode)?.title}</p><h2>Bangladesh upazila accessibility explorer</h2><span>Real ADM3 geography • Tap any of 544 subdistrict polygons</span></div><button onClick={() => setMapExpanded(false)} aria-label="Close subdistrict map">×</button></div><div className="adminLevelBar"><button onClick={() => setMapLevel("district")}>← District level</button><span>District <b>→</b> Subdistrict / Upazila</span><strong>544 real boundaries</strong></div><div className="mapModalBody"><div className={`bigMap subdistrictMap mode-${analysisMode}`}><BangladeshBoundary interactive level="subdistrict" selectedDistrict={selectedDistrict} selectedSubdistrict={selectedSubdistrict} onSubdistrictSelect={setSelectedSubdistrict} />{analysisMode === "flow" && <div className="flowStory"><div className="flowPulse p1" /><div className="flowPulse p2" /><div className="flowPulse p3" /><div className="flowTimeline"><span>Dry</span><i><b /></i><span>Early monsoon</span><i><b /></i><span>Peak flood</span></div></div>}<div className="bigMapLegend"><span><i className="low" /> Better access</span><span><i className="medium" /> Moderate</span><span><i className="high" /> Underserved</span></div></div><aside><p className="eyebrow">Selected subdistrict</p><h3>{selectedSubdistrict ? `${selectedSubdistrict} Upazila` : "Choose a subdistrict"}</h3><div className="activeAnalysis"><small>Parent selection</small><b>{selectedDistrict ? `${selectedDistrict} District` : "Bangladesh"}</b><span>{analysisModes.find((mode) => mode.id === analysisMode)?.title}</span></div>{subdistrictMetrics ? <><div className="modalCompare"><span><small>Dry travel</small><b>{subdistrictMetrics.dry} min</b></span><span><small>Monsoon</small><b>{subdistrictMetrics.monsoon} min</b></span></div><div className="detailRows"><div><span>Population</span><b>{subdistrictMetrics.population}M</b></div><div><span>Beyond threshold</span><b>{subdistrictMetrics.underserved}%</b></div><div><span>Facilities</span><b>{subdistrictMetrics.facilities}</b></div></div></> : <p className="emptyHint">Select an upazila polygon to see local accessibility, seasonal change, population and facility estimates.</p>}<button className="primaryButton" onClick={() => setMapExpanded(false)}>Apply subdistrict <span>→</span></button></aside></div></div></div>}

      <section className="allMapsSection">
        <div className="sectionTitle"><div><p className="eyebrow">Complete analysis library</p><h2>All healthcare-accessibility map views</h2><p>Review all 15 analytical lenses, then open any view in the interactive map above.</p></div><span>15 analysis maps</span></div>
        <div className="allMapsGrid">{analysisModes.map((mode) => <MapPreview key={mode.id} mode={mode.id} active={analysisMode === mode.id} onOpen={() => { setAnalysisMode(mode.id); setMapLevel("district"); if (mode.id === "facility") setFacility(true); setMapExpanded(true); }} />)}</div>
      </section>

      <section className="bottomGrid">
        <article className="priorityCard">
          <div className="cardHeader"><div><p className="eyebrow">Priority areas</p><h2>Communities with the largest access gap</h2></div><button className="textButton">View all 24 →</button></div>
          <div className="tableWrap"><table><thead><tr><th>Area</th><th>Division</th><th>Dry</th><th>Monsoon</th><th>People affected</th></tr></thead><tbody>{highRisk.map((r, i) => <tr key={r.area}><td><span className="rank">{i + 1}</span><b>{r.area}</b></td><td>{r.division}</td><td>{r.dry} min</td><td><span className="riskBadge">{r.monsoon} min</span></td><td>{r.pop}</td></tr>)}</tbody></table></div>
        </article>
        <article className="thresholdCard">
          <p className="eyebrow">Planning threshold</p><h2>Define reasonable access</h2><p>Adjust the maximum acceptable road travel time used across the dashboard.</p>
          <div className="thresholdValue"><strong>{threshold}</strong><span>minutes</span></div>
          <input aria-label="Travel time threshold" type="range" min="15" max="60" step="5" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          <div className="rangeLabels"><span>15</span><span>30</span><span>45</span><span>60</span></div>
          <div className="note"><i>i</i><span>WHO-aligned planning reference; adapt to local service policy.</span></div>
        </article>
      </section>

      <footer><span>AccessBD prototype • ENGR6009 research project</span><span>OpenStreetMap · WorldPop · BWDB · DGHS</span></footer>
    </main>
  );
}
