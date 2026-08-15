TRUNCATE analysis.origin_access;

WITH origins AS (
  SELECT array_agg(DISTINCT road_vertex_id) ids
  FROM source.population_origins WHERE road_vertex_id IS NOT NULL
), facilities AS (
  SELECT array_agg(DISTINCT road_vertex_id) ids
  FROM source.facilities WHERE road_vertex_id IS NOT NULL
), costs AS (
  SELECT * FROM pgr_dijkstraCost(
    'SELECT id, source, target, dry_minutes AS cost, COALESCE(dry_reverse_minutes, -1) AS reverse_cost FROM network.roads',
    (SELECT ids FROM origins), (SELECT ids FROM facilities), directed := true
  )
), nearest AS (
  SELECT DISTINCT ON (start_vid) start_vid, end_vid, agg_cost
  FROM costs WHERE agg_cost < 'Infinity'::float8 ORDER BY start_vid, agg_cost
)
INSERT INTO analysis.origin_access (origin_id, season, facility_id, travel_minutes, reachable_30)
SELECT DISTINCT ON (o.origin_id) o.origin_id, 'dry', f.facility_id, n.agg_cost, n.agg_cost <= 30
FROM nearest n
JOIN source.population_origins o ON o.road_vertex_id = n.start_vid
JOIN source.facilities f ON f.road_vertex_id = n.end_vid
ORDER BY o.origin_id, f.facility_id;

WITH origins AS (
  SELECT array_agg(DISTINCT road_vertex_id) ids
  FROM source.population_origins WHERE road_vertex_id IS NOT NULL
), facilities AS (
  SELECT array_agg(DISTINCT road_vertex_id) ids
  FROM source.facilities WHERE road_vertex_id IS NOT NULL
), costs AS (
  SELECT * FROM pgr_dijkstraCost(
    'SELECT id, source, target, monsoon_minutes AS cost, COALESCE(monsoon_reverse_minutes, -1) AS reverse_cost FROM network.roads',
    (SELECT ids FROM origins), (SELECT ids FROM facilities), directed := true
  )
), nearest AS (
  SELECT DISTINCT ON (start_vid) start_vid, end_vid, agg_cost
  FROM costs WHERE agg_cost < 'Infinity'::float8 ORDER BY start_vid, agg_cost
)
INSERT INTO analysis.origin_access (origin_id, season, facility_id, travel_minutes, reachable_30)
SELECT DISTINCT ON (o.origin_id) o.origin_id, 'monsoon', f.facility_id, n.agg_cost, n.agg_cost <= 30
FROM nearest n
JOIN source.population_origins o ON o.road_vertex_id = n.start_vid
JOIN source.facilities f ON f.road_vertex_id = n.end_vid
ORDER BY o.origin_id, f.facility_id;
