"use client";

import { useEffect, useState } from "react";

type Manifest = { status: string; generatedAt: string | null; method: string; featureCount: number; nextStep?: string };

export function PipelineStatus() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  useEffect(() => { fetch("/data/analysis/manifest.json").then((response) => response.json()).then(setManifest).catch(() => setManifest(null)); }, []);
  return <section className="pipelineStatus"><div><p className="eyebrow">Analysis engine</p><h2>Reproducible GIS pipeline</h2><p>PostGIS and pgRouting calculate accessibility, Snakemake records every stage, and PySAL produces significance-tested spatial statistics.</p></div><div className="pipelineSteps"><span className="ready"><i>1</i><b>Next.js + Leaflet</b><small>Interactive frontend</small></span><span className="ready"><i>2</i><b>PostGIS + pgRouting</b><small>Schema configured</small></span><span className="ready"><i>3</i><b>Snakemake + Python</b><small>Workflow scaffolded</small></span><span className={manifest?.status === "complete" ? "ready" : "waiting"}><i>4</i><b>Genuine outputs</b><small>{manifest?.status === "complete" ? `${manifest.featureCount} areas generated` : "Source loading required"}</small></span></div><div className="pipelineFoot"><span><b>Status</b> {manifest?.status ?? "checking"}</span><span><b>Method</b> {manifest?.method ?? "PostGIS/pgRouting + PySAL"}</span><span><b>Next</b> {manifest?.nextStep ?? "Run the workflow"}</span></div></section>;
}
