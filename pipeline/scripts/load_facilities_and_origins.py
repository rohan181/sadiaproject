"""Load facilities and population origins, then snap both to the road network.

Implements the remaining steps of the database preparation contract in
pipeline/README.md:
  1. Load facilities into source.facilities.
  2. Convert WorldPop cells into source.population_origins.
  4. Snap every facility and population origin to a road vertex.

Population origins use one point per upazila (ADM3) rather than one point per
100 m raster cell: routing ~600k raw cells through pgRouting is not tractable
on a single machine, and the dashboard's own output (analysis.admin_results)
is aggregated at district/upazila level anyway. Each origin's population is
the already-computed WorldPop zonal sum for that upazila
(public/data/observed/subdistrict-population-2025.json), and its geometry is
a representative point guaranteed to fall inside the (often concave,
riverine) upazila polygon. District is attached via spatial join against the
district boundaries, since the boundary files carry no parent-admin field.
"""
import argparse
import csv
import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import psycopg
import yaml


def load_facilities(cur, facilities_csv):
    cur.execute("TRUNCATE source.facilities CASCADE")
    with open(facilities_csv, newline="", encoding="utf-8") as stream, cur.copy(
        "COPY source.facilities (facility_id, name, facility_type, beds, doctors, source_name, source_id, geom) "
        "FROM STDIN"
    ) as copy:
        reader = csv.DictReader(stream)
        count = 0
        for row in reader:
            beds = int(row["beds"]) if row.get("beds") else None
            doctors = int(row["doctors"]) if row.get("doctors") else None
            copy.write_row((
                row["facility_id"], row["name"], row["facility_type"] or None, beds, doctors,
                row.get("source") or "unknown", row["facility_id"],
                f"SRID=4326;POINT({row['longitude']} {row['latitude']})",
            ))
            count += 1
    return count


def build_population_origins(districts_path, subdistricts_path, subdistrict_population_path):
    districts = gpd.read_file(districts_path).to_crs(4326)
    subdistricts = gpd.read_file(subdistricts_path).to_crs(4326)
    population = pd.DataFrame(json.loads(Path(subdistrict_population_path).read_text())["records"])

    subdistricts = subdistricts.merge(population[["shapeID", "population_2025"]], on="shapeID", how="left")
    subdistricts["population_2025"] = subdistricts["population_2025"].fillna(0)
    subdistricts = subdistricts.sort_values("shapeID").reset_index(drop=True)
    subdistricts["origin_id"] = subdistricts.index + 1
    subdistricts["point_geom"] = subdistricts.geometry.representative_point()

    points = subdistricts.set_geometry("point_geom")[["origin_id", "shapeName", "population_2025", "point_geom"]]
    joined = gpd.sjoin(points, districts[["shapeName", "geometry"]], how="left", predicate="within")
    joined = joined.rename(columns={"shapeName_left": "upazila", "shapeName_right": "district"})
    joined = joined.drop_duplicates(subset="origin_id")
    return joined


def load_population_origins(cur, origins):
    cur.execute("TRUNCATE source.population_origins CASCADE")
    with cur.copy(
        "COPY source.population_origins (origin_id, population, district, upazila, geom) FROM STDIN"
    ) as copy:
        for row in origins.itertuples():
            copy.write_row((
                int(row.origin_id), float(row.population_2025), row.district or None, row.upazila,
                f"SRID=4326;POINT({row.point_geom.x} {row.point_geom.y})",
            ))
    return len(origins)


def snap_to_network(cur, table):
    cur.execute(f"""
        UPDATE source.{table} t
        SET road_vertex_id = (
            SELECT v.id FROM network.vertices v ORDER BY v.geom <-> t.geom LIMIT 1
        )
    """)
    cur.execute(f"SELECT count(*) FROM source.{table} WHERE road_vertex_id IS NOT NULL")
    return cur.fetchone()[0]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    config = yaml.safe_load(Path(args.config).read_text())

    origins = build_population_origins(
        config["districts_file"], config["subdistricts_file"],
        "../public/data/observed/subdistrict-population-2025.json",
    )

    with psycopg.connect(config["database_dsn"]) as conn:
        with conn.cursor() as cur:
            print("Loading facilities", flush=True)
            facility_count = load_facilities(cur, config["facilities_file"])
            print(f"  {facility_count:,} facilities", flush=True)

            print("Loading population origins (one per upazila)", flush=True)
            origin_count = load_population_origins(cur, origins)
            print(f"  {origin_count:,} origins", flush=True)

            print("Snapping facilities to nearest road vertex", flush=True)
            snapped_facilities = snap_to_network(cur, "facilities")
            print(f"  {snapped_facilities:,} of {facility_count:,} snapped", flush=True)

            print("Snapping population origins to nearest road vertex", flush=True)
            snapped_origins = snap_to_network(cur, "population_origins")
            print(f"  {snapped_origins:,} of {origin_count:,} snapped", flush=True)
        conn.commit()

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        f"facilities={facility_count}\nsnapped_facilities={snapped_facilities}\n"
        f"origins={origin_count}\nsnapped_origins={snapped_origins}\n"
    )
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
