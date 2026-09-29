# Car Advertisement Explorer

3009ICT Data Processing and Visualisation. An interactive dashboard built from the cleaned car advertisement dataset (30,237 records).

**Live site:** https://prospectoggy.github.io/3009ICT-Car-Advertisement-Explorer/

## Task 4b interactive visualisations

1. **Mileage vs Price** (scatter plot): hover tooltips with vehicle details, a clickable New/Used legend, a log/linear price scale toggle, and updates from the dashboard filters.
2. **Price by Year of Manufacture** (line and bar chart): median or mean price per year with listing counts, hover details, and updates from the dashboard filters.

## Other features

- Filters for car name, brand, body type, condition, fuel type, transmission, year, price and mileage
- Summary statistics (median price, mileage and year, plus the number of listings)
- Supporting charts for body type, fuel type, top brands and drive type
- A sortable, paginated listings table
- Download of the filtered data as CSV

## Project structure

```
index.html               Page layout
css/styles.css           Styling
js/app.js                Data loading, filters, charts and table
data/cars.csv            Dataset used by the site
scripts/prepare_data.py  Builds data/cars.csv from the cleaned dataset
```

## Running locally

```
python -m http.server 8000
```

Then open http://localhost:8000.

## Built with

HTML, CSS, JavaScript, [Chart.js](https://www.chartjs.org/) and [PapaParse](https://www.papaparse.com/), hosted on GitHub Pages.
