import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import geopandas as gpd

parser = argparse.ArgumentParser()
parser.add_argument("--upazila-input", required=True)
parser.add_argument("--district-input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()

output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)

upazila_frame = gpd.read_parquet(args.upazila_input).to_crs(4326)
upazila_frame.to_file(output.parent / "upazila-access.geojson", driver="GeoJSON")

district_frame = gpd.read_parquet(args.district_input).to_crs(4326)
district_frame.to_file(output.parent / "district-access.geojson", driver="GeoJSON")

manifest = {
    "status": "complete",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "method": "PostGIS/pgRouting + PySAL",
    "featureCount": len(upazila_frame),
    "districtFeatureCount": len(district_frame),
    "outputs": {
        "upazilaAccess": "/data/analysis/upazila-access.geojson",
        "districtAccess": "/data/analysis/district-access.geojson",
    },
}
output.write_text(json.dumps(manifest, indent=2) + "\n")
