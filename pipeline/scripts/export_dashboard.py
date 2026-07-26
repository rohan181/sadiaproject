import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
import geopandas as gpd

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
frame = gpd.read_parquet(args.input).to_crs(4326)
output = Path(args.output)
output.parent.mkdir(parents=True, exist_ok=True)
geojson_path = output.parent / "upazila-access.geojson"
frame.to_file(geojson_path, driver="GeoJSON")
manifest = {
    "status": "complete",
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "method": "PostGIS/pgRouting + PySAL",
    "featureCount": len(frame),
    "outputs": {"upazilaAccess": "/data/analysis/upazila-access.geojson"},
}
output.write_text(json.dumps(manifest, indent=2) + "\n")
