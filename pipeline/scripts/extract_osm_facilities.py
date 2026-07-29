import argparse
import csv
import json
from datetime import datetime, timezone
from pathlib import Path

import osmium


FACILITY_AMENITIES = {"hospital", "clinic", "doctors", "health_post"}


def wanted(tags):
    return tags.get("amenity") in FACILITY_AMENITIES or tags.get("healthcare") in FACILITY_AMENITIES


def properties(osm_type, osm_id, tags):
    return {
        "facility_id": f"osm-{osm_type}-{osm_id}",
        "osm_type": osm_type,
        "osm_id": osm_id,
        "name": tags.get("name") or tags.get("name:en") or tags.get("name:bn") or "Unnamed mapped facility",
        "name_bn": tags.get("name:bn", ""),
        "facility_type": tags.get("amenity") or tags.get("healthcare") or "healthcare",
        "operator": tags.get("operator", ""),
        "ownership": tags.get("ownership", ""),
        "beds": tags.get("beds", ""),
        "doctors": tags.get("staff_count:doctors", ""),
        "source": "OpenStreetMap",
    }


class FacilityHandler(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.features = []

    def node(self, node):
        if wanted(node.tags) and node.location.valid():
            self.features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [node.location.lon, node.location.lat]},
                "properties": properties("node", node.id, node.tags),
            })

    def way(self, way):
        if not wanted(way.tags):
            return
        locations = [(node.lon, node.lat) for node in way.nodes if node.location.valid()]
        if not locations:
            return
        lon = sum(point[0] for point in locations) / len(locations)
        lat = sum(point[1] for point in locations) / len(locations)
        self.features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": properties("way", way.id, way.tags),
        })


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True, type=Path)
parser.add_argument("--csv", required=True, type=Path)
parser.add_argument("--geojson", required=True, type=Path)
args = parser.parse_args()

handler = FacilityHandler()
handler.apply_file(str(args.input), locations=True)
features = handler.features

args.geojson.parent.mkdir(parents=True, exist_ok=True)
args.geojson.write_text(json.dumps({
    "type": "FeatureCollection",
    "name": "Bangladesh OSM mapped healthcare facilities",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "source": "Geofabrik Bangladesh OpenStreetMap extract",
    "license": "ODbL 1.0",
    "features": features,
}, ensure_ascii=False, separators=(",", ":")) + "\n")

args.csv.parent.mkdir(parents=True, exist_ok=True)
fields = ["facility_id", "name", "longitude", "latitude", "facility_type", "operator", "ownership", "beds", "doctors", "source"]
with args.csv.open("w", newline="") as stream:
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for feature in features:
        props = feature["properties"]
        lon, lat = feature["geometry"]["coordinates"]
        writer.writerow({**{key: props.get(key, "") for key in fields}, "longitude": lon, "latitude": lat})

print(f"Extracted {len(features):,} mapped healthcare facilities")
