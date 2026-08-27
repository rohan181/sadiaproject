import argparse
from pathlib import Path
import geopandas as gpd
import pandas as pd
from libpysal.weights import Queen
from esda.getisord import G_Local
from esda.moran import Moran_Local


def aggregate_group(group: pd.DataFrame) -> pd.Series:
    population = group["population"].sum()
    underserved_population = group.loc[~group["reachable_30"], "population"].sum()
    # Population-weighted mean: an origin covering 800k people should count far
    # more toward the area's average travel time than one covering 5k people.
    # Unrouted origins (travel_minutes is NaN) are excluded from both the sum
    # and the weight, same as pandas' plain .mean() would exclude them.
    routed = group.dropna(subset=["travel_minutes"])
    weight_total = routed["population"].sum()
    mean_travel_minutes = (
        (routed["travel_minutes"] * routed["population"]).sum() / weight_total
        if weight_total > 0
        else float("nan")
    )
    return pd.Series({
        "population": population,
        "underserved_population": underserved_population,
        "mean_travel_minutes": mean_travel_minutes,
    })


def compute_stats(
    access: pd.DataFrame, boundaries: gpd.GeoDataFrame, group_col: str
) -> gpd.GeoDataFrame:
    summary = (
        access.groupby([group_col, "season"])
        .apply(aggregate_group, include_groups=False)
        .reset_index()
    )
    summary["underserved_percent"] = 100 * summary.underserved_population / summary.population
    dry = boundaries.merge(
        summary[summary.season.eq("dry")], left_on="shapeName", right_on=group_col, how="left"
    )
    weights = Queen.from_dataframe(dry, use_index=False)
    values = dry.underserved_percent.fillna(0).to_numpy()
    gi = G_Local(values, weights, permutations=999, seed=42)
    lisa = Moran_Local(values, weights, permutations=999, seed=42)
    dry["gi_zscore"] = gi.Zs
    dry["gi_pvalue"] = gi.p_sim
    dry["lisa_quadrant"] = lisa.q
    return dry


parser = argparse.ArgumentParser()
parser.add_argument("--input", required=True)
parser.add_argument("--upazila-output", required=True)
parser.add_argument("--district-output", required=True)
args = parser.parse_args()
access = pd.read_parquet(args.input)

upazila_boundaries = gpd.read_file("../public/bangladesh-subdistricts.geojson")
upazila_stats = compute_stats(access, upazila_boundaries, "upazila")
Path(args.upazila_output).parent.mkdir(parents=True, exist_ok=True)
upazila_stats.to_parquet(args.upazila_output, index=False)

district_boundaries = gpd.read_file("../public/bangladesh-districts.geojson")
district_stats = compute_stats(access, district_boundaries, "district")
Path(args.district_output).parent.mkdir(parents=True, exist_ok=True)
district_stats.to_parquet(args.district_output, index=False)
