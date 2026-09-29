"use strict";

const DATA_URL = "data/cars.csv";
const SCATTER_MAX_POINTS = 4000;
const ACCENT = "#1f5fbf";

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-AU");

const $ = (id) => document.getElementById(id);

const els = {
  brand: $("f-brand"),
  condition: $("f-condition"),
  yearMin: $("f-year-min"),
  yearMax: $("f-year-max"),
  logScale: $("log-scale"),
  status: $("status"),
};

let allRows = [];
let filtered = [];
let yearBounds = { min: 1990, max: 2023 };
let scatterChart;
let trendChart;

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
      els.status.textContent = `Could not load the dataset (${err.message}).`;
    },
  });
});

function init(rows) {
  // Shuffled once so the scatter plot sample is random but stable between filter changes.
  allRows = shuffle(rows.map((r) => ({ ...r, name: String(r.name), brand: String(r.brand) })));

  const years = allRows.map((r) => r.year);
  yearBounds = { min: Math.min(...years), max: Math.max(...years) };

  const brands = [...new Set(allRows.map((r) => r.brand))].sort();
  for (const brand of brands) {
    const opt = document.createElement("option");
    opt.value = brand;
    opt.textContent = brand;
    els.brand.appendChild(opt);
  }

  resetFilters();
  createCharts();
  bindEvents();
  applyFilters();
}

function resetFilters() {
  els.brand.value = "";
  els.condition.value = "";
  els.yearMin.value = yearBounds.min;
  els.yearMax.value = yearBounds.max;
  els.yearMin.min = els.yearMax.min = yearBounds.min;
  els.yearMin.max = els.yearMax.max = yearBounds.max;
}

function bindEvents() {
  for (const input of [els.brand, els.condition, els.yearMin, els.yearMax]) {
    input.addEventListener("change", applyFilters);
  }

  $("reset").addEventListener("click", () => {
    resetFilters();
    applyFilters();
  });

  els.logScale.addEventListener("change", () => {
    scatterChart.options.scales.y.type = els.logScale.checked ? "logarithmic" : "linear";
    scatterChart.update();
  });

  document.querySelectorAll('input[name="trend-stat"]').forEach((radio) => {
    radio.addEventListener("change", updateTrend);
  });
}

function applyFilters() {
  const brand = els.brand.value;
  const condition = els.condition.value;
  const yearMin = els.yearMin.value === "" ? yearBounds.min : Number(els.yearMin.value);
  const yearMax = els.yearMax.value === "" ? yearBounds.max : Number(els.yearMax.value);

  filtered = allRows.filter((r) =>
    (!brand || r.brand === brand) &&
    (!condition || r.condition === condition) &&
    r.year >= yearMin && r.year <= yearMax
  );

  els.status.textContent = filtered.length ? "" : "No listings match the selected filters.";
  updateScatter();
  updateTrend();
}

/* ---------- Charts ---------- */

function createCharts() {
  scatterChart = new Chart($("chart-scatter"), {
    type: "scatter",
    data: { datasets: [] },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Mileage (km)" }, ticks: { callback: (v) => num.format(v) } },
        y: {
          type: "logarithmic",
          title: { display: true, text: "Price (AUD)" },
          ticks: { callback: (v) => aud.format(v), maxTicksLimit: 8 },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => items[0].raw.car.name,
            label: (ctx) => {
              const car = ctx.raw.car;
              return [
                `Year: ${car.year}`,
                `Price: ${aud.format(car.price)}`,
                `Mileage: ${num.format(car.mileage)} km`,
                `Condition: ${car.condition === "new" ? "New" : "Used"}`,
              ];
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
        y: { title: { display: true, text: "Median price (AUD)" }, ticks: { callback: (v) => aud.format(v) } },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => `Year: ${items[0].label}`,
            label: (ctx) => [
              `${ctx.dataset.label}: ${aud.format(ctx.parsed.y)}`,
              `Listings: ${num.format(ctx.dataset.counts[ctx.dataIndex])}`,
            ],
          },
        },
      },
    },
  });
}

function updateScatter() {
  const sample = filtered.slice(0, SCATTER_MAX_POINTS);
  const toPoint = (r) => ({ x: r.mileage, y: r.price, car: r });

  scatterChart.data.datasets = [
    {
      label: "Used",
      data: sample.filter((r) => r.condition === "used").map(toPoint),
      backgroundColor: "rgba(31, 95, 191, 0.35)",
      pointRadius: 2.5,
      pointHoverRadius: 5,
    },
    {
      label: "New",
      data: sample.filter((r) => r.condition === "new").map(toPoint),
      backgroundColor: "rgba(217, 130, 43, 0.6)",
      pointRadius: 2.5,
      pointHoverRadius: 5,
    },
  ];

  // Cap the x-axis at the 99th percentile so a few extreme odometer readings don't squash the chart.
  const mileages = filtered.map((r) => r.mileage).sort((a, b) => a - b);
  const p99 = mileages[Math.floor(mileages.length * 0.99)] || 0;
  scatterChart.options.scales.x.max = p99 > 0 ? Math.ceil(p99 / 10000) * 10000 : undefined;
  scatterChart.update();
}

function updateTrend() {
  const useMean = document.querySelector('input[name="trend-stat"]:checked').value === "mean";
  const statLabel = useMean ? "Mean price" : "Median price";
  const average = useMean ? mean : median;

  const byYear = new Map();
  for (const r of filtered) {
    if (!byYear.has(r.year)) byYear.set(r.year, []);
    byYear.get(r.year).push(r.price);
  }
  const years = [...byYear.keys()].sort((a, b) => a - b);

  trendChart.options.scales.y.title.text = `${statLabel} (AUD)`;
  trendChart.data = {
    labels: years,
    datasets: [
      {
        label: statLabel,
        data: years.map((y) => average(byYear.get(y))),
        counts: years.map((y) => byYear.get(y).length),
        borderColor: ACCENT,
        backgroundColor: ACCENT,
        tension: 0.2,
      },
    ],
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
