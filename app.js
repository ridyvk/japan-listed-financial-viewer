const state = {
  selectedSymbol: null,
  selectedRange: "1y",
  installPrompt: null,
  companies: [],
  filteredCompanies: [],
};

const el = {
  input: document.querySelector("#company-search"),
  searchButton: document.querySelector("#search-button"),
  installButton: document.querySelector("#install-button"),
  status: document.querySelector("#status"),
  directoryStatus: document.querySelector("#directory-status"),
  companyList: document.querySelector("#company-list"),
  companyCount: document.querySelector("#company-count"),
  companyView: document.querySelector("#company-view"),
  companyCode: document.querySelector("#company-code"),
  companyMarket: document.querySelector("#company-market"),
  companyName: document.querySelector("#company-name"),
  companySector: document.querySelector("#company-sector"),
  sourceLink: document.querySelector("#source-link"),
  priceValue: document.querySelector("#price-value"),
  changeValue: document.querySelector("#change-value"),
  marketCapValue: document.querySelector("#market-cap-value"),
  volumeValue: document.querySelector("#volume-value"),
  spotlightGrid: document.querySelector("#spotlight-grid"),
  infoIndustry: document.querySelector("#info-industry"),
  infoState: document.querySelector("#info-state"),
  infoFetched: document.querySelector("#info-fetched"),
  infoSource: document.querySelector("#info-source"),
  metricNav: document.querySelector("#metric-nav"),
  metricGrid: document.querySelector("#metric-grid"),
  chart: document.querySelector("#price-chart"),
  rangeButtons: document.querySelector("#range-buttons"),
};

const metricGroups = [
  {
    title: "株価・取引",
    items: [
      ["株価", "price", "yen", "リアルタイム近似"],
      ["前日比", "change", "yen", "当日"],
      ["前日比率", "changePercent", "percent", "当日"],
      ["前日終値", "previousClose", "yen", "株価"],
      ["始値", "open", "yen", "当日"],
      ["高値", "dayHigh", "yen", "当日"],
      ["安値", "dayLow", "yen", "当日"],
      ["出来高", "volume", "shares", "当日"],
      ["売買代金", "tradingValue", "largeYen", "株価 x 出来高"],
      ["時価総額", "marketCap", "largeYen", "最新"],
      ["企業価値 EV", "enterpriseValue", "largeYen", "時価総額+有利子負債-現金"],
      ["発行済株式数", "sharesOutstanding", "shares", "株式"],
      ["52週高値", "fiftyTwoWeekHigh", "yen", "株価"],
      ["52週安値", "fiftyTwoWeekLow", "yen", "株価"],
    ],
  },
  {
    title: "バリュエーション",
    items: [
      ["PER", "trailingPe", "ratio", "株価収益率"],
      ["PER TTM", "trailingPeTtm", "ratio", "直近12か月"],
      ["PEGレシオ", "pegRatio", "ratio", "成長率込みの割安度"],
      ["PBR", "priceToBook", "ratio", "株価純資産倍率"],
      ["PSR", "priceToSales", "ratio", "売上高倍率"],
      ["EV/Sales", "evToSales", "ratio", "企業価値/売上高"],
      ["EV/EBIT", "evToEbit", "ratio", "企業価値/EBIT"],
      ["EV/EBITDA", "evToEbitda", "ratio", "企業価値/EBITDA"],
      ["益回り", "earningsYield", "percent", "純利益/時価総額"],
      ["FCF利回り", "fcfYield", "percent", "FCF/時価総額"],
      ["配当利回り", "dividendYield", "percent", "会社予想/市場データ"],
    ],
  },
  {
    title: "1株指標",
    items: [
      ["予想EPS", "epsForward", "yen", "市場データ"],
      ["基本EPS", "epsBasic", "yen", "実績"],
      ["希薄化後EPS", "epsDiluted", "yen", "実績"],
      ["BPS", "bookValue", "yen", "1株純資産"],
      ["売上高/株", "salesPerShare", "yen", "売上高/株式数"],
      ["FCF/株", "fcfPerShare", "yen", "FCF/株式数"],
      ["現金/株", "cashPerShare", "yen", "現金/株式数"],
      ["有利子負債/株", "debtPerShare", "yen", "有利子負債/株式数"],
    ],
  },
  {
    title: "収益性",
    items: [
      ["ROE", "roe", "percent", "純利益/自己資本"],
      ["ROA", "roa", "percent", "純利益/総資産"],
      ["ROIC", "roic", "percent", "NOPAT/投下資本"],
      ["粗利率", "grossMargin", "percent", "売上総利益/売上高"],
      ["営業利益率", "operatingMargin", "percent", "営業利益/売上高"],
      ["EBITマージン", "ebitMargin", "percent", "EBIT/売上高"],
      ["EBITDAマージン", "ebitdaMargin", "percent", "EBITDA/売上高"],
      ["税引前利益率", "pretaxMargin", "percent", "税引前利益/売上高"],
      ["純利益率", "netMargin", "percent", "純利益/売上高"],
      ["実効税率", "taxRate", "percent", "税金/税引前利益"],
      ["NOPAT", "nopat", "largeYen", "税引後営業利益"],
    ],
  },
  {
    title: "業績・成長",
    items: [
      ["売上高", "revenue", "largeYen", "実績"],
      ["売上総利益", "grossProfit", "largeYen", "実績"],
      ["営業利益", "operatingIncome", "largeYen", "実績"],
      ["EBIT", "ebit", "largeYen", "実績"],
      ["EBITDA", "ebitda", "largeYen", "実績"],
      ["税引前利益", "pretaxIncome", "largeYen", "実績"],
      ["純利益", "netIncome", "largeYen", "実績"],
      ["売上高成長率", "revenueGrowthYoY", "percent", "前年比"],
      ["営業利益成長率", "operatingIncomeGrowthYoY", "percent", "前年比"],
      ["純利益成長率", "netIncomeGrowthYoY", "percent", "前年比"],
      ["EPS成長率", "epsGrowthYoY", "percent", "前年比"],
    ],
  },
  {
    title: "財務安全性",
    items: [
      ["総資産", "totalAssets", "largeYen", "実績"],
      ["流動資産", "currentAssets", "largeYen", "実績"],
      ["負債合計", "totalLiabilities", "largeYen", "実績"],
      ["流動負債", "currentLiabilities", "largeYen", "実績"],
      ["自己資本", "equity", "largeYen", "実績"],
      ["自己資本比率", "equityRatio", "percent", "自己資本/総資産"],
      ["有利子負債", "totalDebt", "largeYen", "実績"],
      ["現金同等物", "cash", "largeYen", "実績"],
      ["ネットデット", "netDebt", "largeYen", "有利子負債-現金"],
      ["ネットキャッシュ", "netCash", "largeYen", "現金-有利子負債"],
      ["ネットキャッシュ比率", "netCashRatio", "percent", "ネットキャッシュ/時価総額"],
      ["運転資本", "workingCapital", "largeYen", "流動資産-流動負債"],
      ["投下資本", "investedCapital", "largeYen", "ROICの分母"],
      ["流動比率", "currentRatio", "ratio", "流動資産/流動負債"],
      ["現金比率", "cashRatio", "ratio", "現金/流動負債"],
      ["D/Eレシオ", "debtToEquity", "percent", "有利子負債/自己資本"],
      ["有利子負債/総資産", "debtToAssets", "percent", "有利子負債/総資産"],
      ["負債/総資産", "liabilitiesToAssets", "percent", "負債合計/総資産"],
      ["ネットデット/自己資本", "netDebtToEquity", "percent", "ネットデット/自己資本"],
      ["ネットデット/EBITDA", "netDebtToEbitda", "ratio", "財務負担"],
    ],
  },
  {
    title: "キャッシュフロー",
    items: [
      ["営業CF", "operatingCashFlow", "largeYen", "実績"],
      ["設備投資", "capitalExpenditure", "largeYen", "実績"],
      ["フリーCF", "freeCashFlow", "largeYen", "営業CF+設備投資"],
      ["FCFマージン", "fcfMargin", "percent", "FCF/売上高"],
      ["営業CF/純利益", "cashConversion", "percent", "現金化率"],
    ],
  },
];

const spotlightDefinitions = [
  ["ROA", "roa", "percent", "総資産から利益を生む力"],
  ["ROIC", "roic", "percent", "投下資本の収益性"],
  ["PEGレシオ", "pegRatio", "ratio", "成長を加味した割安度"],
  ["FCF利回り", "fcfYield", "percent", "時価総額に対するFCF"],
  ["ネットキャッシュ比率", "netCashRatio", "percent", "時価総額に対する余剰現金"],
];

function debounce(fn, wait = 240) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

function setStatus(message, mode = "idle") {
  el.status.textContent = message;
  el.status.className = `status is-${mode}`;
}

function num(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value, digits = 2) {
  const number = num(value);
  if (number === null) return "--";
  return new Intl.NumberFormat("ja-JP", {
    maximumFractionDigits: digits,
    minimumFractionDigits: Math.abs(number) < 10 && number % 1 !== 0 ? 1 : 0,
  }).format(number);
}

function formatYen(value) {
  const number = num(value);
  if (number === null) return "--";
  return `${formatNumber(number, Math.abs(number) >= 100 ? 0 : 2)} 円`;
}

function formatLargeYen(value) {
  const number = num(value);
  if (number === null) return "--";
  const abs = Math.abs(number);
  if (abs >= 1_000_000_000_000) return `${formatNumber(number / 1_000_000_000_000, 2)} 兆円`;
  if (abs >= 100_000_000) return `${formatNumber(number / 100_000_000, 2)} 億円`;
  if (abs >= 10_000) return `${formatNumber(number / 10_000, 2)} 万円`;
  return `${formatNumber(number, 0)} 円`;
}

function formatPercent(value) {
  const number = num(value);
  if (number === null) return "--";
  return `${formatNumber(number, 2)}%`;
}

function formatShares(value) {
  const number = num(value);
  if (number === null) return "--";
  return `${formatNumber(number, 0)} 株`;
}

function formatMetric(value, type) {
  if (type === "yen") return formatYen(value);
  if (type === "largeYen") return formatLargeYen(value);
  if (type === "percent") return formatPercent(value);
  if (type === "shares") return formatShares(value);
  if (type === "ratio") {
    const number = num(value);
    return number === null ? "--" : `${formatNumber(number, 2)} 倍`;
  }
  return formatNumber(value);
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = typeof value === "number" ? new Date(value * 1000) : new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function normalizeSearchText(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function api(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, value);
  });
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "APIエラーが発生しました。");
  return payload;
}

async function loadCompanyDirectory() {
  el.directoryStatus.textContent = "JPXの上場企業一覧を読み込み中";
  el.companyList.innerHTML = `<div class="directory-empty">読み込み中...</div>`;
  try {
    const payload = await api("/api/listed-companies");
    state.companies = payload.results || [];
    state.filteredCompanies = state.companies;
    renderCompanyDirectory();
    el.directoryStatus.textContent = "名前順で表示中";
  } catch (error) {
    el.directoryStatus.textContent = "一覧を読み込めませんでした";
    el.companyList.innerHTML = `<div class="directory-empty">${escapeHtml(error.message)}</div>`;
  }
}

function filterDirectory() {
  const query = normalizeSearchText(el.input.value);
  state.filteredCompanies = query
    ? state.companies.filter((company) => normalizeSearchText(`${company.code}${company.name}${company.shortName}${company.symbol}`).includes(query))
    : state.companies;
  renderCompanyDirectory();
}

function renderCompanyDirectory() {
  el.companyList.innerHTML = "";
  const companies = state.filteredCompanies;
  el.companyCount.textContent = `${companies.length.toLocaleString("ja-JP")}社`;
  if (!companies.length) {
    el.companyList.innerHTML = `<div class="directory-empty">該当する企業がありません。</div>`;
    return;
  }
  const fragment = document.createDocumentFragment();
  companies.forEach((company) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "company-item";
    button.dataset.symbol = company.symbol;
    button.innerHTML = `
      <span class="company-item-main">
        <span class="company-item-name">${escapeHtml(company.name)}</span>
        <span class="company-item-meta">${escapeHtml(company.shortName || company.symbol)}</span>
      </span>
      <span class="company-item-code">${escapeHtml(company.code)}</span>
    `;
    button.addEventListener("click", () => selectCompany(company.symbol, company.name));
    fragment.appendChild(button);
  });
  el.companyList.appendChild(fragment);
}

function findVisibleCompany() {
  const value = el.input.value.trim().toUpperCase();
  if (/^[0-9A-Z]{4}(\.T)?$/i.test(value)) {
    const code = value.replace(/\.T$/i, "");
    return { symbol: `${code}.T`, name: code };
  }
  return state.filteredCompanies[0] || null;
}

async function selectCompany(symbol, displayName = "") {
  if (!symbol) return;
  state.selectedSymbol = symbol;
  el.input.value = displayName || symbol.replace(/\.T$/i, "");
  setStatus(`${displayName || symbol} の指標を取得しています。`, "loading");
  el.companyList.querySelectorAll(".company-item").forEach((item) => item.classList.toggle("is-selected", item.dataset.symbol === symbol));
  try {
    const [company, chart] = await Promise.all([
      api("/api/company", { symbol }),
      api("/api/chart", { symbol, range: state.selectedRange }),
    ]);
    renderCompany(company);
    renderChart(chart.points || []);
    focusCompanyView();
    setStatus(`${company.name} の最新データを表示しています。`, "idle");
  } catch (error) {
    setStatus(error.message, "error");
  }
}

function focusCompanyView() {
  if (!window.matchMedia("(max-width: 1180px)").matches) return;
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  window.setTimeout(() => {
    const top = el.companyView.getBoundingClientRect().top + window.scrollY - 8;
    window.scrollTo({ top: Math.max(0, top), behavior });
  }, 140);
}

function renderCompany(company) {
  const metrics = company.metrics || {};
  el.companyView.classList.remove("is-hidden");
  el.companyCode.textContent = `${company.code} / ${company.symbol}`;
  el.companyMarket.textContent = company.exchange || "Tokyo";
  el.companyName.textContent = company.name || company.symbol;
  el.companySector.textContent = [company.sector, company.industry].filter(Boolean).join(" / ") || "業種情報なし";
  el.sourceLink.href = company.sourceUrl || "#";
  el.priceValue.textContent = formatYen(metrics.price);
  el.changeValue.textContent = `${formatYen(metrics.change)} (${formatPercent(metrics.changePercent)})`;
  el.changeValue.classList.toggle("is-positive", num(metrics.change) > 0);
  el.changeValue.classList.toggle("is-negative", num(metrics.change) < 0);
  el.marketCapValue.textContent = formatLargeYen(metrics.marketCap);
  el.volumeValue.textContent = formatShares(metrics.volume);
  el.infoIndustry.textContent = company.industry || company.sector || "--";
  el.infoState.textContent = company.marketState || formatDateTime(company.regularMarketTime);
  el.infoFetched.textContent = formatDateTime(company.fetchedAt);
  el.infoSource.textContent = company.source || "--";
  renderSpotlights(metrics);
  renderMetrics(metrics);
}

function renderSpotlights(metrics) {
  el.spotlightGrid.innerHTML = spotlightDefinitions.map(([label, key, type, note]) => {
    const missing = num(metrics[key]) === null;
    return `
      <article class="spotlight-card${missing ? " is-empty" : ""}">
        <span>${label}</span>
        <strong>${formatMetric(metrics[key], type)}</strong>
        <em>${note}</em>
      </article>
    `;
  }).join("");
}

function renderMetrics(metrics) {
  el.metricGrid.innerHTML = "";
  el.metricNav.innerHTML = "";
  const metricFragment = document.createDocumentFragment();
  const navFragment = document.createDocumentFragment();
  metricGroups.forEach((group, index) => {
    const sectionId = `metric-group-${index}`;
    const navButton = document.createElement("button");
    navButton.type = "button";
    navButton.textContent = group.title;
    if (index === 0) navButton.classList.add("is-active");
    navButton.addEventListener("click", () => {
      el.metricNav.querySelectorAll("button").forEach((item) => item.classList.remove("is-active"));
      navButton.classList.add("is-active");
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    navFragment.appendChild(navButton);

    const section = document.createElement("section");
    section.className = "metric-group";
    section.id = sectionId;
    const cards = group.items.map(([label, key, type, note]) => {
      const missing = num(metrics[key]) === null;
      return `
        <article class="metric-card${missing ? " is-empty" : ""}">
          <span>${label}</span>
          <strong>${formatMetric(metrics[key], type)}</strong>
          <em>${note}</em>
        </article>
      `;
    }).join("");
    section.innerHTML = `<h4>${group.title}</h4><div class="metric-card-grid">${cards}</div>`;
    metricFragment.appendChild(section);
  });
  el.metricNav.appendChild(navFragment);
  el.metricGrid.appendChild(metricFragment);
}

function renderChart(points) {
  const canvas = el.chart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(320, Math.floor(rect.width * dpr));
  canvas.height = Math.max(220, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const width = rect.width;
  const height = rect.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fbfdfc";
  ctx.fillRect(0, 0, width, height);
  if (!points.length) {
    ctx.fillStyle = "#66736f";
    ctx.font = "14px system-ui, sans-serif";
    ctx.fillText("チャートデータを取得できませんでした。", 18, 34);
    return;
  }
  const padding = { top: 22, right: 18, bottom: 34, left: 58 };
  const values = points.map((point) => point.close).filter(Number.isFinite);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  ctx.strokeStyle = "#d9e2de";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 4; i += 1) {
    const y = padding.top + (plotHeight / 4) * i;
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
  }
  ctx.stroke();
  ctx.fillStyle = "#65726f";
  ctx.font = "12px system-ui, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 4; i += 1) {
    const value = max - (span / 4) * i;
    const y = padding.top + (plotHeight / 4) * i;
    ctx.fillText(formatNumber(value, value > 100 ? 0 : 2), padding.left - 8, y);
  }
  const xFor = (index) => padding.left + (plotWidth * index) / Math.max(1, points.length - 1);
  const yFor = (value) => padding.top + ((max - value) / span) * plotHeight;
  const gradient = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
  gradient.addColorStop(0, "rgba(15, 118, 110, 0.22)");
  gradient.addColorStop(1, "rgba(15, 118, 110, 0)");
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.close);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(xFor(points.length - 1), height - padding.bottom);
  ctx.lineTo(xFor(0), height - padding.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.beginPath();
  points.forEach((point, index) => {
    const x = xFor(index);
    const y = yFor(point.close);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#0f766e";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = "#65726f";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText(formatShortDate(points[0].time), padding.left, height - padding.bottom + 10);
  ctx.textAlign = "right";
  ctx.fillText(formatShortDate(points[points.length - 1].time), width - padding.right, height - padding.bottom + 10);
}

function formatShortDate(value) {
  return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(new Date(value));
}

function runSearchOrSelect() {
  filterDirectory();
  const company = findVisibleCompany();
  if (!company) {
    setStatus("該当する企業がありません。企業名か4桁コードで検索してください。", "error");
    return;
  }
  selectCompany(company.symbol, company.name);
}

function setupInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    state.installPrompt = event;
    el.installButton.classList.remove("is-hidden");
  });
  el.installButton.addEventListener("click", async () => {
    if (!state.installPrompt) return;
    state.installPrompt.prompt();
    const choice = await state.installPrompt.userChoice.catch(() => null);
    state.installPrompt = null;
    if (!choice || choice.outcome === "accepted") el.installButton.classList.add("is-hidden");
  });
  window.addEventListener("appinstalled", () => {
    state.installPrompt = null;
    el.installButton.classList.add("is-hidden");
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => navigator.serviceWorker.register("/service-worker.js").catch(() => {}));
}

el.input.addEventListener("input", debounce(filterDirectory));
el.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    runSearchOrSelect();
  }
});
el.searchButton.addEventListener("click", runSearchOrSelect);
el.rangeButtons.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-range]");
  if (!button || !state.selectedSymbol) return;
  state.selectedRange = button.dataset.range;
  el.rangeButtons.querySelectorAll("button").forEach((item) => item.classList.toggle("is-active", item === button));
  setStatus(`${state.selectedRange} のチャートを取得しています。`, "loading");
  try {
    const chart = await api("/api/chart", { symbol: state.selectedSymbol, range: state.selectedRange });
    renderChart(chart.points || []);
    setStatus("チャートを更新しました。", "idle");
  } catch (error) {
    setStatus(error.message, "error");
  }
});
window.addEventListener("resize", debounce(async () => {
  if (!state.selectedSymbol) return;
  const chart = await api("/api/chart", { symbol: state.selectedSymbol, range: state.selectedRange }).catch(() => null);
  if (chart) renderChart(chart.points || []);
}, 260));

setupInstallPrompt();
registerServiceWorker();
loadCompanyDirectory();
