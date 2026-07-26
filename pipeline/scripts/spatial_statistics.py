import argparse
from pathlib import Path
import geopandas as gpd
import pandas as pd
from libpysal.weights import Queen
from esda.getisord import G_Local
from esda.moran import Moran_Local

parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--output", required=True)
args = parser.parse_args()
access = pd.read_parquet(args.input)
boundaries = gpd.read_file("../public/bangladesh-subdistricts.geojson")
summary = access.groupby(["upazila", "season"], as_index=False).agg(
    population=("population", "sum"),
    underserved_population=("population", lambda values: values[access.loc[values.index, "reachable_30"].eq(False)].sum()),
    mean_travel_minutes=("travel_minutes", "mean"),
)
summary["underserved_percent"] = 100 * summary.underserved_population / summary.population
dry = boundaries.merge(summary[summary.season.eq("dry")], left_on="shapeName", right_on="upazila", how="left")
weights = Queen.from_dataframe(dry, use_index=False)
values = dry.underserved_percent.fillna(0).to_numpy()
gi = G_Local(values, weights, permutations=999, seed=42)
lisa = Moran_Local(values, weights, permutations=999, seed=42)
dry["gi_zscore"] = gi.Zs
dry["gi_pvalue"] = gi.p_sim
dry["lisa_quadrant"] = lisa.q
Path(args.output).parent.mkdir(parents=True, exist_ok=True)
dry.to_parquet(args.output, index=False)
