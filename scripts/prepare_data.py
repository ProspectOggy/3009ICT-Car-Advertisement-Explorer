"""Build the compact dataset used by the website.

Usage:
    python scripts/prepare_data.py path/to/processed_car_detail_en.csv

Writes data/cars.csv with only the columns the dashboard needs, so the
browser downloads a smaller file.
"""

import sys
from pathlib import Path

import pandas as pd

OUTPUT = Path(__file__).resolve().parent.parent / "data" / "cars.csv"

DRIVE_LABELS = {
    "fwd - front-wheel drive": "FWD",
    "rfd - rear-wheel drive": "RWD",
    "awd - 4-wheel drive (awd)": "AWD",
    "4wd - four-wheel drive (4wd)": "4WD",
    "4wd or awd": "4WD/AWD",
}


def main(source: str) -> None:
    df = pd.read_csv(source)

    out = pd.DataFrame(
        {
            "id": df["ad_id"],
            "name": df["car_name"].str.strip(),
            "brand": df["brand"].str.strip().str.title(),
            "body": df["car_model"].str.strip(),
            "condition": df["condition"].str.replace(" car", "", regex=False),
            "origin": df["origin"].str.strip(),
            "year": df["year_of_manufacture"].astype(int),
            "mileage": df["mileage"].round().astype(int),
            "price": df["price (AUD)"].round().astype(int),
            "transmission": df["transmission"].str.strip(),
            "drive": df["drive_type"].str.strip().map(DRIVE_LABELS),
            "fuel": df["type_of_engine"].str.strip(),
            "engine": df["engine_capacity"].round(1),
            "consumption": df["fuel_consumption"].round(1),
            "seats": df["seating_capacity"].astype(int),
            "doors": df["num_of_doors"].astype(int),
            "colour": df["exterior_color"].str.strip(),
        }
    )

    out = out.replace("-", "unknown").fillna({"drive": "unknown"})
    out.to_csv(OUTPUT, index=False)
    print(f"Wrote {len(out):,} rows to {OUTPUT}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
