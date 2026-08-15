"""Load and topologize the OSM road network into network.roads / network.vertices.

Implements the "load and topologize OSM roads" and "intersect flood extent with
roads" steps of the database preparation contract in pipeline/README.md.

Approach: OSM node IDs are reused directly as pgRouting vertex IDs. A node is a
topological vertex if it is the first/last node of a qualifying way, or is
shared by two or more qualifying ways (a real intersection). Ways are split
into edges at those vertices, which is the same noding strategy osm2pgrouting
uses and keeps intersections that already share an OSM node ID connected
without needing a distance-tolerance snap.

Only the road classes present in config.yaml's speed_kph are routable here;
anything else (paths, tracks, service roads, etc.) has no configured speed and
is excluded rather than guessed.
"""
import argparse
import math
from collections import Counter
from pathlib import Path

import osmium
import psycopg
import rasterio
import yaml

CLASS_ALIASES = {
    "motorway": "motorway", "motorway_link": "motorway",
    "trunk": "trunk", "trunk_link": "trunk",
    "primary": "primary", "primary_link": "primary",
    "secondary": "secondary", "secondary_link": "secondary",
    "tertiary": "tertiary", "tertiary_link": "tertiary",
    "residential": "residential", "living_street": "residential",
    "unclassified": "unclassified",
}


def haversine_m(lon1, lat1, lon2, lat2):
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlambda / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


class RefCountHandler(osmium.SimpleHandler):
    """Pass 1: count how many qualifying ways reference each node."""

    def __init__(self):
        super().__init__()
        self.ref_count = Counter()
        self.endpoints = set()
        self.way_count = 0

    def way(self, way):
        highway = way.tags.get("highway")
        if highway not in CLASS_ALIASES:
            return
        node_ids = [n.ref for n in way.nodes]
        if len(node_ids) < 2:
            return
        self.way_count += 1
        self.ref_count.update(node_ids)
        self.endpoints.add(node_ids[0])
        self.endpoints.add(node_ids[-1])


class EdgeBuildHandler(osmium.SimpleHandler):
    """Pass 2: split qualifying ways into edges at vertex nodes."""

    def __init__(self, vertex_ids):
        super().__init__()
        self.vertex_ids = vertex_ids
        self.vertex_coords = {}
        self.edges = []

    def way(self, way):
        highway = way.tags.get("highway")
        if highway not in CLASS_ALIASES:
            return
        nodes = [n for n in way.nodes if n.location.valid()]
        if len(nodes) < 2:
            return

        oneway_tag = way.tags.get("oneway", "")
        reversed_way = oneway_tag == "-1"
        oneway = reversed_way or oneway_tag in ("yes", "1", "true") or way.tags.get("junction") == "roundabout"
        road_class = CLASS_ALIASES[highway]

        seg_coords = [(nodes[0].ref, nodes[0].location.lon, nodes[0].location.lat)]
        for node in nodes[1:]:
            seg_coords.append((node.ref, node.location.lon, node.location.lat))
            if node.ref in self.vertex_ids:
                self._emit(seg_coords, road_class, oneway, reversed_way)
                seg_coords = [(node.ref, node.location.lon, node.location.lat)]

    def _emit(self, seg_coords, road_class, oneway, reversed_way):
        if len(seg_coords) < 2:
            return
        for ref, lon, lat in (seg_coords[0], seg_coords[-1]):
            self.vertex_coords[ref] = (lon, lat)
        length_m = sum(
            haversine_m(seg_coords[i][1], seg_coords[i][2], seg_coords[i + 1][1], seg_coords[i + 1][2])
            for i in range(len(seg_coords) - 1)
        )
        if length_m <= 0:
            return
        source_id, target_id = seg_coords[0][0], seg_coords[-1][0]
        if reversed_way:
            source_id, target_id = target_id, source_id
            seg_coords = list(reversed(seg_coords))
        wkt = "LINESTRING(" + ",".join(f"{lon} {lat}" for _, lon, lat in seg_coords) + ")"
        self.edges.append({
            "source": source_id, "target": target_id,
            "road_class": road_class, "length_m": length_m,
            "oneway": oneway, "wkt": wkt,
            "mid_lon": seg_coords[len(seg_coords) // 2][1],
            "mid_lat": seg_coords[len(seg_coords) // 2][2],
        })


def flooded_flags(flood_path, coords):
    with rasterio.open(flood_path) as flood_src:
        flags = []
        for value_row in flood_src.sample(coords):
            value = value_row[0]
            flags.append(value is not None and value != 32767.0 and value > -1e30 and value > 0)
        return flags


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--roads-pbf", required=True, help="Pre-filtered PBF containing only qualifying highway ways")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    config = yaml.safe_load(Path(args.config).read_text())

    print("Pass 1/2: counting node references in qualifying ways", flush=True)
    counter = RefCountHandler()
    counter.apply_file(args.roads_pbf)
    vertex_ids = counter.endpoints | {node for node, count in counter.ref_count.items() if count >= 2}
    print(f"  {counter.way_count:,} qualifying ways, {len(vertex_ids):,} vertices", flush=True)

    print("Pass 2/2: splitting ways into edges", flush=True)
    builder = EdgeBuildHandler(vertex_ids)
    builder.apply_file(args.roads_pbf, locations=True)
    print(f"  {len(builder.edges):,} edges, {len(builder.vertex_coords):,} vertex coordinates", flush=True)

    print("Sampling flood raster at edge midpoints", flush=True)
    flood_path = config.get("flood_file")
    speed_kph = config["speed_kph"]
    monsoon_factor = config["monsoon_speed_factor"]
    flooded_factor = config["flooded_speed_factor"]

    coords = [(edge["mid_lon"], edge["mid_lat"]) for edge in builder.edges]
    flags = flooded_flags(flood_path, coords)

    rows = []
    for edge, flooded in zip(builder.edges, flags):
        speed = speed_kph[edge["road_class"]]
        dry_minutes = edge["length_m"] / (speed * 1000 / 60)
        monsoon_speed_factor = monsoon_factor * flooded_factor if flooded else monsoon_factor
        monsoon_minutes = edge["length_m"] / (speed * monsoon_speed_factor * 1000 / 60)
        if edge["oneway"]:
            dry_reverse, monsoon_reverse = None, None
        else:
            dry_reverse, monsoon_reverse = dry_minutes, monsoon_minutes
        rows.append((
            edge["source"], edge["target"], edge["road_class"], edge["length_m"],
            dry_minutes, monsoon_minutes, dry_reverse, monsoon_reverse, flooded, edge["wkt"],
        ))
    flooded_count = sum(1 for r in rows if r[8])
    print(f"  {flooded_count:,} of {len(rows):,} edges intersect the flood extent", flush=True)

    print("Loading network.vertices and network.roads", flush=True)
    with psycopg.connect(config["database_dsn"]) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS network.vertices (
                  id bigint PRIMARY KEY,
                  geom geometry(Point, 4326) NOT NULL
                );
                CREATE INDEX IF NOT EXISTS vertices_geom_gix ON network.vertices USING gist (geom);
                TRUNCATE network.roads;
                TRUNCATE network.vertices;
            """)
            with cur.copy("COPY network.vertices (id, geom) FROM STDIN") as copy:
                for node_id, (lon, lat) in builder.vertex_coords.items():
                    copy.write_row((node_id, f"SRID=4326;POINT({lon} {lat})"))
            with cur.copy(
                "COPY network.roads (source, target, road_class, length_m, dry_minutes, monsoon_minutes, "
                "dry_reverse_minutes, monsoon_reverse_minutes, flood_exposed, geom) FROM STDIN"
            ) as copy:
                for row in rows:
                    *scalar_fields, wkt = row
                    copy.write_row((*scalar_fields, f"SRID=4326;{wkt}"))
        conn.commit()

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(
        f"edges={len(rows)}\nvertices={len(builder.vertex_coords)}\nflooded_edges={flooded_count}\n"
    )
    print("Done.", flush=True)


if __name__ == "__main__":
    main()
