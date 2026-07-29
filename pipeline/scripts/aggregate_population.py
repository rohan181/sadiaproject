import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
from exactextract import exact_extract


def aggregate(boundaries_path: Path, raster_path: Path, output_path: Path) -> dict:
    boundaries = gpd.read_file(boundaries_path).to_crs(4326)
    result = exact_extract(
        str(raster_path),
        boundaries,
        ["sum"],
        include_cols=["shapeID", "shapeName", "shapeType"],
        output="pandas",
    )
    result["population_2025"] = result["sum"].fillna(0).round().astype("int64")
    result = result.drop(columns=["sum"])
    records = result.to_dict(orient="records")
    payload = {
        "source": "WorldPop Global2 R2025A v1 constrained population, 2025, 100 m",
        "sourceUrl": "https://hub.worldpop.org/geodata/summary?id=72493",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "units": "estimated people",
        "featureCount": len(records),
        "populationTotal": int(result["population_2025"].sum()),
        "records": records,
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return payload


parser = argparse.ArgumentParser()
parser.add_argument("--raster", required=True, type=Path)
parser.add_argument("--districts", required=True, type=Path)
parser.add_argument("--subdistricts", required=True, type=Path)
parser.add_argument("--output-dir", required=True, type=Path)
args = parser.parse_args()

districts = aggregate(
    args.districts,
    args.raster,
    args.output_dir / "district-population-2025.json",
)
subdistricts = aggregate(
    args.subdistricts,
    args.raster,
    args.output_dir / "subdistrict-population-2025.json",
)
print(
    f"Wrote {districts['featureCount']} districts and "
    f"{subdistricts['featureCount']} subdistricts; "
    f"district total={districts['populationTotal']:,}."
)
