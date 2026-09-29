# Australian Car Advertisement Explorer

An interactive dashboard analysing 30,000+ Australian car advertisements. It shows how mileage, age and vehicle characteristics relate to asking price.

**Live site:** https://prospectoggy.github.io/3009ICT-Car-Advertisement-Explorer/

## Features

- **Mileage vs price** scatter plot, split by new and used cars, with an optional log price scale
- **Price trend by year of manufacture**: median price and number of listings per year
- **Vehicle characteristics**: body type, fuel type, top brands and median price by drive type
- **Filters** for model search, brand, body type, condition, fuel, transmission, origin, year, price and mileage
- **Listings table** that you can sort and page through, plus a download of the filtered data as CSV

## Project structure

```
index.html               Page layout
css/styles.css           Styling
js/app.js                Data loading, filters, charts and table
data/cars.csv            Compact dataset used by the site
scripts/prepare_data.py  Builds data/cars.csv from the cleaned source dataset
```

## Running locally

The page loads `data/cars.csv` with a web request, so it needs a local web server. Opening `index.html` directly won't work.

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Rebuilding the dataset

```
python scripts/prepare_data.py path/to/processed_car_detail_en.csv
```

## Built with

HTML, CSS, JavaScript, [Chart.js](https://www.chartjs.org/) and [PapaParse](https://www.papaparse.com/), hosted on GitHub Pages.
