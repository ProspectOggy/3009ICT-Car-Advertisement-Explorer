"use strict";

const DATA_URL = "data/cars.csv";
const SCATTER_MAX_POINTS = 4000;
const TOOLTIP_MAX_CARS = 5;
// Seaborn's default colours, so the interactive charts match the static charts in Task 4a.
// Seaborn colours groups in the order they first appear in the data, which is why New is blue
// in the scatter plot but Used is blue in the line chart.
const SEABORN_BLUE = "31, 119, 180";
const SEABORN_ORANGE = "255, 127, 14";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-AU");

const $ = (id) => document.getElementById(id);

const TREND_NOTES = {
  mean: "Mean (average) price is shown by default, as in the static chart. Switch to Median to see how a small number of very expensive vehicles pull the mean upwards. Click New or Used in the legend to show or hide each line.",
  median: "Median price is the middle value for each year, so it is not affected by a small number of very expensive vehicles. Compare it with the mean to see how much they distort the average.",
};

// Each chart has its own filter bar. "s" = scatter plot, "t" = trend chart.
function filterBar(prefix) {
  return {
    brand: $(`${prefix}-brand`),
    condition: $(`${prefix}-condition`),
    yearMin: $(`${prefix}-year-min`),
    yearMax: $(`${prefix}-year-max`),
    reset: $(`${prefix}-reset`),
    status: $(`${prefix}-status`),
  };
}

const scatterFilters = filterBar("s");
const trendFilters = filterBar("t");
const logScale = $("log-scale");

let allRows = [];
let yearBounds = { min: 1990, max: 2023 };
let scatterChart;
let trendChart;
let carsUnderCursor = 0;

document.addEventListener("DOMContentLoaded", () => {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = "#555";
  Chart.defaults.animation = false;

  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (result) => init(result.data),
    error: (err) => {
      scatterFilters.status.textContent = trendFilters.status.textContent = `Could not load the dataset (${err.message}).`;
    },
  });
});

function init(rows) {
  // Shuffled once so the scatter plot sample is random but stable between filter changes.
  allRows = shuffle(rows.map((r) => ({ ...r, name: String(r.name), brand: String(r.brand) })));

  const years = allRows.map((r) => r.year);
  yearBounds = { min: Math.min(...years), max: Math.max(...years) };

  const brands = [...new Set(allRows.map((r) => r.brand))].sort();

  createCharts();
  setUpFilterBar(scatterFilters, brands, updateScatter);
  setUpFilterBar(trendFilters, brands, updateTrend);

  logScale.addEventListener("change", () => {
    const y = scatterChart.options.scales.y;
    y.type = logScale.checked ? "logarithmic" : "linear";
    y.min = logScale.checked ? undefined : 0;
    scatterChart.update();
  });

  document.querySelectorAll('input[name="trend-stat"]').forEach((radio) => {
    radio.addEventListener("change", updateTrend);
  });

  updateScatter();
  updateTrend();
}

function setUpFilterBar(bar, brands, onChange) {
  for (const brand of brands) bar.brand.add(new Option(brand, brand));
  for (let year = yearBounds.min; year <= yearBounds.max; year++) {
    bar.yearMin.add(new Option(year, year));
    bar.yearMax.add(new Option(year, year));
  }
  resetFilterBar(bar);

  for (const input of [bar.brand, bar.condition, bar.yearMin, bar.yearMax]) {
    input.addEventListener("change", onChange);
  }
  bar.reset.addEventListener("click", () => {
    resetFilterBar(bar);
    onChange();
  });
}

function resetFilterBar(bar) {
  bar.brand.value = "";
  bar.condition.value = "";
  bar.yearMin.value = yearBounds.min;
  bar.yearMax.value = yearBounds.max;
}

function filterRows(bar) {
  const brand = bar.brand.value;
  const condition = bar.condition.value;
  const yearMin = Number(bar.yearMin.value);
  const yearMax = Number(bar.yearMax.value);

  const rows = allRows.filter((r) =>
    (!brand || r.brand === brand) &&
    (!condition || r.condition === condition) &&
    r.year >= yearMin && r.year <= yearMax
  );

  bar.status.textContent = rows.length ? "" : "No listings match the selected filters.";
  return rows;
}

/* ---------- Charts ---------- */

function createCharts() {
  scatterChart = new Chart($("chart-scatter"), {
    type: "scatter",
    data: { datasets: [] },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { min: 0, title: { display: true, text: "Mileage (km)" }, ticks: { callback: (v) => num.format(v) } },
        y: {
          type: "linear",
          min: 0,
          title: { display: true, text: "Price (AUD)" },
          ticks: { callback: (v) => aud.format(v), maxTicksLimit: 8 },
        },
      },
      plugins: {
        tooltip: {
          // Several cars can sit on the same spot, so count them and list only the first few.
          filter: (item, index, items) => {
            carsUnderCursor = items.length;
            return index < TOOLTIP_MAX_CARS;
          },
          callbacks: {
            title: (items) => {
              if (carsUnderCursor === 1) return items[0].raw.car.name;
              const shown = carsUnderCursor > TOOLTIP_MAX_CARS ? ` (showing first ${TOOLTIP_MAX_CARS})` : "";
              return `${carsUnderCursor} listings at this point${shown}`;
            },
            label: (ctx) => {
              const car = ctx.raw.car;
              const lines = [
                `Year: ${car.year}`,
                `Price: ${aud.format(car.price)}`,
                `Mileage: ${num.format(car.mileage)} km`,
                `Condition: ${car.condition === "new" ? "New" : "Used"}`,
              ];
              return carsUnderCursor === 1 ? lines : [car.name, ...lines];
            },
          },
        },
      },
    },
  });

  trendChart = new Chart($("chart-trend"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { title: { display: true, text: "Year of manufacture" } },
        y: { title: { display: true, text: "Mean price (AUD)" }, ticks: { callback: (v) => aud.format(v) } },
      },
      plugins: {
        tooltip: {
          filter: (item) => item.parsed.y != null,
          callbacks: {
            title: (items) => `Year: ${items[0].label}`,
            label: (ctx) =>
              `${ctx.dataset.label} – ${ctx.dataset.statLabel.toLowerCase()}: ${aud.format(ctx.parsed.y)} ` +
              `(${num.format(ctx.dataset.counts[ctx.dataIndex])} listings)`,
          },
        },
      },
    },
  });
}

function updateScatter() {
  const filtered = filterRows(scatterFilters);
  const sample = filtered.slice(0, SCATTER_MAX_POINTS);
  const toPoint = (r) => ({ x: r.mileage, y: r.price, car: r });

  scatterChart.data.datasets = [
    {
      label: "New",
      data: sample.filter((r) => r.condition === "new").map(toPoint),
      backgroundColor: `rgba(${SEABORN_BLUE}, 0.4)`,
      pointRadius: 3,
      pointHoverRadius: 6,
    },
    {
      label: "Used",
      data: sample.filter((r) => r.condition === "used").map(toPoint),
      backgroundColor: `rgba(${SEABORN_ORANGE}, 0.4)`,
      pointRadius: 3,
      pointHoverRadius: 6,
    },
  ];
  scatterChart.update();
}

function updateTrend() {
  const stat = document.querySelector('input[name="trend-stat"]:checked').value;
  const useMean = stat === "mean";
  const statLabel = useMean ? "Mean price" : "Median price";
  const average = useMean ? mean : median;
  $("trend-note").textContent = TREND_NOTES[stat];

  const rows = filterRows(trendFilters);
  const years = [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b);

  // One line per condition, like the static chart in Task 4a.
  const lineFor = (condition, label, color) => {
    const pricesByYear = years.map((y) => rows.filter((r) => r.year === y && r.condition === condition).map((r) => r.price));
    return {
      label,
      statLabel,
      data: pricesByYear.map((prices) => (prices.length ? average(prices) : null)),
      counts: pricesByYear.map((prices) => prices.length),
      borderColor: color,
      backgroundColor: color,
      pointRadius: 4,
      spanGaps: true,
    };
  };

  trendChart.options.scales.y.title.text = `${statLabel} (AUD)`;
  trendChart.data = {
    labels: years,
    datasets: [lineFor("used", "Used", `rgb(${SEABORN_BLUE})`), lineFor("new", "New", `rgb(${SEABORN_ORANGE})`)],
  };
  trendChart.update();
}

/* ---------- Helpers ---------- */

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
