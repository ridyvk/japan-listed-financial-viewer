const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4180);
const PUBLIC_DIR = __dirname;
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36";
const JPX_URL = "https://jpx-explorer.com/ja-JP";
const cache = new Map();

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
};

const FUNDAMENTAL_TYPES = [
  "annualTotalRevenue",
  "annualGrossProfit",
  "annualOperatingIncome",
  "annualEBIT",
  "annualEBITDA",
  "annualPretaxIncome",
  "annualTaxProvision",
  "annualNetIncome",
  "annualBasicEPS",
  "annualDilutedEPS",
  "annualTotalAssets",
  "annualCurrentAssets",
  "annualTotalLiabilitiesNetMinorityInterest",
  "annualCurrentLiabilities",
  "annualStockholdersEquity",
  "annualTotalDebt",
  "annualNetDebt",
  "annualCashAndCashEquivalents",
  "annualCashCashEquivalentsAndShortTermInvestments",
  "annualWorkingCapital",
  "annualInvestedCapital",
  "annualOperatingCashFlow",
  "annualCapitalExpenditure",
  "annualFreeCashFlow",
  "trailingPeRatio",
  "trailingPegRatio",
  "trailingPsRatio",
  "trailingPbRatio",
  "trailingEnterprisesValueEBITDARatio"
];

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}

function fail(res, status, message) {
  json(res, status, { error: message });
}

function sendStatic(req, res, pathname) {
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(PUBLIC_DIR, `.${decodeURIComponent(requested)}`);
  if (!(filePath === PUBLIC_DIR || filePath.startsWith(PUBLIC_DIR + path.sep))) return fail(res, 403, "Forbidden");
  fs.readFile(filePath, (err, data) => {
    if (err) return fail(res, 404, "File not found");
    res.writeHead(200, { "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(data);
  });
}

async function fetchText(url, ttl = 300000) {
  const key = `text:${url}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ttl) return hit.value;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "text/html,text/plain,*/*", "accept-language": "ja,en-US;q=0.9" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const value = await response.text();
  cache.set(key, { time: Date.now(), value });
  return value;
}

async function fetchJson(url, ttl = 300000) {
  const key = `json:${url}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < ttl) return hit.value;
  const response = await fetch(url, { headers: { "user-agent": USER_AGENT, accept: "application/json,text/plain,*/*", "accept-language": "ja,en-US;q=0.9" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const value = await response.json();
  cache.set(key, { time: Date.now(), value });
  return value;
}

function codeOf(value) {
  const m = String(value || "").toUpperCase().match(/[0-9A-Z]{4}/);
  return m ? m[0] : "";
}

function symbolOf(value) {
  const code = codeOf(value);
  return code ? `${code}.T` : String(value || "").toUpperCase();
}

function norm(value) {
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function extractEscapedArray(html, key) {
  const start = html.indexOf(key);
  if (start < 0) return null;
  const s = html.slice(start + key.length, start + key.length + 1800000).replace(/\\"/g, "\"");
  let depth = 0, quote = false, esc = false;
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quote) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") quote = false;
      continue;
    }
    if (ch === "\"") quote = true;
    else if (ch === "[") depth += 1;
    else if (ch === "]") {
      depth -= 1;
      if (depth === 0) return s.slice(0, i + 1);
    }
  }
  return null;
}

async function listedCompanies() {
  const key = "listed-companies";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 21600000) return hit.value;
  const html = await fetchText(JPX_URL, 21600000);
  const raw = extractEscapedArray(html, "\\\"stockList\\\":");
  if (!raw) throw new Error("Could not load JPX company directory");
  const rows = JSON.parse(raw).map((x) => {
    const code = codeOf(x.symbol || x.ticker_symbol);
    if (!code) return null;
    return { symbol: `${code}.T`, code, name: x.CoName || code, shortName: x.CoNameEn || "", exchange: "Tokyo", source: "JPX Market Explorer" };
  }).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, "ja"));
  cache.set(key, { time: Date.now(), value: rows });
  return rows;
}

function n(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "object") return n(value.raw ?? value.reportedValue?.raw ?? value.value);
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function first(...values) {
  for (const value of values) {
    const parsed = n(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function pct(a, b) {
  return a !== null && b !== null && b !== 0 ? (a / b) * 100 : null;
}

function ratio(a, b) {
  return a !== null && b !== null && b !== 0 ? a / b : null;
}

function yoy(a, b) {
  return a !== null && b !== null && b !== 0 ? ((a - b) / Math.abs(b)) * 100 : null;
}

async function yahooQuote(symbol) {
  const url = new URL("https://query1.finance.yahoo.com/v7/finance/quote");
  url.searchParams.set("symbols", symbol);
  url.searchParams.set("lang", "ja-JP");
  url.searchParams.set("region", "JP");
  const data = await fetchJson(url.toString());
  return data?.quoteResponse?.result?.[0] || {};
}

async function chart(symbol, range = "1y") {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.searchParams.set("range", range);
  url.searchParams.set("interval", range === "1mo" ? "1d" : "1d");
  url.searchParams.set("events", "div,splits");
  url.searchParams.set("lang", "ja-JP");
  url.searchParams.set("region", "JP");
  const data = await fetchJson(url.toString());
  if (data?.chart?.error) throw new Error(data.chart.error.description || "Chart error");
  const result = data?.chart?.result?.[0] || {};
  const q = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  const points = (result.timestamp || []).map((t, i) => ({
    time: t * 1000,
    open: q.open?.[i] ?? null,
    high: q.high?.[i] ?? null,
    low: q.low?.[i] ?? null,
    close: q.close?.[i] ?? adj[i] ?? null,
    volume: q.volume?.[i] ?? null
  })).filter((p) => Number.isFinite(p.close));
  return { symbol, range, currency: result.meta?.currency || "JPY", meta: result.meta || {}, points };
}

async function fundamentals(symbol) {
  const url = new URL(`https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("type", FUNDAMENTAL_TYPES.join(","));
  url.searchParams.set("period1", String(Math.floor(new Date("2018-01-01T00:00:00Z").getTime() / 1000)));
  url.searchParams.set("period2", String(Math.floor(Date.now() / 1000)));
  const data = await fetchJson(url.toString());
  const latest = {}, previous = {};
  for (const row of data?.timeseries?.result || []) {
    const key = Object.keys(row).find((k) => k !== "meta" && k !== "timestamp");
    const values = (row[key] || []).map((x) => ({ value: n(x.reportedValue), date: x.asOfDate || "" })).filter((x) => x.value !== null).sort((a, b) => a.date.localeCompare(b.date));
    if (values.length) {
      latest[key] = values[values.length - 1];
      if (values.length > 1) previous[key] = values[values.length - 2];
    }
  }
  const v = (key) => latest[key]?.value ?? null;
  const p = (key) => previous[key]?.value ?? null;
  return { v, p, latest };
}

async function company(symbolInput) {
  const symbol = symbolOf(symbolInput);
  if (!/^[0-9A-Z]{4}\.T$/i.test(symbol)) {
    const e = new Error("Use a Tokyo-listed 4-character code or .T symbol");
    e.status = 400;
    throw e;
  }
  const code = codeOf(symbol);
  const [dir, q, c, f] = await Promise.allSettled([listedCompanies(), yahooQuote(symbol), chart(symbol, "1d"), fundamentals(symbol)]);
  const listed = dir.status === "fulfilled" ? dir.value.find((x) => x.code === code) : null;
  const quote = q.status === "fulfilled" ? q.value : {};
  const oneDay = c.status === "fulfilled" ? c.value : { meta: {}, points: [] };
  const ff = f.status === "fulfilled" ? f.value : { v: () => null, p: () => null, latest: {} };
  const v = ff.v, p = ff.p;

  const price = first(quote.regularMarketPrice, oneDay.meta.regularMarketPrice);
  const previousClose = first(quote.regularMarketPreviousClose, oneDay.meta.previousClose, oneDay.meta.chartPreviousClose);
  const change = price !== null && previousClose !== null ? price - previousClose : null;
  const changePercent = pct(change, previousClose);
  const volume = first(quote.regularMarketVolume, oneDay.meta.regularMarketVolume);
  const shares = first(quote.sharesOutstanding, quote.impliedSharesOutstanding);
  const marketCap = first(quote.marketCap, price !== null && shares !== null ? price * shares : null);

  const revenue = first(v("annualTotalRevenue"));
  const grossProfit = first(v("annualGrossProfit"));
  const operatingIncome = first(v("annualOperatingIncome"));
  const ebit = first(v("annualEBIT"), operatingIncome);
  const ebitda = first(v("annualEBITDA"));
  const pretaxIncome = first(v("annualPretaxIncome"));
  const taxProvision = first(v("annualTaxProvision"));
  const netIncome = first(v("annualNetIncome"));
  const assets = first(v("annualTotalAssets"));
  const currentAssets = first(v("annualCurrentAssets"));
  const liabilities = first(v("annualTotalLiabilitiesNetMinorityInterest"));
  const currentLiabilities = first(v("annualCurrentLiabilities"));
  const equity = first(v("annualStockholdersEquity"));
  const debt = first(v("annualTotalDebt"));
  const cash = first(v("annualCashCashEquivalentsAndShortTermInvestments"), v("annualCashAndCashEquivalents"));
  const netDebt = first(v("annualNetDebt"), debt !== null && cash !== null ? debt - cash : null);
  const netCash = debt !== null && cash !== null ? cash - debt : null;
  const workingCapital = first(v("annualWorkingCapital"), currentAssets !== null && currentLiabilities !== null ? currentAssets - currentLiabilities : null);
  const investedCapital = first(v("annualInvestedCapital"), debt !== null && equity !== null && cash !== null ? debt + equity - cash : null);
  const ocf = first(v("annualOperatingCashFlow"));
  const capex = first(v("annualCapitalExpenditure"));
  const fcf = first(v("annualFreeCashFlow"), ocf !== null && capex !== null ? ocf + capex : null);
  const taxRate = ratio(taxProvision, pretaxIncome);
  const nopat = ebit !== null ? ebit * (1 - Math.max(0, Math.min(taxRate ?? 0.3, 0.6))) : null;
  const enterpriseValue = marketCap !== null && debt !== null && cash !== null ? marketCap + debt - cash : null;

  return {
    symbol,
    code,
    name: quote.longName || quote.shortName || listed?.name || symbol,
    exchange: quote.fullExchangeName || listed?.exchange || "Tokyo",
    sector: quote.sector || "",
    industry: quote.industry || "",
    marketState: quote.marketState || "",
    regularMarketTime: quote.regularMarketTime || oneDay.meta.regularMarketTime || null,
    sourceUrl: `https://finance.yahoo.co.jp/quote/${symbol}/`,
    fundamentalsAsOf: ff.latest.annualTotalRevenue?.date || ff.latest.annualTotalAssets?.date || "",
    fetchedAt: new Date().toISOString(),
    source: "JPX Market Explorer / Yahoo Finance",
    metrics: {
      price, previousClose, change, changePercent, open: first(quote.regularMarketOpen), dayHigh: first(quote.regularMarketDayHigh), dayLow: first(quote.regularMarketDayLow), volume,
      tradingValue: price !== null && volume !== null ? price * volume : null, marketCap, enterpriseValue, sharesOutstanding: shares, fiftyTwoWeekHigh: first(quote.fiftyTwoWeekHigh), fiftyTwoWeekLow: first(quote.fiftyTwoWeekLow),
      trailingPe: first(quote.trailingPE, v("trailingPeRatio")), trailingPeTtm: first(v("trailingPeRatio")), pegRatio: first(quote.pegRatio, v("trailingPegRatio")), priceToBook: first(quote.priceToBook, v("trailingPbRatio")), priceToSales: first(v("trailingPsRatio"), ratio(marketCap, revenue)), evToSales: ratio(enterpriseValue, revenue), evToEbit: ratio(enterpriseValue, ebit), evToEbitda: first(v("trailingEnterprisesValueEBITDARatio"), ratio(enterpriseValue, ebitda)), earningsYield: pct(netIncome, marketCap), fcfYield: pct(fcf, marketCap), dividendYield: quote.dividendYield ? quote.dividendYield * 100 : null,
      epsForward: first(quote.epsForward), epsBasic: first(v("annualBasicEPS")), epsDiluted: first(v("annualDilutedEPS")), bookValue: first(quote.bookValue, ratio(equity, shares)), salesPerShare: ratio(revenue, shares), fcfPerShare: ratio(fcf, shares), cashPerShare: ratio(cash, shares), debtPerShare: ratio(debt, shares),
      revenue, grossProfit, operatingIncome, ebit, ebitda, pretaxIncome, netIncome, revenueGrowthYoY: yoy(revenue, p("annualTotalRevenue")), operatingIncomeGrowthYoY: yoy(operatingIncome, p("annualOperatingIncome")), netIncomeGrowthYoY: yoy(netIncome, p("annualNetIncome")), epsGrowthYoY: yoy(v("annualDilutedEPS"), p("annualDilutedEPS")),
      grossMargin: pct(grossProfit, revenue), operatingMargin: pct(operatingIncome, revenue), ebitMargin: pct(ebit, revenue), ebitdaMargin: pct(ebitda, revenue), pretaxMargin: pct(pretaxIncome, revenue), netMargin: pct(netIncome, revenue), taxRate: taxRate !== null ? taxRate * 100 : null, roe: pct(netIncome, equity), roa: pct(netIncome, assets), roic: pct(nopat, investedCapital), nopat,
      totalAssets: assets, currentAssets, totalLiabilities: liabilities, currentLiabilities, equity, equityRatio: pct(equity, assets), totalDebt: debt, cash, cashAndInvestments: cash, netDebt, netCash, netCashRatio: pct(netCash, marketCap), workingCapital, investedCapital, currentRatio: ratio(currentAssets, currentLiabilities), cashRatio: ratio(cash, currentLiabilities), debtToEquity: pct(debt, equity), debtToAssets: pct(debt, assets), liabilitiesToAssets: pct(liabilities, assets), netDebtToEquity: pct(netDebt, equity), netDebtToEbitda: ratio(netDebt, ebitda),
      operatingCashFlow: ocf, capitalExpenditure: capex, freeCashFlow: fcf, fcfMargin: pct(fcf, revenue), cashConversion: pct(ocf, netIncome)
    }
  };
}

async function route(req, res, url) {
  try {
    if (url.pathname === "/api/listed-companies") {
      const q = norm(url.searchParams.get("q"));
      const limit = Number(url.searchParams.get("limit") || 0);
      let rows = await listedCompanies();
      if (q) rows = rows.filter((x) => norm(`${x.code}${x.name}${x.shortName}`).includes(q));
      return json(res, 200, { results: limit ? rows.slice(0, limit) : rows, total: rows.length });
    }
    if (url.pathname === "/api/company") return json(res, 200, await company(url.searchParams.get("symbol") || url.searchParams.get("code")));
    if (url.pathname === "/api/chart") return json(res, 200, await chart(symbolOf(url.searchParams.get("symbol") || url.searchParams.get("code")), url.searchParams.get("range") || "1y"));
    return fail(res, 404, "API not found");
  } catch (error) {
    return fail(res, error.status || 502, error.message || "Unexpected API error");
  }
}

async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) return route(req, res, url);
  return sendStatic(req, res, url.pathname);
}

function start(port, attempts = 10) {
  const server = http.createServer(handler);
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && attempts > 0) return start(port + 1, attempts - 1);
    throw error;
  });
  server.listen(port, () => console.log(`Japan listed financial viewer running at http://localhost:${port}`));
}

start(PORT);
