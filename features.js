(() => {
  if (typeof state === "undefined" || typeof el === "undefined") return;

  const STORAGE_KEYS = {
    favorites: "jp-financial-viewer:favorites",
    compare: "jp-financial-viewer:compare",
  };
  const MAX_COMPARE = 5;

  const refs = {
    tabs: null,
    panel: null,
    favoriteButton: null,
    compareButton: null,
  };

  state.activeView = "explore";
  state.favorites = readStored(STORAGE_KEYS.favorites);
  state.compare = readStored(STORAGE_KEYS.compare).slice(0, MAX_COMPARE);
  state.companyCache = state.companyCache || new Map();
  state.screenResults = [];
  state.screenCriteria = {
    minRoa: "",
    minRoic: "",
    maxPer: "",
    maxPeg: "",
    minEquityRatio: "",
    minNetCashRatio: "",
    minMarketCapOku: "",
    requireFcf: false,
    limit: "80",
    sort: "quality",
  };

  function readStored(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function writeStored(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function metricNumber(value) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  }

  function firstNumber(...values) {
    for (const value of values) {
      const number = metricNumber(value);
      if (number !== null) return number;
    }
    return null;
  }

  function summaryOf(company) {
    const symbol = company?.symbol || "";
    const code = company?.code || symbol.replace(/\.T$/i, "");
    return {
      symbol,
      code,
      name: company?.name || symbol,
      shortName: company?.shortName || company?.industry || company?.sector || "",
    };
  }

  function findCompany(symbol) {
    return (
      state.companyCache.get(symbol) ||
      state.favorites.find((company) => company.symbol === symbol) ||
      state.compare.find((company) => company.symbol === symbol) ||
      state.companies.find((company) => company.symbol === symbol) ||
      { symbol, code: symbol.replace(/\.T$/i, ""), name: symbol }
    );
  }

  function rememberCompany(company) {
    if (!company?.symbol) return;
    const cached = state.companyCache.get(company.symbol) || {};
    state.companyCache.set(company.symbol, { ...cached, ...company });
  }

  async function fetchCompanyDetail(company) {
    const summary = summaryOf(company);
    const cached = state.companyCache.get(summary.symbol);
    if (cached?.metrics) return cached;
    const detail = await api("/api/company", { symbol: summary.symbol });
    const merged = { ...summary, ...detail };
    rememberCompany(merged);
    return merged;
  }

  function isFavorite(symbol) {
    return state.favorites.some((company) => company.symbol === symbol);
  }

  function isCompared(symbol) {
    return state.compare.some((company) => company.symbol === symbol);
  }

  function toggleFavorite(company) {
    const summary = summaryOf(company);
    if (!summary.symbol) return;
    if (isFavorite(summary.symbol)) {
      state.favorites = state.favorites.filter((item) => item.symbol !== summary.symbol);
    } else {
      state.favorites = [summary, ...state.favorites.filter((item) => item.symbol !== summary.symbol)];
    }
    writeStored(STORAGE_KEYS.favorites, state.favorites);
    refreshFeatureState();
  }

  function toggleCompare(company) {
    const summary = summaryOf(company);
    if (!summary.symbol) return;
    if (isCompared(summary.symbol)) {
      state.compare = state.compare.filter((item) => item.symbol !== summary.symbol);
    } else {
      if (state.compare.length >= MAX_COMPARE) {
        setStatus(`比較は最大${MAX_COMPARE}社までです。`, "error");
        return;
      }
      state.compare = [...state.compare, summary];
    }
    writeStored(STORAGE_KEYS.compare, state.compare);
    refreshFeatureState();
  }

  function installFeatureShell() {
    const tabs = document.createElement("nav");
    tabs.className = "view-tabs";
    tabs.setAttribute("aria-label", "機能切り替え");
    tabs.innerHTML = `
      <button type="button" data-view="explore" class="is-active">探す</button>
      <button type="button" data-view="screen">スクリーニング</button>
      <button type="button" data-view="favorites">お気に入り <span data-count="favorites">0</span></button>
      <button type="button" data-view="compare">比較 <span data-count="compare">0</span></button>
    `;

    const panel = document.createElement("section");
    panel.className = "feature-panel is-hidden";
    panel.setAttribute("aria-live", "polite");

    el.status.parentNode.insertBefore(tabs, el.status);
    el.companyView.parentNode.insertBefore(panel, el.companyView);
    refs.tabs = tabs;
    refs.panel = panel;

    tabs.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-view]");
      if (!button) return;
      setView(button.dataset.view);
    });

    panel.addEventListener("click", handlePanelClick);
    panel.addEventListener("change", handlePanelChange);
    refreshBadges();
  }

  function setView(view) {
    state.activeView = view;
    refs.tabs.querySelectorAll("button[data-view]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.view === view);
    });

    const isExplore = view === "explore";
    refs.panel.classList.toggle("is-hidden", isExplore);
    el.companyView.classList.toggle("is-hidden", !isExplore || !state.selectedSymbol);

    if (!isExplore) renderFeaturePanel();
  }

  function refreshBadges() {
    const favoriteCount = refs.tabs?.querySelector('[data-count="favorites"]');
    const compareCount = refs.tabs?.querySelector('[data-count="compare"]');
    if (favoriteCount) favoriteCount.textContent = state.favorites.length;
    if (compareCount) compareCount.textContent = state.compare.length;
  }

  function refreshFeatureState() {
    refreshBadges();
    updateCompanyActionButtons();
    if (state.activeView !== "explore") renderFeaturePanel();
  }

  function renderFeaturePanel() {
    if (state.activeView === "screen") renderScreenPanel();
    if (state.activeView === "favorites") renderFavoritesPanel();
    if (state.activeView === "compare") renderComparePanel();
  }

  function renderScreenPanel() {
    const c = state.screenCriteria;
    refs.panel.innerHTML = `
      <div class="tool-panel">
        <div class="tool-head">
          <div>
            <p class="panel-kicker">Screening</p>
            <h2>条件で探す</h2>
          </div>
          <span class="quiet-note">現在の企業一覧から先頭N社を調査</span>
        </div>
        <div class="preset-row">
          <button type="button" data-feature-action="preset" data-preset="quality">高収益</button>
          <button type="button" data-feature-action="preset" data-preset="value">割安</button>
          <button type="button" data-feature-action="preset" data-preset="solid">財務健全</button>
        </div>
        <div class="screen-controls">
          ${numberInput("minRoa", "ROA以上", c.minRoa, "%")}
          ${numberInput("minRoic", "ROIC以上", c.minRoic, "%")}
          ${numberInput("maxPer", "PER以下", c.maxPer, "倍")}
          ${numberInput("maxPeg", "PEG以下", c.maxPeg, "倍")}
          ${numberInput("minEquityRatio", "自己資本比率以上", c.minEquityRatio, "%")}
          ${numberInput("minNetCashRatio", "ネットキャッシュ比率以上", c.minNetCashRatio, "%")}
          ${numberInput("minMarketCapOku", "時価総額以上", c.minMarketCapOku, "億円")}
          <label class="field compact-field">
            <span>探索件数</span>
            <select data-screen-input="limit">
              ${option("40", "40社", c.limit)}
              ${option("80", "80社", c.limit)}
              ${option("150", "150社", c.limit)}
              ${option("300", "300社", c.limit)}
            </select>
          </label>
          <label class="field compact-field">
            <span>並び順</span>
            <select data-screen-input="sort">
              ${option("quality", "品質順", c.sort)}
              ${option("roic", "ROIC順", c.sort)}
              ${option("roa", "ROA順", c.sort)}
              ${option("per", "PER低い順", c.sort)}
              ${option("marketCap", "時価総額順", c.sort)}
            </select>
          </label>
          <label class="check-field">
            <input type="checkbox" data-screen-input="requireFcf" ${c.requireFcf ? "checked" : ""} />
            <span>FCFプラス</span>
          </label>
        </div>
        <div class="tool-actions-row">
          <button type="button" class="primary-action" data-feature-action="run-screen">スクリーニング実行</button>
          <span id="screen-progress" class="quiet-note">${screenProgressText()}</span>
        </div>
        <div id="screen-results">${renderScreenResults()}</div>
      </div>
    `;
  }

  function numberInput(key, label, value, suffix) {
    return `
      <label class="field">
        <span>${label}</span>
        <span class="input-with-unit">
          <input type="number" inputmode="decimal" data-screen-input="${key}" value="${escapeHtml(value)}" placeholder="指定なし" />
          <em>${suffix}</em>
        </span>
      </label>
    `;
  }

  function option(value, label, selected) {
    return `<option value="${value}" ${String(selected) === value ? "selected" : ""}>${label}</option>`;
  }

  function screenProgressText() {
    const progress = state.screenProgress;
    if (!progress) return "未実行";
    if (progress.running) return `${progress.done}/${progress.total}社を調査中・${progress.matches}件`;
    return `${progress.done}社を調査・${progress.matches}件`;
  }

  function renderScreenResults() {
    if (!state.screenResults.length) {
      return `<div class="empty-panel">条件を入れて実行すると、ここに候補が並びます。</div>`;
    }
    return renderCompanyRows(
      state.screenResults.map((item) => item.detail),
      {
        metrics: ["roic", "roa", "trailingPe", "pegRatio", "netCashRatio"],
        empty: "条件に合う企業は見つかりませんでした。",
      }
    );
  }

  function collectScreenCriteria() {
    refs.panel.querySelectorAll("[data-screen-input]").forEach((input) => {
      const key = input.dataset.screenInput;
      state.screenCriteria[key] = input.type === "checkbox" ? input.checked : input.value;
    });
    return {
      ...state.screenCriteria,
      minRoa: parseOptionalNumber(state.screenCriteria.minRoa),
      minRoic: parseOptionalNumber(state.screenCriteria.minRoic),
      maxPer: parseOptionalNumber(state.screenCriteria.maxPer),
      maxPeg: parseOptionalNumber(state.screenCriteria.maxPeg),
      minEquityRatio: parseOptionalNumber(state.screenCriteria.minEquityRatio),
      minNetCashRatio: parseOptionalNumber(state.screenCriteria.minNetCashRatio),
      minMarketCap: parseOptionalNumber(state.screenCriteria.minMarketCapOku, 100_000_000),
      limit: Number(state.screenCriteria.limit || 80),
      requireFcf: Boolean(state.screenCriteria.requireFcf),
    };
  }

  function parseOptionalNumber(value, multiplier = 1) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number * multiplier : null;
  }

  function applyPreset(preset) {
    const presets = {
      quality: { minRoa: "5", minRoic: "8", maxPer: "", maxPeg: "", minEquityRatio: "35", minNetCashRatio: "", minMarketCapOku: "", requireFcf: false, sort: "quality" },
      value: { minRoa: "", minRoic: "", maxPer: "15", maxPeg: "1.2", minEquityRatio: "", minNetCashRatio: "", minMarketCapOku: "", requireFcf: false, sort: "per" },
      solid: { minRoa: "", minRoic: "", maxPer: "", maxPeg: "", minEquityRatio: "50", minNetCashRatio: "0", minMarketCapOku: "", requireFcf: true, sort: "quality" },
    };
    state.screenCriteria = { ...state.screenCriteria, ...presets[preset] };
    renderScreenPanel();
  }

  async function runScreen() {
    const criteria = collectScreenCriteria();
    const universe = (state.filteredCompanies.length ? state.filteredCompanies : state.companies).slice(0, criteria.limit);
    if (!universe.length) {
      state.screenResults = [];
      state.screenProgress = { running: false, done: 0, total: 0, matches: 0 };
      renderScreenPanel();
      return;
    }

    const token = Symbol("screen");
    state.screenToken = token;
    state.screenResults = [];
    state.screenProgress = { running: true, done: 0, total: universe.length, matches: 0 };
    renderScreenPanel();

    let cursor = 0;
    const worker = async () => {
      while (cursor < universe.length && state.screenToken === token) {
        const company = universe[cursor];
        cursor += 1;
        try {
          const detail = await fetchCompanyDetail(company);
          if (passesScreen(detail, criteria)) {
            state.screenResults.push({ detail, score: scoreCompany(detail, criteria) });
          }
        } catch {
          // Individual data gaps should not stop the whole screen.
        } finally {
          state.screenProgress.done += 1;
          state.screenProgress.matches = state.screenResults.length;
          updateScreenProgress();
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(4, universe.length) }, worker));
    if (state.screenToken !== token) return;

    state.screenProgress.running = false;
    state.screenResults.sort((a, b) => sortScreenResult(a.detail, b.detail, criteria));
    state.screenResults = state.screenResults.map((item) => item);
    renderScreenPanel();
  }

  function updateScreenProgress() {
    const node = document.querySelector("#screen-progress");
    if (node) node.textContent = screenProgressText();
  }

  function passesScreen(company, criteria) {
    const m = company.metrics || {};
    const per = firstNumber(m.trailingPe, m.trailingPeTtm);
    const checks = [
      [criteria.minRoa, metricNumber(m.roa), (a, b) => b >= a],
      [criteria.minRoic, metricNumber(m.roic), (a, b) => b >= a],
      [criteria.maxPer, per, (a, b) => b <= a],
      [criteria.maxPeg, metricNumber(m.pegRatio), (a, b) => b <= a],
      [criteria.minEquityRatio, metricNumber(m.equityRatio), (a, b) => b >= a],
      [criteria.minNetCashRatio, metricNumber(m.netCashRatio), (a, b) => b >= a],
      [criteria.minMarketCap, metricNumber(m.marketCap), (a, b) => b >= a],
    ];
    const matched = checks.every(([target, value, fn]) => target === null || (value !== null && fn(target, value)));
    if (!matched) return false;
    if (criteria.requireFcf) {
      return (metricNumber(m.freeCashFlow) || 0) > 0 || (metricNumber(m.fcfYield) || 0) > 0;
    }
    return true;
  }

  function scoreCompany(company) {
    const m = company.metrics || {};
    const roic = metricNumber(m.roic) || 0;
    const roa = metricNumber(m.roa) || 0;
    const equity = metricNumber(m.equityRatio) || 0;
    const per = firstNumber(m.trailingPe, m.trailingPeTtm) || 25;
    const peg = metricNumber(m.pegRatio) || 2;
    return roic * 1.5 + roa + equity / 8 - Math.max(0, per - 12) / 4 - Math.max(0, peg - 1) * 2;
  }

  function sortScreenResult(a, b, criteria) {
    const ma = a.metrics || {};
    const mb = b.metrics || {};
    if (criteria.sort === "roic") return (metricNumber(mb.roic) || -Infinity) - (metricNumber(ma.roic) || -Infinity);
    if (criteria.sort === "roa") return (metricNumber(mb.roa) || -Infinity) - (metricNumber(ma.roa) || -Infinity);
    if (criteria.sort === "per") return (firstNumber(ma.trailingPe, ma.trailingPeTtm) || Infinity) - (firstNumber(mb.trailingPe, mb.trailingPeTtm) || Infinity);
    if (criteria.sort === "marketCap") return (metricNumber(mb.marketCap) || -Infinity) - (metricNumber(ma.marketCap) || -Infinity);
    return scoreCompany(b) - scoreCompany(a);
  }

  function renderFavoritesPanel() {
    refs.panel.innerHTML = `
      <div class="tool-panel">
        <div class="tool-head">
          <div>
            <p class="panel-kicker">Watchlist</p>
            <h2>お気に入り</h2>
          </div>
          <span class="quiet-note">${state.favorites.length}社</span>
        </div>
        ${state.favorites.length ? renderCompanyRows(state.favorites, { metrics: [], empty: "" }) : `<div class="empty-panel">企業ページで「お気に入り」を押すと、ここに保存されます。</div>`}
      </div>
    `;
  }

  function renderComparePanel() {
    const selected = state.compare;
    if (!selected.length) {
      refs.panel.innerHTML = `
        <div class="tool-panel">
          <div class="tool-head">
            <div>
              <p class="panel-kicker">Compare</p>
              <h2>企業比較</h2>
            </div>
            <span class="quiet-note">最大${MAX_COMPARE}社</span>
          </div>
          <div class="empty-panel">企業ページや候補リストから「比較」を押すと、横並びで見られます。</div>
        </div>
      `;
      return;
    }

    const needsHydration = selected.some((company) => !state.companyCache.get(company.symbol)?.metrics);
    if (needsHydration) {
      refs.panel.innerHTML = `
        <div class="tool-panel">
          <div class="tool-head">
            <div>
              <p class="panel-kicker">Compare</p>
              <h2>企業比較</h2>
            </div>
            <span class="quiet-note">${selected.length}/${MAX_COMPARE}社</span>
          </div>
          <div class="empty-panel">比較データを取得しています...</div>
        </div>
      `;
      hydrateCompare();
      return;
    }

    const details = selected.map((company) => state.companyCache.get(company.symbol) || company);
    const rows = [
      ["株価", "price", "yen"],
      ["時価総額", "marketCap", "largeYen"],
      ["PER", "trailingPe", "ratio"],
      ["PBR", "priceToBook", "ratio"],
      ["PEG", "pegRatio", "ratio"],
      ["ROA", "roa", "percent"],
      ["ROIC", "roic", "percent"],
      ["自己資本比率", "equityRatio", "percent"],
      ["ネットキャッシュ比率", "netCashRatio", "percent"],
      ["FCF利回り", "fcfYield", "percent"],
      ["売上成長率", "revenueGrowthYoY", "percent"],
    ];

    refs.panel.innerHTML = `
      <div class="tool-panel">
        <div class="tool-head">
          <div>
            <p class="panel-kicker">Compare</p>
            <h2>企業比較</h2>
          </div>
          <span class="quiet-note">${selected.length}/${MAX_COMPARE}社</span>
        </div>
        <div class="compare-wrap">
          <table class="compare-table">
            <thead>
              <tr>
                <th>指標</th>
                ${details.map((company) => `
                  <th>
                    <button type="button" class="plain-company" data-feature-action="open" data-symbol="${company.symbol}">${escapeHtml(company.name)}</button>
                    <button type="button" class="remove-mini" data-feature-action="compare" data-symbol="${company.symbol}">外す</button>
                  </th>
                `).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows.map(([label, key, type]) => `
                <tr>
                  <th>${label}</th>
                  ${details.map((company) => `<td>${formatMetric(company.metrics?.[key], type)}</td>`).join("")}
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  async function hydrateCompare() {
    const token = Symbol("compare");
    state.compareToken = token;
    await Promise.all(state.compare.map((company) => fetchCompanyDetail(company).catch(() => null)));
    if (state.compareToken === token && state.activeView === "compare") renderComparePanel();
  }

  function renderCompanyRows(companies, options) {
    if (!companies.length) return `<div class="empty-panel">${options.empty}</div>`;
    return `
      <div class="tool-list">
        ${companies.map((company) => {
          const summary = summaryOf(company);
          const m = company.metrics || {};
          const metrics = (options.metrics || []).map((key) => metricChip(key, m)).join("");
          return `
            <article class="tool-row">
              <div class="tool-row-main">
                <button type="button" class="plain-company" data-feature-action="open" data-symbol="${summary.symbol}">
                  <strong>${escapeHtml(summary.name)}</strong>
                  <span>${escapeHtml(summary.code)} ${escapeHtml(summary.shortName || "")}</span>
                </button>
                ${metrics ? `<div class="compact-metrics">${metrics}</div>` : ""}
              </div>
              <div class="row-actions">
                <button type="button" data-feature-action="favorite" data-symbol="${summary.symbol}">${isFavorite(summary.symbol) ? "★" : "☆"}</button>
                <button type="button" data-feature-action="compare" data-symbol="${summary.symbol}">${isCompared(summary.symbol) ? "比較中" : "比較"}</button>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    `;
  }

  function metricChip(key, metrics) {
    const labels = {
      roic: ["ROIC", "percent"],
      roa: ["ROA", "percent"],
      trailingPe: ["PER", "ratio"],
      pegRatio: ["PEG", "ratio"],
      netCashRatio: ["Net Cash", "percent"],
    };
    const [label, type] = labels[key] || [key, "ratio"];
    return `<span><em>${label}</em>${formatMetric(metrics[key], type)}</span>`;
  }

  function handlePanelClick(event) {
    const target = event.target.closest("[data-feature-action]");
    if (!target) return;
    const action = target.dataset.featureAction;
    const symbol = target.dataset.symbol;
    if (action === "open") selectCompany(symbol, findCompany(symbol).name);
    if (action === "favorite") toggleFavorite(findCompany(symbol));
    if (action === "compare") toggleCompare(findCompany(symbol));
    if (action === "run-screen") runScreen();
    if (action === "preset") applyPreset(target.dataset.preset);
  }

  function handlePanelChange(event) {
    if (!event.target.matches("[data-screen-input]")) return;
    collectScreenCriteria();
  }

  function renderCompanyActionBar(company) {
    const sourceLink = document.querySelector("#source-link");
    if (!sourceLink) return;

    let actions = document.querySelector(".company-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "company-actions";
      sourceLink.parentNode.replaceChild(actions, sourceLink);

      refs.favoriteButton = document.createElement("button");
      refs.favoriteButton.type = "button";
      refs.favoriteButton.className = "soft-action";

      refs.compareButton = document.createElement("button");
      refs.compareButton.type = "button";
      refs.compareButton.className = "soft-action";

      actions.append(refs.favoriteButton, refs.compareButton, sourceLink);
      refs.favoriteButton.addEventListener("click", () => toggleFavorite(findCompany(state.selectedSymbol)));
      refs.compareButton.addEventListener("click", () => toggleCompare(findCompany(state.selectedSymbol)));
    }

    rememberCompany(company);
    updateCompanyActionButtons();
  }

  function updateCompanyActionButtons() {
    if (!refs.favoriteButton || !refs.compareButton || !state.selectedSymbol) return;
    refs.favoriteButton.textContent = isFavorite(state.selectedSymbol) ? "★ お気に入り" : "☆ お気に入り";
    refs.compareButton.textContent = isCompared(state.selectedSymbol) ? "比較中" : "比較に追加";
  }

  const baseRenderCompany = renderCompany;
  renderCompany = function enhancedRenderCompany(company) {
    rememberCompany(company);
    baseRenderCompany(company);
    renderCompanyActionBar(company);
    refreshBadges();
  };

  const baseSelectCompany = selectCompany;
  selectCompany = async function enhancedSelectCompany(symbol, displayName = "") {
    setView("explore");
    return baseSelectCompany(symbol, displayName);
  };

  const baseRenderCompanyDirectory = renderCompanyDirectory;
  renderCompanyDirectory = function enhancedRenderCompanyDirectory() {
    baseRenderCompanyDirectory();
    refreshBadges();
  };

  installFeatureShell();
})();
