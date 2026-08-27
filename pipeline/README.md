# AccessBD spatial pipeline

This directory converts versioned source data into dashboard-ready geospatial results. It never falls back to synthetic values.

## Required source contracts

### Facility coordinates CSV

Required columns: `facility_id`, `name`, `longitude`, `latitude`, `facility_type`.
Optional capacity columns: `beds`, `doctors`, `service_level`.

The current preliminary configuration uses real mapped healthcare locations
extracted from OpenStreetMap. Replace it with an authenticated DGHS coordinate
export for the authoritative model; never infer missing DGHS coordinates.

### WorldPop raster

GeoTIFF containing population counts per cell. The pipeline must be calibrated so aggregated cells agree with the selected BBS census or projection year.

### OSM network

Bangladesh `.osm.pbf` extract. Roads must be transformed into `network.roads`, topologized, and assigned dry and monsoon costs before routing.

### Flood data

Observed or historical FFWC/BWDB-derived flood extent. Station readings alone cannot identify flooded roads; they must be linked to an extent or hydrodynamic surface.

## Database preparation contract

Before `snakemake` calculates results, the `filter_roads_pbf` / `load_roads` /
`load_facilities_and_origins` rules run automatically and:

1. Load facilities into `source.facilities` (`scripts/load_facilities_and_origins.py`).
2. Convert WorldPop cells into `source.population_origins`. Origins are one
   point per upazila (ADM3), not one per 100 m raster cell: routing ~600k raw
   cells is not tractable on a single machine, and `analysis.admin_results`
   is aggregated at district/upazila level anyway. Each origin reuses the
   already-computed WorldPop zonal sum for that upazila
   (`../public/data/observed/subdistrict-population-2025.json`) and a
   representative point guaranteed to fall inside the polygon.
3. Load and topologize OSM roads in `network.roads` (`scripts/load_roads.py`).
   OSM node IDs are reused directly as pgRouting vertex IDs — a node becomes a
   vertex if it is a way endpoint or shared by two or more qualifying ways —
   which keeps real intersections connected without a distance-tolerance
   snap. Only the road classes with a configured `speed_kph` are included.
4. Snap every facility and population origin to a road vertex and populate
   `road_vertex_id` (nearest-neighbour KNN against `network.vertices`).
5. Intersect flood extent with roads and set `flood_exposed` and monsoon
   costs: an edge is flood-exposed if the flood raster value at its midpoint
   is a valid positive depth. Flood-exposed edges get `monsoon_speed_factor *
   flooded_speed_factor` applied; other edges only get `monsoon_speed_factor`.

The routing rule stops if zero origin-access rows are produced. Some origins
can still end up with no route if they sit on a disconnected OSM road
fragment — that is a property of the real network, not something the
pipeline papers over.

## Run

Requires `osmium-tool` (`brew install osmium-tool`) in addition to the Python
dependencies, for the `filter_roads_pbf` rule.

```bash
docker compose up -d postgis
python -m venv .venv
source .venv/bin/activate
pip install -r pipeline/requirements.txt
cd pipeline
snakemake --cores 4 --dry-run
snakemake --cores 4
```

To regenerate only the real WorldPop district and upazila totals without the
database routing stages:

```bash
cd pipeline
snakemake --cores 2 ../public/data/observed/district-population-2025.json ../public/data/observed/subdistrict-population-2025.json
```

For national-scale matrices, batch origins by district or tile rather than sending every origin in one pgRouting request. Merge batches before spatial statistics.

## Output interpretation

- Facility attributes and population counts are source observations/estimates.
- Travel times are network-modelled results from genuine inputs.
- Flood differences are scenario-modelled results constrained by observed flood data.
- Gi* and LISA are inferential statistics derived from the calculated accessibility values.

## Outputs

`scripts/spatial_statistics.py` aggregates the same routed `access.parquet`
rows at two administrative levels — it does not compute two independent
models, just two group-bys of one result:

- `work/spatial_statistics.parquet` → `public/data/analysis/upazila-access.geojson`
  (544 ADM3 features: `mean_travel_minutes`, `underserved_percent`,
  `gi_zscore`/`gi_pvalue`, `lisa_quadrant`).
- `work/district_statistics.parquet` → `public/data/analysis/district-access.geojson`
  (64 ADM2 features, same fields, Gi*/LISA computed on district-level Queen
  contiguity rather than reusing the upazila statistics).

Both dry-season only; `analysis.origin_access` has monsoon rows too, but
`spatial_statistics.py` doesn't export them yet — see the "Seasonal change"
analysis mode, which is still a placeholder for that reason.
