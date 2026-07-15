// Full replacement: Xano-backed competitor metrics dashboard
// - Loads all rows from Xano once
// - Date range is applied entirely on the frontend (no Xano range trigger)

/* -------------------------
   Session / Edit Key helpers
   ------------------------- */
const SESSION_KEY = "cmd.editKey.v1";
function getEditKey() {
  try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch (e) { return ""; }
}
function setEditKey(k) {
  try { sessionStorage.setItem(SESSION_KEY, String(k || "")); } catch (e) {}
}
function clearEditKey() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
}

/* -------------------------
   Runtime config helpers (APP_CONFIG or sessionStorage)
   ------------------------- */
function _getCfg(key) {
  try {
    if (typeof window !== "undefined" && window.APP_CONFIG && window.APP_CONFIG[key]) {
      const v = String(window.APP_CONFIG[key] || "").trim();
      if (v) return v;
    }
  } catch (e) {}
  try {
    const s = sessionStorage.getItem(key);
    if (s && String(s).trim()) return String(s).trim();
  } catch (e) {}
  return null;
}

/* -------------------------
   Xano / Zapier config helpers
   ------------------------- */
const DEFAULT_ZAPIER_URL = "https://hooks.zapier.com/hooks/catch/2414815/u7tlcn7/";
function getZapierTableGetUrl() { return _getCfg("ZAPIER_TABLE_GET_URL") || DEFAULT_ZAPIER_URL; }
function getZapierTablePatchUrl() { return _getCfg("ZAPIER_TABLE_PATCH_URL") || DEFAULT_ZAPIER_URL; }
function getZapierConfigGetUrl() { return _getCfg("ZAPIER_CONFIG_GET_URL"); }
function getZapierHook() { return _getCfg("ZAPIER_CATCH_HOOK_URL"); }

// Xano runtime override getters
function getXanoTableGetUrl() { return _getCfg("XANO_TABLE_GET_URL"); }
function getXanoTablePatchUrl() { return _getCfg("XANO_TABLE_PATCH_URL"); }
function getXanoConfigGetUrl() { return _getCfg("XANO_CONFIG_GET_URL"); }

/* -------------------------
   Xano defaults (fallback)
   ------------------------- */
const XANO_BASE_URL = "https://x8ki-letl-twmt.n7.xano.io/api:ZvixoXZ8";
const XANO_TABLE_PATH = "/competitor_metrics_dashboard";
const XANO_CONFIG_PATH = "/app_config";
const EDIT_KEY_NAME = "EDIT_KEY";

/* -------------------------
   UI / Metrics constants
   ------------------------- */
const METRIC_FIELDS = [
  { key: "domain_authority", label: "Authority Score", format: "int" },
  { key: "number_of_referring_domains", label: "Referring Domains", format: "int" },
  { key: "number_of_organic_keywords", label: "Organic Keywords", format: "int" },
  { key: "organic_traffic", label: "Organic Traffic (est.)", format: "int" },
  { key: "instagram_followers", label: "Instagram Followers", format: "int" },
  { key: "posts_images", label: "Posts / month — Images", format: "int" },
  { key: "posts_reels", label: "Posts / month — Reels", format: "int" },
  { key: "posts_total", label: "Posts / month — Total", format: "int", readOnly: true },
  { key: "engagement_total", label: "Engagements / month — Total", format: "int" },
  { key: "engagement_rate_percentage", label: "Engagement rate %", format: "float" },
  { key: "agency_fee_one_child_weekly", label: "Agency Fee (1 child) / week", format: "int" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee (1 child) / year", format: "int" },
  { key: "meta_ads_running", label: "Meta Ads Running", format: "int" },
  { key: "monthly_press_coverage", label: "Monthly Press Coverage", format: "richtext", editable: true }
];
const NOTES_FIELD_KEY = "notes";

const CHART_METRICS = [
  { key: "domain_authority", label: "Authority Score" },
  { key: "number_of_referring_domains", label: "Referring Domains" },
  { key: "number_of_organic_keywords", label: "Organic Keywords" },
  { key: "organic_traffic", label: "Organic Traffic (est.)" },
  { key: "instagram_followers", label: "Instagram Followers" },
  { key: "agency_fee_one_child_weekly", label: "Agency Fee / week" },
  { key: "agency_fee_one_child_yearly", label: "Agency Fee / year" },
  { key: "meta_ads_running", label: "Meta Ads Running" },
  { key: "number_of_monthly_instagram_posts", label: "Posts / month (Total)" },
  { key: "monthly_instagram_engagement", label: "Engagements / month (Total)" }
];

/* -------------------------
   Company ordering + colors
   ------------------------- */
function normalizeCompanyName(name) { return String(name || "").trim(); }
function companySort(a, b) {
  const aa = normalizeCompanyName(a);
  const bb = normalizeCompanyName(b);
  const aIsSwiis = aa.toLowerCase() === "swiis";
  const bIsSwiis = bb.toLowerCase() === "swiis";
  if (aIsSwiis && !bIsSwiis) return -1;
  if (!aIsSwiis && bIsSwiis) return 1;
  return aa.localeCompare(bb);
}
const COMPANY_COLORS = {
  swiis: "#ef5d2f",
  capstone: "#0d66a2",
  compass: "#1897d3",
  fca: "#f27a30",
  nfa: "#f9ae42",
  "orange grove": "#51277d",
  orangegrove: "#51277d",
  tact: "#b22288"
};
function companyColor(company) {
  const key = normalizeCompanyName(company).toLowerCase();
  if (COMPANY_COLORS[key]) return COMPANY_COLORS[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${hash % 360},70%,45%)`;
}

/* -------------------------
   DOM + formatting helpers
   ------------------------- */
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, val] of Object.entries(attrs)) {
    if (k === "className") node.className = val;
    else if (k === "text") node.textContent = val;
    else if (k === "html") node.innerHTML = val;
    else node.setAttribute(k, val);
  }
  for (const c of children) node.appendChild(c);
  return node;
}
function toNumberOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}
function normalizeText(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}
function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function linkifyTextToHtml(text) {
  if (text === null || text === undefined) return "";
  const safe = escapeHtml(String(text));
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return safe
    .replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`)
    .replaceAll("\n", "<br>");
}

/* -------------------------
   API fetch wrapper
   ------------------------- */
async function apiFetch(url, { method = "GET", body = null, headers = {}, expectJson = true } = {}) {
  const opts = { method, headers: { ...(headers || {}) } };
  if (body !== null && body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
    if (!opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  if (!expectJson) return res;
  return await res.json();
}

/* -------------------------
   Backend adapter (Xano primary)
   ------------------------- */
async function fetchRowsFromBackend() {
  const xanoUrl = getXanoTableGetUrl() || (XANO_BASE_URL + XANO_TABLE_PATH);
  if (!xanoUrl) {
    console.warn("fetchRowsFromBackend: no Xano URL configured");
    return [];
  }
  try {
    console.debug("fetchRowsFromBackend: fetching from Xano:", xanoUrl);
    const res = await apiFetch(xanoUrl, { method: "GET" });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.items)) return res.items;
    if (res && Array.isArray(res.data)) return res.data;
    for (const k of Object.keys(res || {})) if (Array.isArray(res[k])) return res[k];
    return [];
  } catch (err) {
    console.error("fetchRowsFromBackend: Xano GET failed:", err);
    return [];
  }
}

async function patchRowToBackend(rowId, fields) {
  const base = getXanoTablePatchUrl() || (XANO_BASE_URL + XANO_TABLE_PATH);
  const url = `${base.replace(/\/$/, "")}/${encodeURIComponent(rowId)}`;
  const updated = await apiFetch(url, { method: "PATCH", body: fields });
  return updated;
}

/* -------------------------
   fetch edit key (Xano primary, Zapier fallback)
   ------------------------- */
async function fetchEditKeyFromXano() {
  try {
    const cfgUrl = getXanoConfigGetUrl() || (XANO_BASE_URL + XANO_CONFIG_PATH);
    const res = await apiFetch(cfgUrl, { method: "GET" });
    const rows = Array.isArray(res) ? res : (res?.items || res?.data || []);
    if (Array.isArray(rows)) {
      const row = rows.find(r => String(r.key || "").trim() === EDIT_KEY_NAME);
      if (row?.value !== undefined && row?.value !== null) return String(row.value).trim() || null;
    }
    if (res && typeof res === "object" && res[EDIT_KEY_NAME] !== undefined) {
      const v = res[EDIT_KEY_NAME];
      const s = String(v || "").trim();
      return s.length ? s : null;
    }
  } catch (e) {
    console.warn("fetchEditKeyFromXano failed:", e);
  }

  try {
    const cfgUrl = getZapierConfigGetUrl();
    if (cfgUrl) {
      const cfg = await apiFetch(cfgUrl, { method: "GET" });
      const rows = Array.isArray(cfg) ? cfg : (cfg?.items || cfg?.data || []);
      if (Array.isArray(rows)) {
        const row = rows.find(r => String(r.key || "").trim() === EDIT_KEY_NAME);
        if (row?.value !== undefined && row?.value !== null) return String(row.value).trim() || null;
      }
      if (cfg && typeof cfg === "object" && cfg[EDIT_KEY_NAME] !== undefined) {
        const v = cfg[EDIT_KEY_NAME];
        const s = String(v || "").trim();
        return s.length ? s : null;
      }
    }
  } catch (e) {
    console.warn("fetchEditKeyFromZapier failed:", e);
  }

  return null;
}

async function verifyPassword(pw) {
  const actual = await fetchEditKeyFromXano();
  if (!actual) return false;
  const entered = String(pw || "").trim();
  if (!entered) return false;
  return entered === actual;
}

/* -------------------------
   State & normalization
   ------------------------- */
const state = {
  visibleMonths: [],
  rangeStartKey: null,
  rangeEndKey: null,
  minMonthKey: null,
  maxMonthKey: null,
  selectedCompanies: new Set(),
  rows: [],
  latestMonthKey: null,
  lastLoadedAtUtc: null
};

function getObj(root) { return root && typeof root === "object" ? root : {}; }
function readPostsImages(row) { return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).image_graphic); }
function readPostsReels(row) { return toNumberOrNull(getObj(row?.number_of_monthly_instagram_posts).reels_video); }
function readEngagementTotal(row) { return toNumberOrNull(getObj(row?.monthly_instagram_engagement).total_engagement); }
function readEngagementRate(row) { return toNumberOrNull(getObj(row?.monthly_instagram_engagement).engagement_rate_percentage); }

function normalizeRow(row) {
  const r = { ...row };
  const feeObj = r.agency_fee_one_child;
  if (feeObj && typeof feeObj === "object") {
    r.agency_fee_one_child_weekly = toNumberOrNull(feeObj.Weekly ?? feeObj.weekly);
    r.agency_fee_one_child_yearly = toNumberOrNull(feeObj.Yearly ?? feeObj.yearly);
  }
  r.posts_images = readPostsImages(r) ?? 0;
  r.posts_reels = readPostsReels(r) ?? 0;
  r.posts_total = (toNumberOrNull(r.posts_images) || 0) + (toNumberOrNull(r.posts_reels) || 0);
  r.engagement_total = readEngagementTotal(r);
  r.engagement_rate_percentage = readEngagementRate(r);
  r.monthly_press_coverage = normalizeText(r.monthly_press_coverage);
  return r;
}
function getRowId(row) {
  const id = row?.id ?? row?.competitor_metrics_dashboard_id;
  return (id === null || id === undefined || id === "") ? null : id;
}

/* -------------------------
   Patch builder
   ------------------------- */
function buildPatchBodyForMetric(row, fieldKey, rawNum) {
  const num = Number(rawNum);

  if (fieldKey === "agency_fee_one_child_weekly" || fieldKey === "agency_fee_one_child_yearly") {
    const rootKey = "agency_fee_one_child";
    const childKey = fieldKey === "agency_fee_one_child_weekly" ? "Weekly" : "Yearly";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    return { [rootKey]: { ...current, [childKey]: Math.round(num) } };
  }

  if (fieldKey === "posts_images" || fieldKey === "posts_reels") {
    const rootKey = "number_of_monthly_instagram_posts";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    const next = { ...current };
    if (fieldKey === "posts_images") next.image_graphic = Math.round(num);
    if (fieldKey === "posts_reels") next.reels_video = Math.round(num);
    next.number_of_monthly_instagram_posts_total =
      (toNumberOrNull(next.image_graphic) || 0) + (toNumberOrNull(next.reels_video) || 0);
    return { [rootKey]: next };
  }

  if (fieldKey === "posts_total") return null;

  if (fieldKey === "engagement_total" || fieldKey === "engagement_rate_percentage") {
    const rootKey = "monthly_instagram_engagement";
    const current = (row && typeof row[rootKey] === "object" && row[rootKey]) ? row[rootKey] : {};
    const next = { ...current };
    if (fieldKey === "engagement_total") next.total_engagement = Math.round(num);
    if (fieldKey === "engagement_rate_percentage") next.engagement_rate_percentage = num;
    return { [rootKey]: next };
  }

  return { [fieldKey]: Math.round(num) };
}

/* -------------------------
   Month helpers & compute helpers
   ------------------------- */
const MONTHS = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12"
};
const MONTH_LABELS = [
  { name: "January", value: "01" },
  { name: "February", value: "02" },
  { name: "March", value: "03" },
  { name: "April", value: "04" },
  { name: "May", value: "05" },
  { name: "June", value: "06" },
  { name: "July", value: "07" },
  { name: "August", value: "08" },
  { name: "September", value: "09" },
  { name: "October", value: "10" },
  { name: "November", value: "11" },
  { name: "December", value: "12" }
];

function monthKeyFromYearMonthName(year, monthName) {
  const mm = MONTHS[String(monthName || "").toLowerCase()];
  if (!mm) return null;
  return `${year}-${mm}`;
}
function monthKeyFromYYYYMMParts(year, mm) {
  return `${String(year).trim()}-${String(mm).padStart(2, "0")}`;
}
function parseMonthKey(mk) {
  if (!mk || typeof mk !== "string" || mk.length < 7) return null;
  const [y, m] = mk.split("-");
  return { year: Number(y), month: String(m).padStart(2, "0") };
}
function compareMonthKey(a, b) { return String(a).localeCompare(String(b)); }
function listMonthKeysBetween(startKey, endKey) {
  const s = parseMonthKey(startKey), e = parseMonthKey(endKey);
  if (!s || !e) return [];
  const start = new Date(Date.UTC(s.year, Number(s.month) - 1, 1));
  const end = new Date(Date.UTC(e.year, Number(e.month) - 1, 1));
  if (start > end) return [];
  const out = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(`${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`);
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}
function currentMonthKeyUTC() {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}
function previousMonthKeyUTC(monthKey) {
  const p = parseMonthKey(monthKey);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.year, Number(p.month) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
function shiftMonthKey(monthKey, delta) {
  const p = parseMonthKey(monthKey);
  if (!p || !Number.isFinite(delta)) return null;
  const dt = new Date(Date.UTC(p.year, Number(p.month) - 1, 1));
  dt.setUTCMonth(dt.getUTCMonth() + Number(delta));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
function lastMonthKeyUtcYYYYMM() { return previousMonthKeyUTC(currentMonthKeyUTC()); }

function computeLatestMonthKey(rows) {
  const keys = (Array.isArray(rows) ? rows : [])
    .map(r => monthKeyFromYearMonthName(r.year, r.month))
    .filter(Boolean)
    .sort();
  return keys[keys.length - 1] || null;
}
function computeMinMaxMonthKey(rows) {
  const keys = (Array.isArray(rows) ? rows : [])
    .map(r => monthKeyFromYearMonthName(r.year, r.month))
    .filter(Boolean)
    .sort();
  return { min: keys[0] || null, max: keys[keys.length - 1] || null };
}

/* -------------------------
   Date range (frontend-only)
   ------------------------- */
async function applyCustomRangeFromSelectors() {
  const startYear = (document.getElementById("startYear") || {}).value;
  const startMonth = (document.getElementById("startMonth") || {}).value;
  const endYear = (document.getElementById("endYear") || {}).value;
  const endMonth = (document.getElementById("endMonth") || {}).value;

  if (!startYear || !startMonth || !endYear || !endMonth) {
    alert("Please select start and end month/year.");
    return;
  }

  const startKey = monthKeyFromYYYYMMParts(startYear, startMonth);
  const endKey = monthKeyFromYYYYMMParts(endYear, endMonth);

  if (compareMonthKey(startKey, endKey) > 0) {
    alert("Start month must be before (or the same as) End month.");
    return;
  }

  setVisibleRange(startKey, endKey);
}
function applyCustomRangeFromSelectors_v2() { return applyCustomRangeFromSelectors(); }

function clampMonthKeyToDataBounds(monthKey) {
  if (!monthKey) return null;
  let out = monthKey;
  if (state.minMonthKey && compareMonthKey(out, state.minMonthKey) < 0) out = state.minMonthKey;
  if (state.maxMonthKey && compareMonthKey(out, state.maxMonthKey) > 0) out = state.maxMonthKey;
  return out;
}

function setVisibleRange(startKey, endKey) {
  const boundedStart = clampMonthKeyToDataBounds(startKey);
  const boundedEnd = clampMonthKeyToDataBounds(endKey);
  if (!boundedStart || !boundedEnd) return;

  if (compareMonthKey(boundedStart, boundedEnd) > 0) {
    state.rangeStartKey = boundedEnd;
    state.rangeEndKey = boundedEnd;
    state.visibleMonths = [boundedEnd];
  } else {
    state.rangeStartKey = boundedStart;
    state.rangeEndKey = boundedEnd;
    state.visibleMonths = listMonthKeysBetween(boundedStart, boundedEnd);
  }

  setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey);
  refresh();
}

function canShiftVisibleRange(delta) {
  if (!state.minMonthKey || !state.maxMonthKey) return false;

  const startKey = state.rangeStartKey || state.visibleMonths[0] || state.latestMonthKey;
  const endKey = state.rangeEndKey || state.visibleMonths[state.visibleMonths.length - 1] || state.latestMonthKey;
  if (!startKey || !endKey) return false;

  if (delta < 0) return compareMonthKey(startKey, state.minMonthKey) > 0;
  if (delta > 0) return compareMonthKey(endKey, state.maxMonthKey) < 0;
  return false;
}

function updateMonthNavButtonsState() {
  const prevBtn = document.getElementById("prevMonthBtn");
  const nextBtn = document.getElementById("nextMonthBtn");
  if (prevBtn) prevBtn.disabled = !canShiftVisibleRange(-1);
  if (nextBtn) nextBtn.disabled = !canShiftVisibleRange(1);
}

function shiftVisibleRangeByOneMonth(delta) {
  const startKey = state.rangeStartKey || state.visibleMonths[0] || state.latestMonthKey;
  const endKey = state.rangeEndKey || state.visibleMonths[state.visibleMonths.length - 1] || state.latestMonthKey;
  if (!startKey || !endKey) return;

  const shiftedStart = shiftMonthKey(startKey, delta);
  const shiftedEnd = shiftMonthKey(endKey, delta);
  if (!shiftedStart || !shiftedEnd) return;

  setVisibleRange(shiftedStart, shiftedEnd);
}

/* -------------------------
   setLockedUI
   ------------------------- */
function setLockedUI(locked) {
  const lockScreen = document.getElementById("lockScreen");
  const appRoot = document.getElementById("appRoot");
  const lockBtn = document.getElementById("lockBtn");
  if (locked) {
    if (lockScreen) lockScreen.classList.remove("hidden");
    if (appRoot) appRoot.classList.add("hidden");
    if (lockBtn) lockBtn.classList.add("hidden");
  } else {
    if (lockScreen) lockScreen.classList.add("hidden");
    if (appRoot) appRoot.classList.remove("hidden");
    if (lockBtn) lockBtn.classList.remove("hidden");
  }
}

/* -------------------------
   Chart / render / UI functions
   ------------------------- */
let metricChart = null;
let editModalState = null, editTextModalState = null, editNotesModalState = null;

function ensureChartMetricOptions(force = false) {
  const sel = document.getElementById("chartMetricSelect");
  if (!sel) return;
  if (force || sel.options.length === 0) {
    const prev = sel.value;
    sel.innerHTML = "";
    for (const m of CHART_METRICS) {
      const opt = document.createElement("option");
      opt.value = m.key;
      opt.textContent = m.label;
      sel.appendChild(opt);
    }
    const want = prev && CHART_METRICS.some(x => x.key === prev)
      ? prev
      : (CHART_METRICS[0]?.key || "");
    if (want) sel.value = want;
  }
}
function destroyChart() {
  if (metricChart) { metricChart.destroy(); metricChart = null; }
}

function getNumericMetricValue(row, metricKey) {
  if (!row) return null;
  if (metricKey === "number_of_monthly_instagram_posts") return extractPostsTotal(row.number_of_monthly_instagram_posts);
  if (metricKey === "monthly_instagram_engagement") return extractEngagementTotal(row.monthly_instagram_engagement);
  return toNumberOrNull(row[metricKey]);
}

function renderChart() {
  const canvas = document.getElementById("metricChart");
  const sel = document.getElementById("chartMetricSelect");
  const modeLabel = document.getElementById("chartModeLabel");
  if (!canvas || !sel || typeof Chart === "undefined") return;
  if (sel.options.length === 0) ensureChartMetricOptions(true);
  const metricKey = sel.value;
  if (!metricKey) return;
  const metricLabel = CHART_METRICS.find(m => m.key === metricKey)?.label || metricKey;

  const visibleMonths = state.visibleMonths.length
    ? state.visibleMonths
    : (state.latestMonthKey ? [state.latestMonthKey] : []);
  if (!visibleMonths.length) return;
  const singleMonth = visibleMonths.length === 1;

  const companies = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));

  if (modeLabel) {
    modeLabel.textContent = singleMonth
      ? `(Bar • ${visibleMonths[0]})`
      : `(Line • ${visibleMonths[0]} → ${visibleMonths[visibleMonths.length - 1]})`;
  }

  destroyChart();

  if (singleMonth) {
    const mk = visibleMonths[0];
    const values = companies.map(c => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
    const colors = companies.map(companyColor);
    metricChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: companies,
        datasets: [{ label: metricLabel, data: values, backgroundColor: colors }]
      },
      options: { responsive: true, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
    });
  } else {
    const datasets = companies.map((c) => {
      const data = visibleMonths.map(mk => getNumericMetricValue(findRowByCompanyAndMonth(c, mk), metricKey) ?? 0);
      const color = companyColor(c);
      return { label: c, data, tension: 0.25, borderColor: color, backgroundColor: color };
    });
    metricChart = new Chart(canvas, {
      type: "line",
      data: { labels: visibleMonths, datasets },
      options: { responsive: true, plugins: { legend: { display: true } }, scales: { y: { beginAtZero: true } } }
    });
  }
}

function formatValue(v, format) {
  if (v === null || v === undefined || v === "") return "—";
  if (format === "int") {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    return Math.round(n).toLocaleString();
  }
  if (format === "float") {
    const n = Number(v);
    if (!Number.isFinite(n)) return "—";
    const fixed = n.toFixed(2);
    return fixed.replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
  }
  return String(v);
}
function extractPostsTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(
    obj.number_of_monthly_instagram_posts_total ??
    obj.Total ??
    obj.total ??
    obj.total_posts
  );
}
function extractEngagementTotal(obj) {
  if (!obj || typeof obj !== "object") return toNumberOrNull(obj);
  return toNumberOrNull(
    obj.total_engagement ??
    obj.Total ??
    obj.total ??
    obj.totalEngagement
  );
}

function buildMetricsTable(visibleMonths, companies) {
  const table = el("table");
  const thead = el("thead");
  const trh = el("tr");
  trh.appendChild(el("th", { text: "Company" }));
  trh.appendChild(el("th", { text: "Month(s)" }));
  for (const f of METRIC_FIELDS) trh.appendChild(el("th", { text: f.label }));
  trh.appendChild(el("th", { text: "Notes" }));
  thead.appendChild(trh);
  table.appendChild(thead);

  const tbody = el("tbody");
  const singleMonth = visibleMonths.length === 1;

  for (const companyName of companies) {
    const tr = el("tr");
    tr.appendChild(el("td", { text: companyName }));
    tr.appendChild(el("td", { text: singleMonth ? visibleMonths[0] : `${visibleMonths.length} months` }));

    for (const f of METRIC_FIELDS) {
      let displayValue = null, editTargetRow = null, editMonthKey = null;

      if (singleMonth) {
        editMonthKey = visibleMonths[0];
        editTargetRow = findRowByCompanyAndMonth(companyName, editMonthKey);
        displayValue = editTargetRow ? editTargetRow[f.key] : null;
      } else {
        if (f.format === "int" || f.format === "float") {
          displayValue = averageNumericForCompanyAcrossMonths(
            companyName,
            visibleMonths,
            f.key
          );
        } else {
          displayValue = null;
        }
      }

      const td = el("td");

      if (f.format === "richtext") {
        const html = displayValue ? linkifyTextToHtml(displayValue) : "—";
        const div = el("div", {
          className: `clickable-metric metrics-rich${(!displayValue ? " muted-cell" : "")}`,
          html,
          title: singleMonth ? "Click to edit" : "Shown only in single-month view"
        });
        if (singleMonth && editTargetRow && f.editable) {
          div.addEventListener("click", (e) => {
            if (e.target && e.target.closest && e.target.closest("a")) return;
            openEditTextModal({
              row: editTargetRow,
              fieldKey: f.key,
              fieldLabel: f.label,
              currentValue: editTargetRow[f.key],
              monthKey: editMonthKey
            });
          });
        }
        td.appendChild(div);
        tr.appendChild(td);
        continue;
      }

      const isEmpty = displayValue === null || displayValue === undefined || displayValue === "";
      const span = el("span", {
        className: `clickable-metric metrics-num${isEmpty ? " muted-cell" : ""}`,
        text: formatValue(displayValue, f.format),
        title: singleMonth ? (f.readOnly ? "Derived (edit Images/Reels)" : "Click to edit") : "Averaged across selected months"
      });
      if (singleMonth && editTargetRow && !f.readOnly) {
        span.addEventListener("click", () => openEditMetricModal({
          row: editTargetRow,
          fieldKey: f.key,
          fieldLabel: f.label,
          currentValue: editTargetRow[f.key],
          monthKey: editMonthKey
        }));
      }
      td.appendChild(span);
      tr.appendChild(td);
    }

    const notesTd = el("td");
    let notesRow = null, mk = null;
    if (singleMonth) {
      mk = visibleMonths[0];
      notesRow = findRowByCompanyAndMonth(companyName, mk);
    }
    const notesText = singleMonth ? (notesRow?.[NOTES_FIELD_KEY] ?? "") : "";
    const notesPreview = normalizeText(notesText) ? linkifyTextToHtml(notesText) : "—";
    const notesDiv = el("div", {
      className: `clickable-metric metrics-rich${(normalizeText(notesText) ? "" : " muted-cell")}`,
      html: notesPreview,
      title: singleMonth ? "Click to edit notes" : "Switch to a single month to edit notes"
    });
    if (singleMonth && notesRow) {
      notesDiv.addEventListener("click", (e) => {
        if (e.target && e.target.closest && e.target.closest("a")) return;
        openEditNotesModal({ row: notesRow, monthKey: mk });
      });
    }
    notesTd.appendChild(notesDiv);
    tr.appendChild(notesTd);

    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  return table;
}

/* ---------- Modals wiring ---------- */
function openEditMetricModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editModalState = { row, fieldKey, monthKey };
  const backdrop = document.getElementById("editMetricModalBackdrop");
  if (!backdrop) return;
  document.getElementById("editMetricSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editMetricHint").textContent = "This updates the value in backend.";
  const input = document.getElementById("editMetricNewValue");
  if (input) input.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);
  backdrop.style.display = "flex";
  backdrop.setAttribute("aria-hidden", "false");
  setTimeout(() => input && input.focus(), 0);
}
function closeEditMetricModal() {
  const b = document.getElementById("editMetricModalBackdrop");
  if (!b) return;
  b.style.display = "none";
  b.setAttribute("aria-hidden", "true");
  editModalState = null;
}
function openEditTextModal({ row, fieldKey, fieldLabel, currentValue, monthKey }) {
  editTextModalState = { row, fieldKey, monthKey };
  const b = document.getElementById("editTextModalBackdrop");
  if (!b) return;
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • ${fieldLabel}`;
  document.getElementById("editTextHint").textContent = "Multiple lines supported. Ctrl+Enter saves.";
  const ta = document.getElementById("editTextNewValue");
  if (ta) ta.value = (currentValue === null || currentValue === undefined) ? "" : String(currentValue);
  document.getElementById("editTextUpdate").dataset.mode = "press";
  b.style.display = "flex";
  b.setAttribute("aria-hidden", "false");
  setTimeout(() => ta && ta.focus(), 0);
}
function openEditNotesModal({ row, monthKey }) {
  editNotesModalState = { row, monthKey };
  const b = document.getElementById("editTextModalBackdrop");
  if (!b) return;
  document.getElementById("editTextSubtitle").textContent = `${row.company} • ${monthKey} • Notes`;
  document.getElementById("editTextHint").textContent = "Edit notes (multi-line). Ctrl+Enter saves.";
  const ta = document.getElementById("editTextNewValue");
  if (ta) ta.value = row?.[NOTES_FIELD_KEY] ?? "";
  document.getElementById("editTextUpdate").dataset.mode = "notes";
  b.style.display = "flex";
  b.setAttribute("aria-hidden", "false");
  setTimeout(() => ta && ta.focus(), 0);
}
function closeEditTextModal() {
  const b = document.getElementById("editTextModalBackdrop");
  if (!b) return;
  b.style.display = "none";
  b.setAttribute("aria-hidden", "true");
  editTextModalState = null;
  editNotesModalState = null;
  document.getElementById("editTextUpdate").dataset.mode = "";
}

function wireEditModals() {
  const emc = document.getElementById("editMetricClose");
  if (emc) emc.addEventListener("click", closeEditMetricModal);

  const emb = document.getElementById("editMetricModalBackdrop");
  if (emb) emb.addEventListener("click", (e) => {
    if (e.target && e.target.id === "editMetricModalBackdrop") closeEditMetricModal();
  });

  const etc = document.getElementById("editTextClose");
  if (etc) etc.addEventListener("click", closeEditTextModal);

  const etb = document.getElementById("editTextModalBackdrop");
  if (etb) etb.addEventListener("click", (e) => {
    if (e.target && e.target.id === "editTextModalBackdrop") closeEditTextModal();
  });

  const mi = document.getElementById("editMetricNewValue");
  if (mi) mi.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("editMetricUpdate").click();
    }
  });

  const ti = document.getElementById("editTextNewValue");
  if (ti) ti.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.getElementById("editTextUpdate").click();
    }
  });

  const mu = document.getElementById("editMetricUpdate");
  if (mu) mu.addEventListener("click", async () => {
    if (!editModalState) return;
    const btn = mu;
    const raw = (document.getElementById("editMetricNewValue") || {}).value;
    if (raw === "" || raw === null || raw === undefined) return alert("Enter a value.");
    const num = Number(raw);
    if (!Number.isFinite(num)) return alert("Please enter a valid number.");
    const { row, fieldKey } = editModalState;
    const rowId = getRowId(row);
    if (!rowId) return alert("Missing record id.");
    try {
      btn.disabled = true;
      btn.textContent = "Saving...";
      const body = buildPatchBodyForMetric(row, fieldKey, num);
      if (!body) {
        alert("Total is derived. Edit Images or Reels.");
        return;
      }
      await patchRowToBackend(rowId, body);
      closeEditMetricModal();
      await reloadFromXanoAndRefresh();
    } catch (err) {
      alert("Save failed: " + String(err?.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = "Update";
    }
  });

  const tu = document.getElementById("editTextUpdate");
  if (tu) tu.addEventListener("click", async () => {
    const mode = tu.dataset.mode || "";
    const btn = tu;
    const val = (document.getElementById("editTextNewValue") || {}).value;
    const payloadVal = (val === "" ? null : val);
    try {
      btn.disabled = true;
      btn.textContent = "Saving...";
      if (mode === "press") {
        const row = editTextModalState?.row;
        const rowId = getRowId(row);
        if (!rowId) return alert("Missing record id.");
        await patchRowToBackend(rowId, { monthly_press_coverage: payloadVal });
        closeEditTextModal();
        await reloadFromXanoAndRefresh();
        return;
      }
      if (mode === "notes") {
        const row = editNotesModalState?.row;
        const rowId = getRowId(row);
        if (!rowId) return alert("Missing record id.");
        await patchRowToBackend(rowId, { [NOTES_FIELD_KEY]: payloadVal });
        closeEditTextModal();
        await reloadFromXanoAndRefresh();
        return;
      }
    } catch (err) {
      alert("Save failed: " + String(err?.message || err));
    } finally {
      btn.disabled = false;
      btn.textContent = "Update";
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (editModalState) closeEditMetricModal();
    if (editTextModalState || editNotesModalState) closeEditTextModal();
  });
}

/* -------------------------
   Table/chart styling & helpers
   ------------------------- */
function formatUtcTimestamp(dt) {
  const yyyy = dt.getUTCFullYear(),
    mm = String(dt.getUTCMonth() + 1).padStart(2, "0"),
    dd = String(dt.getUTCDate()).padStart(2, "0");
  const hh = String(dt.getUTCHours()).padStart(2, "0"),
    mi = String(dt.getUTCMinutes()).padStart(2, "0"),
    ss = String(dt.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss} UTC`;
}
function setLastUpdatedAtText() {
  const el = document.getElementById("lastUpdatedAt");
  if (!el) return;
  el.textContent = state.lastLoadedAtUtc
    ? `Last updated: ${formatUtcTimestamp(state.lastLoadedAtUtc)}`
    : "";
}
function downloadDataUrl(filename, dataUrl) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
function downloadChartAs(type) {
  const canvas = document.getElementById("metricChart");
  if (!canvas) return alert("Chart not found.");
  const ext = type === "image/jpeg" ? "jpg" : "png";
  const dataUrl = canvas.toDataURL(type, 0.92);
  downloadDataUrl(`chart.${ext}`, dataUrl);
}
function downloadChartPdfViaPrint() {
  const canvas = document.getElementById("metricChart");
  if (!canvas) return alert("Chart not found.");
  const img = canvas.toDataURL("image/png");
  const w = window.open("", "_blank");
  if (!w) return alert("Popup blocked");
  w.document.open();
  w.document.write(
    `<!doctype html><html><head><title>Chart</title><style>body{margin:0;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto;}img{max-width:100%;height:auto}.hint{margin-top:12px;opacity:0.7;font-size:12px}</style></head><body><img src="${img}" /><div class="hint">Use Print (Ctrl+P) and Save as PDF.</div></body></html>`
  );
  w.document.close();
  w.focus();
}
function wireChartDownloadButtons() {
  const png = document.getElementById("downloadChartPng"),
    jpg = document.getElementById("downloadChartJpg"),
    pdf = document.getElementById("downloadChartPdf");
  if (png) png.addEventListener("click", () => downloadChartAs("image/png"));
  if (jpg) jpg.addEventListener("click", () => downloadChartAs("image/jpeg"));
  if (pdf) pdf.addEventListener("click", downloadChartPdfViaPrint);
}

function applyMetricsTableStyling() {
  const root = document.getElementById("metricsDisplay");
  const table = root?.querySelector("table");
  if (!table) return;
  root.querySelectorAll(".clickable-metric").forEach(n => n.style.textDecoration = "none");
  table.querySelectorAll("td").forEach(td => {
    td.style.textAlign = "center";
    td.style.verticalAlign = "middle";
  });
  table.querySelectorAll("tr").forEach(tr => {
    const tds = tr.querySelectorAll("td");
    if (tds[0]) tds[0].style.textAlign = "left";
    if (tds[1]) tds[1].style.textAlign = "left";
  });
  table.querySelectorAll("td").forEach(td => {
    if (td.querySelector(".metrics-rich")) td.style.textAlign = "left";
  });
}

/* -------------------------
   Helper utilities
   ------------------------- */
function uniqueCompanies(rows) {
  const set = new Set(rows.map(r => normalizeCompanyName(r.company)).filter(Boolean));
  return Array.from(set).sort(companySort);
}
function findRowByCompanyAndMonth(companyName, monthKey) {
  return state.rows.find(
    r =>
      String(r.company) === String(companyName) &&
      monthKeyFromYearMonthName(r.year, r.month) === monthKey
  );
}

/* -------------------------
   Refresh / reload
   ------------------------- */
async function reloadFromXanoAndRefresh() {
  try {
    const rawRows = await fetchRowsFromBackend();
    const raw = Array.isArray(rawRows) ? rawRows : (rawRows?.items || rawRows?.data || []);
    state.rows = (Array.isArray(raw) ? raw : []).map(normalizeRow);

    state.latestMonthKey = computeLatestMonthKey(state.rows);
    const { min, max } = computeMinMaxMonthKey(state.rows);
    state.minMonthKey = min;
    state.maxMonthKey = max;
    state.lastLoadedAtUtc = new Date();

    const companies = uniqueCompanies(state.rows);
    if (state.selectedCompanies.size === 0) companies.forEach(c => state.selectedCompanies.add(c));
    else for (const c of Array.from(state.selectedCompanies)) if (!companies.includes(c)) state.selectedCompanies.delete(c);

    renderCompanyToggles(companies);

    if (!state.visibleMonths.length) {
      const defaultKey = state.latestMonthKey;
      state.visibleMonths = defaultKey ? [defaultKey] : [];
      state.rangeStartKey = defaultKey;
      state.rangeEndKey = defaultKey;
    } else if (state.rangeStartKey && state.rangeEndKey) {
      const boundedStart = clampMonthKeyToDataBounds(state.rangeStartKey);
      const boundedEnd = clampMonthKeyToDataBounds(state.rangeEndKey);
      if (boundedStart && boundedEnd) {
        state.rangeStartKey = boundedStart;
        state.rangeEndKey = boundedEnd;
        state.visibleMonths = listMonthKeysBetween(boundedStart, boundedEnd);
      }
    }

    ensureChartMetricOptions(true);
    refresh();
    return;
  } catch (err) {
    console.error("reloadFromXanoAndRefresh error:", err);
    throw err;
  }
}
window.reloadFromXanoAndRefresh = reloadFromXanoAndRefresh;
window.reloadFromZapierAndRefresh = reloadFromXanoAndRefresh;

/* -------------------------
   Company toggles
   ------------------------- */
function renderCompanyToggles(companies) {
  const mount = document.getElementById("companyToggle");
  if (!mount) return;
  mount.innerHTML = "";
  for (const name of companies) {
    const id = `cmp_${name.replace(/\s+/g, "_")}`;
    const checkbox = el("input", { type: "checkbox", id });
    checkbox.checked = state.selectedCompanies.has(name);
    checkbox.addEventListener("change", () => {
      checkbox.checked ? state.selectedCompanies.add(name) : state.selectedCompanies.delete(name);
      refresh();
    });
    mount.appendChild(
      el("div", { className: "toggle" }, [
        checkbox,
        el("label", { for: id, text: name })
      ])
    );
  }

  const allOn = document.getElementById("companiesAllOn");
  const allOff = document.getElementById("companiesAllOff");
  if (allOn) {
    allOn.onclick = () => {
      companies.forEach(c => state.selectedCompanies.add(c));
      renderCompanyToggles(companies);
      refresh();
    };
  }
  if (allOff) {
    allOff.onclick = () => {
      state.selectedCompanies.clear();
      renderCompanyToggles(companies);
      refresh();
    };
  }
}

/* -------------------------
   Multi-month averaging
   ------------------------- */
function averageNumericForCompanyAcrossMonths(companyName, monthKeys, fieldKey) {
  const vals = monthKeys
    .map(mk => findRowByCompanyAndMonth(companyName, mk))
    .map(r => {
      if (!r) return null;
      if (fieldKey === "number_of_monthly_instagram_posts") return extractPostsTotal(r.number_of_monthly_instagram_posts);
      if (fieldKey === "monthly_instagram_engagement") return extractEngagementTotal(r.monthly_instagram_engagement);
      return toNumberOrNull(r[fieldKey]);
    })
    .filter(v => v !== null);
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/* -------------------------
   Quick range helpers & range select helpers
   ------------------------- */
function setQuickThisMonth() {
  const key = currentMonthKeyUTC();
  setVisibleRange(key, key);
}
function setQuickLastMonth() {
  const key = lastMonthKeyUtcYYYYMM();
  if (!key) return;
  setVisibleRange(key, key);
}
function fillMonthSelect(selectEl) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const m of MONTH_LABELS) {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.name;
    selectEl.appendChild(opt);
  }
}
function fillYearSelect(selectEl, minYear, maxYear) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (let y = minYear; y <= maxYear; y++) {
    const opt = document.createElement("option");
    opt.value = String(y);
    opt.textContent = String(y);
    selectEl.appendChild(opt);
  }
}
function setRangeSelectorsFromKeys(startKey, endKey) {
  const s = parseMonthKey(startKey), e = parseMonthKey(endKey);
  if (!s || !e) return;
  const sy = document.getElementById("startYear"),
    sm = document.getElementById("startMonth"),
    ey = document.getElementById("endYear"),
    em = document.getElementById("endMonth");
  if (sy) sy.value = String(s.year);
  if (sm) sm.value = s.month;
  if (ey) ey.value = String(e.year);
  if (em) em.value = e.month;
}

/* -------------------------
   Refresh wrapper
   ------------------------- */
function refresh() {
  const mount = document.getElementById("metricsDisplay");
  if (!mount) return;
  mount.innerHTML = "";

  if (!state.latestMonthKey) {
    mount.appendChild(el("p", { className: "muted", text: "No data found in backend." }));
    destroyChart();
    updateMonthNavButtonsState();
    return;
  }

  const visibleMonths = state.visibleMonths.length ? state.visibleMonths : [state.latestMonthKey];
  const selected = uniqueCompanies(state.rows).filter(c => state.selectedCompanies.has(c));

  const lastUpdatedEl = document.getElementById("lastUpdated");
  if (lastUpdatedEl)
    lastUpdatedEl.textContent = `Loaded from backend. Latest month: ${state.latestMonthKey}. Viewing: ${visibleMonths.join(", ")}.`;

  setLastUpdatedAtText();

  if (!selected.length) {
    mount.appendChild(el("p", { className: "muted", text: "No companies selected." }));
    destroyChart();
    updateMonthNavButtonsState();
    return;
  }

  mount.appendChild(buildMetricsTable(visibleMonths, selected));
  ensureChartMetricOptions(false);
  renderChart();
  applyMetricsTableStyling();
  updateMonthNavButtonsState();
}

/* -------------------------
   Debug overlay
   ------------------------- */
function createDebugUI() {
  if (document.getElementById("appDebugBtn")) return;
  const style = document.createElement("style");
  style.textContent = `
#appDebugBtn { position: fixed; left: 12px; bottom: 12px; z-index: 99999; background:#111; color:#fff; border-radius:8px; padding:8px 10px; font-family:system-ui,-apple-system,Segoe UI,Roboto; cursor:pointer; opacity:0.95; border:none; }
#appDebugPanel { position: fixed; left: 12px; bottom: 56px; width: 420px; max-height: 70vh; overflow:auto; z-index:99999; background:#fff; color:#111; border:1px solid #ddd; border-radius:8px; box-shadow:0 6px 30px rgba(0,0,0,0.12); padding:12px; display:none; font-family: system-ui,-apple-system,Segoe UI,Roboto; font-size:13px; }
#appDebugPanel pre { white-space: pre-wrap; font-size:12px; line-height:1.25; margin:0; }
#appDebugPanel h4 { margin:0 0 6px 0; font-size:14px; }
#appDebugPanel button { margin-left:6px; }
`;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.id = "appDebugBtn";
  btn.textContent = "Debug";
  document.body.appendChild(btn);

  const panel = document.createElement("div");
  panel.id = "appDebugPanel";
  panel.innerHTML = `
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
  <h4>App Debug</h4>
  <div>
    <button id="appDbgRun">Run Checks</button>
    <button id="appDbgClose">Close</button>
  </div>
</div>
<div id="appDbgOut"><pre>Ready. Click "Run Checks".</pre></div>`;
  document.body.appendChild(panel);

  btn.addEventListener("click", () => {
    panel.style.display = panel.style.display === "none" ? "block" : "none";
  });
  document.getElementById("appDbgClose").addEventListener("click", () => {
    panel.style.display = "none";
  });

  async function runChecks() {
    const out = document.getElementById("appDbgOut");
    out.innerHTML = "<pre>Running checks...\n</pre>";
    const log = (s) => { out.innerHTML += s + "\n"; };
    try {
      const names = [
        "init",
        "wireEditModals",
        "fetchRowsFromBackend",
        "patchRowToBackend",
        "fetchEditKeyFromXano",
        "verifyPassword",
        "computeLatestMonthKey",
        "computeMinMaxMonthKey",
        "reloadFromXanoAndRefresh",
        "applyCustomRangeFromSelectors",
        "setLockedUI"
      ];
      for (const n of names) log(`${n}: ${(typeof window[n] === "function") ? "function" : typeof window[n]}`);

      log("\nTrying fetchEditKeyFromXano (6s timeout)...");
      if (typeof fetchEditKeyFromXano === "function") {
        try {
          const val = await Promise.race([
            fetchEditKeyFromXano(),
            new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 6000))
          ]);
          log("EDIT_KEY: " + JSON.stringify(val));
        } catch (e) {
          log("EDIT_KEY error: " + String(e));
        }
      } else log("fetchEditKeyFromXano not present.");

      log("\nTrying fetchRowsFromBackend (8s timeout)...");
      if (typeof fetchRowsFromBackend === "function") {
        try {
          const rows = await Promise.race([
            fetchRowsFromBackend(),
            new Promise((_, r) => setTimeout(() => r(new Error("timeout")), 8000))
          ]);
          log("Rows fetched: " + (Array.isArray(rows) ? rows.length : typeof rows));
          if (Array.isArray(rows) && rows.length)
            log("Sample keys: " + Object.keys(rows[0]).slice(0, 12).join(", "));
          else
            log("Rows preview: " + JSON.stringify(rows).slice(0, 400));
        } catch (e) {
          log("Rows fetch error: " + String(e));
        }
      } else log("fetchRowsFromBackend not present.");

      log("\nDone.");
    } catch (err) {
      out.innerHTML += "\nError running checks: " + String(err);
    }
  }
  document.getElementById("appDbgRun").addEventListener("click", runChecks);
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", createDebugUI);
else
  setTimeout(createDebugUI, 0);

/* -------------------------
   Init / auth
   ------------------------- */
async function attemptUnlock(password) {
  setEditKey(password);
  const ok = await verifyPassword(password);
  if (!ok) return false;
  await reloadFromXanoAndRefresh();
  return true;
}

async function init() {
  try {
    wireEditModals();
    ensureChartMetricOptions(true);
    wireChartDownloadButtons();

    const chartSelect = document.getElementById("chartMetricSelect");
    if (chartSelect) chartSelect.addEventListener("change", renderChart);

    const pwInput = document.getElementById("pagePassword");
    if (pwInput) {
      pwInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const unlockBtn = document.getElementById("unlockBtn");
          if (unlockBtn) unlockBtn.click();
        }
      });
    }

    const applyRangeBtn = document.getElementById("applyRange");
    if (applyRangeBtn) applyRangeBtn.addEventListener("click", applyCustomRangeFromSelectors);

    const prevMonthBtn = document.getElementById("prevMonthBtn");
    if (prevMonthBtn) prevMonthBtn.addEventListener("click", () => shiftVisibleRangeByOneMonth(-1));

    const nextMonthBtn = document.getElementById("nextMonthBtn");
    if (nextMonthBtn) nextMonthBtn.addEventListener("click", () => shiftVisibleRangeByOneMonth(1));

    const quickThis = document.getElementById("quickThisMonth");
    if (quickThis) {
      quickThis.addEventListener("change", (e) => {
        if (e.target.checked) setQuickThisMonth();
      });
    }

    const quickLast = document.getElementById("quickLastMonth");
    if (quickLast) {
      quickLast.addEventListener("change", (e) => {
        if (e.target.checked) setQuickLastMonth();
      });
    }

    const lockBtn = document.getElementById("lockBtn");
    if (lockBtn) {
      lockBtn.addEventListener("click", () => {
        clearEditKey();
        setLockedUI(true);
      });
    }

    const unlockBtn = document.getElementById("unlockBtn");
    if (unlockBtn) {
      unlockBtn.addEventListener("click", async () => {
        const pw = (document.getElementById("pagePassword") || {}).value;
        const errMount = document.getElementById("lockError");
        if (errMount) errMount.textContent = "";
        try {
          const ok = await attemptUnlock(pw);
          if (!ok) throw new Error("Incorrect password.");

          setLockedUI(false);

          if (state.minMonthKey && state.maxMonthKey) {
            const minY = Number(state.minMonthKey.split("-")[0]);
            const maxY = Number(state.maxMonthKey.split("-")[0]);

            fillYearSelect(document.getElementById("startYear"), minY, maxY);
            fillYearSelect(document.getElementById("endYear"), minY, maxY);

            fillMonthSelect(document.getElementById("startMonth"));
            fillMonthSelect(document.getElementById("endMonth"));

            setRangeSelectorsFromKeys(state.rangeStartKey, state.rangeEndKey);
          }
        } catch (err) {
          clearEditKey();
          if (errMount) errMount.textContent = `Unlock failed: ${String(err?.message || err)}`;
        }
      });
    }

    setLockedUI(true);
  } catch (e) {
    console.error("init failed:", e);
    const lockErr = document.getElementById("lockError");
    if (lockErr) lockErr.textContent = String(e?.stack || e);
    throw e;
  }
}

/* -------------------------
   Boot
   ------------------------- */
window.fetchRowsFromBackend = fetchRowsFromBackend;
window.patchRowToBackend = patchRowToBackend;
window.fetchEditKeyFromXano = fetchEditKeyFromXano;
window.verifyPassword = verifyPassword;
window.reloadFromXanoAndRefresh = reloadFromXanoAndRefresh;
window.reloadFromZapierAndRefresh = reloadFromXanoAndRefresh;

window.addEventListener("DOMContentLoaded", () => {
  try { createDebugUI(); } catch (e) { console.warn("createDebugUI failed:", e); }
  init().catch(err => {
    console.error("App init error:", err);
    const lockErr = document.getElementById("lockError");
    if (lockErr) lockErr.textContent = String(err?.stack || err);
  });
});
