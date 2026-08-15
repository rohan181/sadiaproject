CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting;

CREATE SCHEMA IF NOT EXISTS source;
CREATE SCHEMA IF NOT EXISTS network;
CREATE SCHEMA IF NOT EXISTS analysis;

CREATE TABLE IF NOT EXISTS source.dataset_registry (
  dataset_key text PRIMARY KEY,
  source_url text NOT NULL,
  source_version text,
  retrieved_at timestamptz NOT NULL,
  licence text,
  checksum text NOT NULL
);

CREATE TABLE IF NOT EXISTS source.facilities (
  facility_id text PRIMARY KEY,
  name text NOT NULL,
  facility_type text,
  beds integer,
  doctors integer,
  source_name text NOT NULL,
  source_id text,
  road_vertex_id bigint,
  geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS facilities_geom_gix ON source.facilities USING gist (geom);

CREATE TABLE IF NOT EXISTS source.population_origins (
  origin_id bigint PRIMARY KEY,
  population double precision NOT NULL CHECK (population >= 0),
  district text,
  upazila text,
  road_vertex_id bigint,
  geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS population_origins_geom_gix ON source.population_origins USING gist (geom);

CREATE TABLE IF NOT EXISTS network.roads (
  id bigserial PRIMARY KEY,
  source bigint,
  target bigint,
  road_class text,
  length_m double precision NOT NULL,
  dry_minutes double precision NOT NULL,
  monsoon_minutes double precision NOT NULL,
  dry_reverse_minutes double precision,
  monsoon_reverse_minutes double precision,
  flood_exposed boolean NOT NULL DEFAULT false,
  geom geometry(LineString, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS roads_geom_gix ON network.roads USING gist (geom);
CREATE INDEX IF NOT EXISTS roads_source_idx ON network.roads (source);
CREATE INDEX IF NOT EXISTS roads_target_idx ON network.roads (target);

CREATE TABLE IF NOT EXISTS network.vertices (
  id bigint PRIMARY KEY,
  geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS vertices_geom_gix ON network.vertices USING gist (geom);

CREATE TABLE IF NOT EXISTS analysis.origin_access (
  origin_id bigint NOT NULL REFERENCES source.population_origins(origin_id),
  season text NOT NULL CHECK (season IN ('dry', 'monsoon')),
  facility_id text REFERENCES source.facilities(facility_id),
  travel_minutes double precision,
  reachable_30 boolean,
  PRIMARY KEY (origin_id, season)
);

CREATE TABLE IF NOT EXISTS analysis.admin_results (
  admin_level text NOT NULL,
  admin_name text NOT NULL,
  season text NOT NULL,
  population double precision,
  underserved_population double precision,
  underserved_percent double precision,
  mean_travel_minutes double precision,
  e2sfca_score double precision,
  gi_zscore double precision,
  gi_pvalue double precision,
  lisa_cluster text,
  PRIMARY KEY (admin_level, admin_name, season)
);
