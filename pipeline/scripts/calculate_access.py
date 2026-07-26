import argparse
from pathlib import Path
import pandas as pd
import yaml
from sqlalchemy import create_engine, text

parser = argparse.ArgumentParser()
parser.add_argument("--config", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
config = yaml.safe_load(Path(args.config).read_text())
engine = create_engine(config["database_url"])

query = text("""
SELECT o.origin_id, o.population, o.district, o.upazila, season,
       facility_id, travel_minutes, reachable_30
FROM source.population_origins o
JOIN analysis.origin_access a USING (origin_id)
ORDER BY o.origin_id, season
""")
with engine.connect() as connection:
    frame = pd.read_sql(query, connection)
if frame.empty:
    raise SystemExit("analysis.origin_access is empty; load the network and run pgRouting first")
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
frame.to_parquet(args.output, index=False)
