"use strict";

const DATA_URL = "data/cars.csv";
const SCATTER_MAX_POINTS = 4000;
const PAGE_SIZE = 25;
const MILEAGE_ANY = 300000;

const ACCENT = "#1f5fbf";
const PALETTE = [ACCENT, "#d9822b", "#4a9d6e", "#8a6fb3", "#999999"];

const aud = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("en-AU");

const $ = (id) => document.getElementById(id);

const els = {
  search: $("f-search"),
  brand: $("f-brand"),
  body: $("f-body"),
  condition: $("f-condition"),
  fuel: $("f-fuel"),
  transmission: $("f-transmission"),
  yearMin: $("f-year-min"),
  yearMax: $("f-year-max"),
  priceMin: $("f-price-min"),
  priceMax: $("f-price-max"),
  mileage: $("f-mileage"),
  mileageLabel: $("mileage-label"),
  logScale: $("log-scale"),
  status: $("status"),
  tableBody: $("table-body"),
  tableInfo: $("table-info"),
  pageInfo: $("page-info"),
  prev: $("prev"),
  next: $("next"),
};

const CATEGORY_FILTERS = ["brand", "body", "condition", "fuel", "transmission"];

let allRows = [];
let filtered = [];
let yearBounds = { min: 1990, max: 2023 };
const table = { key: "year", dir: -1, page: 0 };
const charts = {};

document.addEventListener("DOMContentLoaded", () => {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = "#555555";
  Chart.defaults.animation = false;

  Papa.parse(DATA_URL, {
    download: true,
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (result) => init(result.data),
    error: (err) => {
      els.status.textContent = `Could not load the dataset (${err.message}). If you opened index.html directly, run a local web server instead.`;
    },
  });
});

function init(rows) {
  allRows = shuffle(rows.map((r) => ({ ...r, name: String(r.name), brand: String(r.brand) })));

  const years = allRows.map((r) => r.year);
  yearBounds = { min: Math.min(...years), max: Math.max(...years) };

  populateSelect(els.brand, uniqueValues("brand").sort());
  for (const key of ["body", "condition", "fuel", "transmission"]) {
    populateSelect(els[key], uniqueValues(key, true));
  }

  resetFilters();
  createCharts();
  bindEvents();
  els.status.textContent = "";
  applyFilters();
}

function uniqueValues(key, byFrequency = false) {
  const counts = new Map();
  for (const r of allRows) counts.set(r[key], (counts.get(r[key]) || 0) + 1);
  const values = [...counts.keys()];
  return byFrequency ? values.sort((a, b) => counts.get(b) - counts.get(a)) : values;
}

function populateSelect(select, values) {
  for (const v of values) {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = capitalise(String(v));
    select.appendChild(opt);
  }
}

function resetFilters() {
  els.search.value = "";
  for (const key of CATEGORY_FILTERS) els[key].value = "";
  els.yearMin.value = yearBounds.min;
  els.yearMax.value = yearBounds.max;
  els.yearMin.min = els.yearMax.min = yearBounds.min;
  els.yearMin.max = els.yearMax.max = yearBounds.max;
  els.priceMin.value = "";
  els.priceMax.value = "";
  els.mileage.value = MILEAGE_ANY;
  updateMileageLabel();
}

function bindEvents() {
  let searchTimer;
  els.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(applyFilters, 200);
  });

  for (const key of [...CATEGORY_FILTERS, "yearMin", "yearMax", "priceMin", "priceMax"]) {
    els[key].addEventListener("change", applyFilters);
  }

  els.mileage.addEventListener("input", () => {
    updateMileageLabel();
    applyFilters();
  });

  els.logScale.addEventListener("change", () => {
    charts.scatter.options.scales.y.type = els.logScale.checked ? "logarithmic" : "linear";
    charts.scatter.update();
  });

  document.querySelectorAll('input[name="trend-stat"]').forEach((radio) => {
    radio.addEventListener("change", updateTrend);
  });

  $("reset").addEventListener("click", () => {
    resetFilters();
    applyFilters();
  });

  $("download").addEventListener("click", downloadCsv);

  document.querySelectorAll("th[data-key]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.key;
      table.dir = table.key === key ? -table.dir : 1;
      table.key = key;
      table.page = 0;
      renderTable();
    });
  });

  els.prev.addEventListener("click", () => { table.page--; renderTable(); });
  els.next.addEventListener("click", () => { table.page++; renderTable(); });
}

function updateMileageLabel() {
  const v = Number(els.mileage.value);
  els.mileageLabel.textContent = v >= MILEAGE_ANY ? "Any" : `${num.format(v)} km`;
}

function readNumber(input) {
  return input.value === "" ? null : Number(input.value);
}

function applyFilters() {
  const search = els.search.value.trim().toLowerCase();
  const categories = CATEGORY_FILTERS.map((key) => [key, els[key].value]).filter(([, v]) => v !== "");
  const yearMin = readNumber(els.yearMin) ?? yearBounds.min;
  const yearMax = readNumber(els.yearMax) ?? yearBounds.max;
  const priceMin = readNumber(els.priceMin);
  const priceMax = readNumber(els.priceMax);
  const mileageMax = Number(els.mileage.value);

  filtered = allRows.filter((r) =>
    (!search || r.name.toLowerCase().includes(search)) &&
    categories.every(([key, v]) => String(r[key]) === v) &&
    r.year >= yearMin && r.year <= yearMax &&
    (priceMin === null || r.price >= priceMin) &&
    (priceMax === null || r.price <= priceMax) &&
    (mileageMax >= MILEAGE_ANY || r.mileage <= mileageMax)
  );

  table.page = 0;
  renderKpis();
  updateCharts();
  renderTable();
}

/* ---------- KPIs ---------- */

function renderKpis() {
  const has = filtered.length > 0;
  $("k-count").textContent = num.format(filtered.length);
  $("k-price").textContent = has ? aud.format(median(filtered.map((r) => r.price))) : "–";
  $("k-mileage").textContent = has ? `${num.format(Math.round(median(filtered.map((r) => r.mileage))))} km` : "–";
  $("k-year").textContent = has ? Math.round(median(filtered.map((r) => r.year))) : "–";
}

/* ---------- Charts ---------- */

function createCharts() {
  const moneyTick = (v) => aud.format(v);

  charts.scatter = new Chart($("chart-scatter"), {
    type: "scatter",
    data: { datasets: [] },
    options: {
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Mileage (km)" }, ticks: { callback: (v) => num.format(v) } },
        y: {
          type: "logarithmic",
          title: { display: true, text: "Price (AUD)" },
          ticks: { callback: moneyTick, maxTicksLimit: 8 },
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
                `Engine: ${car.engine} L`,
                `Condition: ${capitalise(car.condition)}`,
              ];
            },
          },
        },
      },
    },
  });

  charts.trend = new Chart($("chart-trend"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        y: { position: "left", title: { display: true, text: "Median price (AUD)" }, ticks: { callback: moneyTick } },
        y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Listings" } },
      },
      plugins: {
        tooltip: {
          callbacks: {
            title: (items) => `Year: ${items[0].label}`,
            label: (ctx) => ctx.dataset.yAxisID === "y"
              ? `${ctx.dataset.label}: ${aud.format(ctx.parsed.y)}`
              : `Listings: ${num.format(ctx.parsed.y)}`,
          },
        },
      },
    },
  });

  charts.body = new Chart($("chart-body"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  charts.fuel = new Chart($("chart-fuel"), {
    type: "doughnut",
    data: { labels: [], datasets: [] },
    options: { maintainAspectRatio: false, plugins: { legend: { position: "right" } } },
  });

  charts.brands = new Chart($("chart-brands"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: { indexAxis: "y", maintainAspectRatio: false, plugins: { legend: { display: false } } },
  });

  charts.drive = new Chart($("chart-drive"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: {
      maintainAspectRatio: false,
      scales: { y: { ticks: { callback: moneyTick } } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `Median price: ${aud.format(ctx.parsed.y)}` } },
      },
    },
  });
}

function updateCharts() {
  updateScatter();
  updateTrend();

  const body = countBy(filtered, "body");
  setBar(charts.body, body.map(([k]) => capitalise(k)), body.map(([, v]) => v), "Listings", ACCENT);

  const fuel = countBy(filtered, "fuel");
  charts.fuel.data = {
    labels: fuel.map(([k]) => capitalise(k)),
    datasets: [{ data: fuel.map(([, v]) => v), backgroundColor: PALETTE }],
  };
  charts.fuel.update();

  const brands = countBy(filtered, "brand").slice(0, 10);
  setBar(charts.brands, brands.map(([k]) => k), brands.map(([, v]) => v), "Listings", ACCENT);

  const drive = groupBy(filtered, "drive")
    .map(([k, rows]) => [k, median(rows.map((r) => r.price))])
    .sort((a, b) => b[1] - a[1]);
  setBar(charts.drive, drive.map(([k]) => k), drive.map(([, v]) => v), "Median price", ACCENT);
}

function updateScatter() {
  const sample = filtered.slice(0, SCATTER_MAX_POINTS);
  const toPoint = (r) => ({ x: r.mileage, y: r.price, car: r });
  charts.scatter.data.datasets = [
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
  const mileages = filtered.map((r) => r.mileage).sort((a, b) => a - b);
  const p99 = mileages[Math.floor(mileages.length * 0.99)] || 0;
  charts.scatter.options.scales.x.max = p99 > 0 ? Math.ceil(p99 / 10000) * 10000 : undefined;
  charts.scatter.update();
}

function updateTrend() {
  const useMean = document.querySelector('input[name="trend-stat"]:checked').value === "mean";
  const statLabel = useMean ? "Mean price" : "Median price";
  const average = useMean ? mean : median;

  const byYear = groupBy(filtered, "year").sort((a, b) => a[0] - b[0]);
  charts.trend.options.scales.y.title.text = `${statLabel} (AUD)`;
  charts.trend.data = {
    labels: byYear.map(([year]) => year),
    datasets: [
      {
        type: "line",
        label: statLabel,
        data: byYear.map(([, rows]) => average(rows.map((r) => r.price))),
        borderColor: ACCENT,
        backgroundColor: ACCENT,
        tension: 0.25,
        yAxisID: "y",
        order: 0,
      },
      {
        type: "bar",
        label: "Listings",
        data: byYear.map(([, rows]) => rows.length),
        backgroundColor: "rgba(160, 160, 160, 0.4)",
        yAxisID: "y1",
        order: 1,
      },
    ],
  };
  charts.trend.update();
}

function setBar(chart, labels, values, label, color) {
  chart.data = { labels, datasets: [{ label, data: values, backgroundColor: color }] };
  chart.update();
}

/* ---------- Table ---------- */

function renderTable() {
  const { key, dir } = table;
  const sorted = [...filtered].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  table.page = Math.min(Math.max(table.page, 0), pages - 1);
  const start = table.page * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  els.tableBody.innerHTML = pageRows.map((r) => `
    <tr>
      <td>${escapeHtml(r.name)}</td>
      <td class="num">${r.year}</td>
      <td>${escapeHtml(capitalise(r.body))}</td>
      <td>${escapeHtml(capitalise(r.condition))}</td>
      <td class="num">${num.format(r.mileage)}</td>
      <td>${escapeHtml(capitalise(r.fuel))}</td>
      <td>${escapeHtml(capitalise(r.transmission))}</td>
      <td class="num">${aud.format(r.price)}</td>
    </tr>`).join("");

  els.tableInfo.textContent = sorted.length
    ? `Showing ${num.format(start + 1)}–${num.format(start + pageRows.length)} of ${num.format(sorted.length)}`
    : "No listings match these filters";
  els.pageInfo.textContent = `Page ${table.page + 1} of ${pages}`;
  els.prev.disabled = table.page === 0;
  els.next.disabled = table.page >= pages - 1;

  document.querySelectorAll("th[data-key]").forEach((th) => {
    th.classList.toggle("sorted-asc", th.dataset.key === key && dir === 1);
    th.classList.toggle("sorted-desc", th.dataset.key === key && dir === -1);
  });
}

/* ---------- Download ---------- */

function downloadCsv() {
  const blob = new Blob([Papa.unparse(filtered)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "car_ads_filtered.csv";
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Helpers ---------- */

function median(values) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r[key])) groups.set(r[key], []);
    groups.get(r[key]).push(r);
  }
  return [...groups.entries()];
}

function countBy(rows, key) {
  return groupBy(rows, key)
    .map(([k, items]) => [k, items.length])
    .sort((a, b) => b[1] - a[1]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function capitalise(s) {
  if (s === "suv") return "SUV";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
