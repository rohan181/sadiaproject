# AccessBD

Healthcare accessibility research platform for Bangladesh. Combines real
WorldPop population, OpenStreetMap roads and facilities, the DGHS facility
registry, and FFWC flood data to model road-network travel time to
healthcare, with a Next.js/Leaflet frontend and a PostGIS/pgRouting/PySAL
analysis pipeline.

## Architecture

- `app/` — Next.js/Vinext frontend with Leaflet maps.
- `pipeline/` — Python/Snakemake/PySAL spatial analysis pipeline.
- `pipeline/data/` — downloaded source datasets (gitignored; see
  `pipeline/data/README.md` for exact URLs and checksums).
- `pipeline/sql/` — PostgreSQL/PostGIS/pgRouting schema.
- `compose.yaml` — local PostGIS/pgRouting (and optional Valhalla) service.
- `public/data/` — committed, dashboard-ready outputs the frontend reads
  directly, so the app runs without Docker/Python for everyday use.

## Quick start — just the dashboard

Generated outputs are already committed under `public/data/`, so you can run
the frontend without Docker, Python, or a database:

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Full setup — regenerate the analysis from source data

Only needed if you're changing source data, tuning the pipeline, or want to
verify the numbers yourself end to end.

### Prerequisites

- Node.js >= 22.13.0
- Docker Desktop (for PostGIS/pgRouting) — https://www.docker.com/products/docker-desktop/
  On macOS: `brew install --cask docker`, then launch the app once so the
  daemon actually starts (`docker info` should succeed with no errors).
- Python 3.11+
- `osmium-tool`, used to filter the OSM road extract before it's parsed:
  `brew install osmium-tool` (macOS) or `apt install osmium-tool`
  (Debian/Ubuntu).

### 1. Download the source datasets

`pipeline/data/` is gitignored, so a fresh clone doesn't include the raw
files. Download each one to the path documented — with its exact URL and
SHA-256 — in `pipeline/data/README.md`:

| File | Source |
|---|---|
| `pipeline/data/population/bgd_population_2025_100m.tif` | WorldPop Global2 R2025A v1, Bangladesh, 2025 |
| `pipeline/data/osm/bangladesh-latest.osm.pbf` | Geofabrik Bangladesh OSM extract |
| `pipeline/data/facilities/dghs_organization_list.xls` | Bangladesh DGHS Facility Registry |
| `pipeline/data/flood/ffwc_inundation_2020_model.tif` | FFWC/BWDB 2020 inundation model |
| `pipeline/data/flood/ffwc_inundation_2020_satellite.tif` | FFWC Sentinel-1 comparison layer |

Verify each download's SHA-256 against `pipeline/data/README.md` yourself —
`validate_inputs` refuses to run when a file is *missing*, but it does not
check checksums for you.

Then derive the coordinate-bearing facility CSV from the OSM extract (the
DGHS registry above has no usable lat/long, so this is the pipeline's
facility input until an authenticated DGHS coordinate export exists):

```bash
cd pipeline
python scripts/extract_osm_facilities.py \
  --input data/osm/bangladesh-latest.osm.pbf \
  --csv data/facilities/osm_healthcare_facilities.csv \
  --geojson ../public/data/observed/osm-healthcare-facilities.geojson
```

### 2. Start PostGIS/pgRouting

```bash
docker compose up -d postgis
```

Wait for it to report healthy: `docker compose ps`.

### 3. Python environment

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
```

### 4. Run the pipeline

```bash
cd pipeline
snakemake --cores 4 --dry-run   # sanity-check the plan first
snakemake --cores 4
```

This chains: validate inputs → filter and topologize the OSM road network →
load facilities and population origins (one point per upazila) → snap both
to the network → route with pgRouting for the dry and monsoon seasons →
compute Gi*/LISA spatial statistics with PySAL → export to
`public/data/analysis/`. See `pipeline/README.md` for what each stage does
and why.

Expect the full run to take several minutes — `load_roads` builds a network
of 800k+ edges from the OSM extract, and `route_access` runs real pgRouting
Dijkstra for every population origin against every facility.

To regenerate only the WorldPop population aggregates, without touching
Docker or Postgres at all:

```bash
cd pipeline
snakemake --cores 2 ../public/data/observed/district-population-2025.json ../public/data/observed/subdistrict-population-2025.json
```

### 5. Run the frontend against the fresh output

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the "Analysis engine" panel should read
**Status: complete**, and the Accessibility surface / Underserved population
/ Gi* hotspots / LISA clusters views should render a real colored map
instead of the flat placeholder.

### Shutting down

```bash
docker compose down   # stop Postgres; add -v only to also wipe loaded data
```

Enable Valhalla when live matrix or isochrone services are required:

```bash
docker compose --profile valhalla up -d
```

### Troubleshooting

- **`docker compose up` fails to pull the postgis image**: the pinned tag in
  `compose.yaml` may have been removed from Docker Hub. Check available tags
  at https://hub.docker.com/r/pgrouting/pgrouting/tags and update the pin.
- **`Routing produced no results; verify snapped road_vertex_id values`**:
  `network.roads`/`network.vertices` are probably still empty — make sure
  `load_roads` and `load_facilities_and_origins` both finished before
  `route_access` ran (Snakemake orders this automatically; seeing this
  usually means an earlier stage failed silently — check its output).
  Re-running `snakemake --cores 4` picks up from the failed stage.
- **A `ModuleNotFoundError` for a Python package**: re-run
  `pip install -r pipeline/requirements.txt` inside the activated `.venv`.
- **Some upazilas always show "no modeled route"**: expected — it reflects
  disconnected fragments in the real OSM road graph, not a bug.

## Original starter notes

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
