import argparse
from pathlib import Path
import psycopg
import yaml

parser = argparse.ArgumentParser()
parser.add_argument("--config", required=True)
parser.add_argument("--sql", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
config = yaml.safe_load(Path(args.config).read_text())
statement = Path(args.sql).read_text()
with psycopg.connect(config["database_dsn"]) as connection:
    with connection.cursor() as cursor:
        cursor.execute(statement)
        cursor.execute("SELECT count(*) FROM analysis.origin_access")
        count = cursor.fetchone()[0]
if count == 0:
    raise SystemExit("Routing produced no results; verify snapped road_vertex_id values")
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
Path(args.output).write_text(f"origin_access_rows={count}\n")
