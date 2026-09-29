# Car Advertisement Explorer

3009ICT Data Processing and Visualisation, Task 4b: Interactive Visualisations.

**Live site:** https://prospectoggy.github.io/3009ICT-Car-Advertisement-Explorer/

## Interactive visualisations

1. **Mileage vs Price** (scatter plot): hover over a point to see the car name, year, price, mileage and condition. Click New or Used in the legend to show or hide them, and switch between a log and linear price scale.
2. **Price by Year of Manufacture** (line chart): switch between median and mean price. Hover to see the year, the price statistic and the number of listings.

Both charts update with the Brand, Condition and Year range filters.

## Project structure

```
index.html               Page layout
css/styles.css           Styling
js/app.js                Data loading, filters and charts
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
