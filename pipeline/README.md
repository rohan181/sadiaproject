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

Before `snakemake` calculates results:

1. Load facilities into `source.facilities`.
2. Convert WorldPop cells into `source.population_origins`.
3. Load and topologize OSM roads in `network.roads`.
4. Snap every facility and population origin to a road vertex and populate `road_vertex_id`.
5. Intersect flood extent with roads and set `flood_exposed` and monsoon costs.

The routing rule stops if zero origin-access rows are produced.

## Run

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
