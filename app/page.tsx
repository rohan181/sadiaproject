"use client";

import { useMemo, useState } from "react";
import { BangladeshBoundary } from "./BangladeshBoundary";

const regions = [
  { name: "Rangpur", x: 42, y: 13, dry: 38, monsoon: 51, people: 3.2 },
  { name: "Rajshahi", x: 31, y: 34, dry: 31, monsoon: 43, people: 4.1 },
  { name: "Mymensingh", x: 57, y: 31, dry: 27, monsoon: 39, people: 3.4 },
  { name: "Sylhet", x: 76, y: 28, dry: 42, monsoon: 67, people: 2.7 },
  { name: "Dhaka", x: 53, y: 48, dry: 19, monsoon: 27, people: 6.3 },
  { name: "Khulna", x: 33, y: 65, dry: 35, monsoon: 52, people: 3.8 },
  { name: "Barishal", x: 48, y: 72, dry: 39, monsoon: 61, people: 2.9 },
  { name: "Chattogram", x: 70, y: 66, dry: 36, monsoon: 55, people: 4.6 },
];

const highRisk = [
  { area: "Sunamganj", division: "Sylhet", dry: 58, monsoon: 92, pop: "421k" },
  { area: "Kurigram", division: "Rangpur", dry: 51, monsoon: 78, pop: "387k" },
  { area: "Bhola", division: "Barishal", dry: 49, monsoon: 73, pop: "352k" },
  { area: "Satkhira", division: "Khulna", dry: 46, monsoon: 69, pop: "318k" },
];

type AnalysisMode = "difference" | "flood" | "catchment" | "facility";

const analysisModes: { id: AnalysisMode; icon: string; title: string; text: string }[] = [
  { id: "difference", icon: "↕", title: "Seasonal change", text: "Monsoon delay versus dry baseline" },
  { id: "flood", icon: "≈", title: "Flooded roads", text: "Slowed and impassable road links" },
  { id: "catchment", icon: "◎", title: "Facility catchments", text: "15, 30 and 60-minute service reach" },
  { id: "facility", icon: "+", title: "Proposed facility", text: "Compare access before and after" },
];

function MapPreview({ mode, active, onOpen }: { mode: AnalysisMode; active: boolean; onOpen: () => void }) {
  const meta = analysisModes.find((item) => item.id === mode)!;
  return <article className={`miniMapCard ${active ? "active" : ""}`}>
    <div className="miniMapHeader"><div><i>{meta.icon}</i><span><b>{meta.title}</b><small>{meta.text}</small></span></div><button onClick={onOpen}>Explore ↗</button></div>
    <div className={`miniMap mode-${mode}`}>
      <BangladeshBoundary compact /><div className="miniRiver" />
      {mode === "difference" && <><i className="miniZone z1" /><i className="miniZone z2" /><i className="miniZone z3" /><div className="miniKey"><span>+6</span><span>+17</span><span>+28 min</span></div></>}
      {mode === "flood" && <div className="miniRoads"><i /><i /><i /><i /><i /></div>}
      {mode === "catchment" && <div className="miniRings"><i /><i /><i /><b>+</b></div>}
      {mode === "facility" && <><div className="beforeArea"><small>Before</small><b>67 min</b></div><div className="afterArea"><small>After</small><b>49 min</b></div><div className="clinicMark">+</div></>}
    </div>
    <div className="miniMapFoot"><span>{mode === "flood" ? "18.4% roads exposed" : mode === "catchment" ? "3.8M people covered" : mode === "facility" ? "−18 min improvement" : "+16 min national average"}</span><span>Prototype</span></div>
  </article>;
}

export default function Home() {
  const [season, setSeason] = useState<"dry" | "monsoon">("monsoon");
  const [selected, setSelected] = useState(regions[3]);
  const [facility, setFacility] = useState(false);
  const [threshold, setThreshold] = useState(30);
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("difference");

  const metrics = useMemo(() => {
    const reduction = facility ? 9 : 0;
    return season === "monsoon"
      ? { avg: 48 - reduction, underserved: facility ? 14.2 : 18.7, population: facility ? 24.1 : 31.6 }
      : { avg: 32 - reduction, underserved: facility ? 8.1 : 11.4, population: facility ? 13.8 : 19.2 };
  }, [season, facility]);

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
            <div><p className="eyebrow">{analysisModes.find((m) => m.id === analysisMode)?.title} map</p><h2>{analysisMode === "difference" ? "Dry-to-monsoon travel-time increase" : analysisMode === "flood" ? "Road disruption during monsoon" : analysisMode === "catchment" ? "Population within facility catchments" : "Access impact of a proposed clinic"}</h2></div>
            <div className="mapTools"><span className="liveLayer"><i /> Layer active</span><button aria-label="Expand map">↗</button></div>
          </div>
          <div className={`mapArea mode-${analysisMode}`}>
            <div className="river riverOne" /><div className="river riverTwo" />
            <BangladeshBoundary />
            {analysisMode === "flood" && <div className="floodRoads" aria-hidden="true"><i className="road r1" /><i className="road r2" /><i className="road r3" /><i className="road r4" /><i className="road r5" /><i className="road r6" /></div>}
            {analysisMode === "catchment" && <div className="catchments" aria-hidden="true"><i className="catch c60" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /><i className="catch c30" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /><i className="catch c15" style={{ left: `${selected.x}%`, top: `${selected.y}%` }} /></div>}
            {regions.map((r) => {
              const baseValue = analysisMode === "difference" ? r.monsoon - r.dry : analysisMode === "catchment" ? Math.round(92 - r[season]) : r[season];
              const value = Math.max(10, baseValue - (facility && analysisMode === "facility" && r.name === selected.name ? 18 : 0));
              const risk = value > 50 ? "high" : value > 35 ? "medium" : "low";
              return <button key={r.name} className={`region ${risk} ${selected.name === r.name ? "selected" : ""}`} style={{ left: `${r.x}%`, top: `${r.y}%` }} onClick={() => setSelected(r)} aria-label={`${r.name}, ${value}`}><span>{r.name}</span><b>{value}{analysisMode === "difference" ? "+" : analysisMode === "catchment" ? "%" : ""}</b></button>;
            })}
            {analysisMode === "facility" && <button className="proposedPin" style={{ left: `${selected.x + 4}%`, top: `${selected.y + 6}%` }} aria-label={`Proposed clinic in ${selected.name}`}><b>+</b><span>Proposed clinic</span></button>}
            <div className="mapZoom"><button>+</button><button>−</button></div>
            {analysisMode === "difference" && <div className="legend"><span><i className="low" /> +0–10 min</span><span><i className="medium" /> +11–20</span><span><i className="high" /> +21+</span></div>}
            {analysisMode === "flood" && <div className="legend"><span><i className="roadOpen" /> Open</span><span><i className="roadSlow" /> Slowed</span><span><i className="roadClosed" /> Impassable</span></div>}
            {analysisMode === "catchment" && <div className="legend"><span><i className="ring15" /> 15 min</span><span><i className="ring30" /> 30 min</span><span><i className="ring60" /> 60 min</span></div>}
            {analysisMode === "facility" && <div className="legend"><span><i className="currentDot" /> Current access</span><span><i className="proposalDot" /> Improved</span></div>}
          </div>
          <div className="mapFooter"><span>{analysisMode === "flood" ? "BWDB flood zones • OSM road network" : analysisMode === "catchment" ? "Network isochrones • Population-weighted" : "Road-network model • Union-level estimate"}</span><span>Prototype analysis</span></div>
        </article>

        <aside className="sidePanel">
          <div className="panelHeader"><p className="eyebrow">Area detail</p><h2>{selected.name} Division</h2><span>{season === "monsoon" ? "Monsoon scenario" : "Dry-season baseline"}</span></div>
          <div className="timeRing"><div><strong>{Math.max(10, selected[season] - (facility ? 18 : 0))}</strong><small>min avg.</small></div></div>
          <div className="detailRows">
            <div><span>Population</span><b>{selected.people}M</b></div>
            <div><span>Unions over {threshold} min</span><b>{facility ? "21%" : selected[season] > 50 ? "46%" : "28%"}</b></div>
            <div><span>Seasonal change</span><b className="bad">+{selected.monsoon - selected.dry} min</b></div>
          </div>
          {analysisMode === "facility" && <div className="comparisonPanel"><p className="eyebrow">Before / after</p><div><span><small>Current</small><b>{selected[season]} min</b></span><i>→</i><span className="improved"><small>With clinic</small><b>{Math.max(10, selected[season] - 18)} min</b></span></div><p><b>{Math.min(820, Math.round(selected.people * 126))}k</b> people gain access within {threshold} minutes</p></div>}
          <div className="scenarioBox"><div><p className="eyebrow">Planning scenario</p><h3>Add a community clinic</h3></div><label><input type="checkbox" checked={facility} onChange={(e) => setFacility(e.target.checked)} /><span /></label></div>
          <p className="scenarioHint">{facility ? `Estimated access improvement applied to ${selected.name}.` : "Turn on to estimate the local impact of one new facility."}</p>
          <button className="primaryButton">View full area analysis <span>→</span></button>
        </aside>
      </section>

      <section className="allMapsSection">
        <div className="sectionTitle"><div><p className="eyebrow">All map views</p><h2>Compare every spatial lens</h2><p>Review the complete analysis set together, then open any view in the interactive map above.</p></div><span>4 analysis maps</span></div>
        <div className="allMapsGrid">{analysisModes.map((mode) => <MapPreview key={mode.id} mode={mode.id} active={analysisMode === mode.id} onOpen={() => { setAnalysisMode(mode.id); if (mode.id === "facility") setFacility(true); window.scrollTo({ top: 540, behavior: "smooth" }); }} />)}</div>
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
