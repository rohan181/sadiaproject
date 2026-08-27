# Travel time methodology

This document answers three questions about how AccessBD computes and
displays travel time: the exact equations behind **Travel Time Estimation**
and the **Travel-time Accessibility Surface**, which mapping library renders
the Bangladesh map, and what the colors/numbers on that map actually mean.

Everything below matches the code exactly — file references are given so the
formulas can be checked against the source, not just this description.

## 1. What renders the map

**Leaflet.js**, via the `react-leaflet` React binding, with real
**OpenStreetMap** tiles (`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`).

This is true for every map in the app:

- `app/RealFacilityMap.tsx` — the live healthcare-facility map.
- `app/LeafletBoundaryMap.tsx` — the district/upazila choropleth used
  everywhere else (main overview map, the "Expand" modals, and the 15
  thumbnail previews in the analysis library). This replaced an earlier
  hand-rolled SVG renderer (`app/BangladeshBoundary.tsx`, since deleted) that
  projected GeoJSON coordinates onto a flat `<svg>` with no real basemap.

District/upazila polygons are drawn as a Leaflet `GeoJSON` layer on top of
the OSM tiles, colored per feature (see §3) and with click/tap and hover
tooltip handlers attached per polygon.

## 2. Travel Time Estimation — the equation

This is the per-location number the search widget (`app/TravelTimeEstimator.tsx`)
looks up, and the number PostGIS/pgRouting computes for every population
origin during the `route_access` pipeline stage
(`pipeline/sql/002_route_access.sql`, `pipeline/scripts/load_roads.py`).

### Step 1 — cost of a single road edge

For a road edge `e` of class `c(e)` (motorway, trunk, primary, secondary,
tertiary, residential, or unclassified — the only classes with a configured
speed) and length `L(e)` in meters, using the real posted speeds in
`pipeline/config.yaml`:

```
speed_kph = { motorway: 70, trunk: 55, primary: 45, secondary: 35,
              tertiary: 28, residential: 20, unclassified: 18 }
monsoon_speed_factor = 0.65
flooded_speed_factor = 0.25
```

**Dry season cost, in minutes:**

```
cost_dry(e) = L(e) / (speed_kph[c(e)] × 1000 / 60)
```

**Monsoon season cost, in minutes:**

```
                      monsoon_speed_factor × flooded_speed_factor   if e intersects the flood extent
factor(e) =
                      monsoon_speed_factor                          otherwise

cost_monsoon(e) = L(e) / (speed_kph[c(e)] × factor(e) × 1000 / 60)
```

Concretely: a non-flooded road in monsoon runs at 65% of its dry speed. A
road that the FFWC flood raster shows as flooded at that point runs at
0.65 × 0.25 = **16.25%** of its dry speed — roughly 6× slower than dry season.

Flood exposure is determined once per edge, at load time: the flood raster
is sampled at the edge's midpoint, and any valid positive depth counts as
flooded (`pipeline/scripts/load_roads.py`).

### Step 2 — shortest path to the nearest facility

For an origin `i` (a population point, snapped to its nearest road network
vertex) and the set of facility vertices `H` (3,355 real OSM-mapped
hospitals/clinics, also snapped), pgRouting's Dijkstra implementation finds:

```
T(i) = min over j in H of [ sum of cost(e) for e in ShortestPath(i, j) ]
```

— the cost of the cheapest path from `i` to whichever facility is cheapest
to reach, respecting one-way roads (`pgr_dijkstraCost(..., directed := true)`
in `002_route_access.sql`). This is currently computed for the **dry season
only** in the published output; monsoon rows exist in the database
(`analysis.origin_access`) but the dashboard export doesn't surface them yet
— that's why "Seasonal change" is still a placeholder mode.

Each of the 544 upazilas has exactly one population origin (a representative
point inside the polygon, weighted with that upazila's real WorldPop 2025
population — see `pipeline/scripts/load_facilities_and_origins.py`). So
**the "Travel Time Estimation" search result for an upazila is `T(i)` for
that upazila's single origin, looked up directly** — nothing further is
computed at query time; the number was already produced by the pipeline.

If an origin's road-network vertex has no path to any facility (a
disconnected fragment of the real, imperfect OSM network — this affects 36
of 544 upazilas), `T(i)` is undefined and the estimator says so explicitly
("No modeled route") rather than showing a fabricated number.

## 3. Travel-time Accessibility Surface — the equation

This is the aggregate number shown per **district or upazila** on the
choropleth map, computed in `pipeline/scripts/spatial_statistics.py`.

A district contains several upazila-origins; an upazila contains exactly
one. For an area `A` containing origins `{i}`, each with population `P(i)`
(the same real WorldPop figure used everywhere else in the app):

**Population-weighted mean travel time:**

```
MeanTravelTime(A) = [ Σ T(i) × P(i)  for i in A where T(i) is defined ]
                     ─────────────────────────────────────────────────
                     [ Σ P(i)         for i in A where T(i) is defined ]
```

Origins with no route are excluded from *both* the sum and the population
weight — they are not counted as 0 minutes or averaged in as missing data.
This is a genuine weighted average, not a simple average across upazilas:
without the weighting, a district's number would treat a huge, populous
upazila the same as a tiny one. (Concretely: adding this weighting changed
Dhaka district's figure from 3.0 to 6.7 minutes, because Dhaka's population
is concentrated in large suburban upazilas, not its smallest, most-central
ones — the unweighted average had been overstating how fast the *average
resident* can reach care.)

**Underserved population percent** (same underlying data, different
question — "what share of people are more than 30 minutes away?"):

```
UnderservedPercent(A) = 100 × [ Σ P(i) for i in A where T(i) > 30 or undefined ]
                              ─────────────────────────────────────────────────
                              [ Σ P(i) for i in A ]
```

Gi* hotspot z-scores and LISA cluster categories are a separate, further
step: PySAL's Getis-Ord Gi* and Local Moran's I, run on `UnderservedPercent`
across Queen-contiguity neighbors, with 999 permutations. They describe
*where underserved areas cluster geographically*, not travel time directly.

## 4. What the numbers and colors on the map mean

When you hover or tap a district/upazila polygon in "Accessibility surface"
mode, the tooltip shows something like:

> Bagerhat • 6.3 min mean travel time

That number is exactly `MeanTravelTime(Bagerhat)` from §3 above — a real,
computed value, not a placeholder.

**The fill color is a relative ranking, not an absolute scale.** For
whichever set of areas is currently on screen (64 districts or 544
upazilas), the app computes the 25th/50th/75th percentile breakpoints of
`MeanTravelTime` *across that same set*, and buckets every area into one of
four colors (`app/LeafletBoundaryMap.tsx`, `quantileBreaks`/`bucketOf`):

| Bucket | Meaning |
|---|---|
| Lightest (green/mint) | Fastest quartile — among the best-connected 25% of areas shown |
| Light-medium | Second quartile |
| Medium (amber) | Third quartile |
| Darkest (red/coral) | Slowest quartile — among the worst-connected 25% of areas shown |

Because the buckets are recomputed from whatever data is currently loaded,
a "red" area means "slow *relative to the other areas in this view*", not
"slower than some fixed number of minutes." The tooltip's exact figure is
the only absolute number — the color is for fast visual comparison.

A distinct flat gray fill (`#e4e4e0`) means **no modeled route** — the area
sits on a disconnected fragment of the real OSM road network and has no
computed travel time at all. This is never shown as if it were the best
(green) score.

For **Gi\* hotspots** and **LISA clusters** mode, the same four-color scale
instead encodes statistical significance/cluster type rather than raw
minutes — see the tooltip text, which spells out the z-score, p-value, or
cluster label (e.g. "High-High cluster") directly.

## Where this lives in the code

| Concern | File |
|---|---|
| Road network build, edge costs, flood exposure | `pipeline/scripts/load_roads.py` |
| Facility/population loading, snapping to network | `pipeline/scripts/load_facilities_and_origins.py` |
| Shortest-path routing (pgRouting) | `pipeline/sql/002_route_access.sql` |
| District/upazila aggregation, Gi*/LISA | `pipeline/scripts/spatial_statistics.py` |
| Dashboard export | `pipeline/scripts/export_dashboard.py` |
| Map rendering (Leaflet), color buckets, tooltips | `app/LeafletBoundaryMap.tsx` |
| Search-based point lookup | `app/TravelTimeEstimator.tsx` |
