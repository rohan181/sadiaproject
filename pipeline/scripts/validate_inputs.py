import argparse
import hashlib
from pathlib import Path
import yaml

parser = argparse.ArgumentParser()
parser.add_argument("--config", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
config = yaml.safe_load(Path(args.config).read_text())

required = ["facilities_file", "population_raster", "roads_file", "districts_file", "subdistricts_file"]
missing = [config[key] for key in required if not Path(config[key]).exists()]
if missing:
    raise SystemExit("Missing required source files:\n- " + "\n- ".join(missing))

checksums = []
for key in required:
    path = Path(config[key])
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    checksums.append(f"{key}\t{path}\t{digest}")
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
Path(args.output).write_text("\n".join(checksums) + "\n")
