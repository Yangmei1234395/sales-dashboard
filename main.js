import "./style.css";

/* ------------------------------------------------------------------
 * DATA LOADING
 * All data access lives in loadData(). It reads the outlet_weekly table
 * from Supabase over its REST API and resolves to rows shaped like:
 *   { outlet: "Jurong", week: "2026-09-07", sales: 14200,
 *     target: 15000, orders: 488, returns: 11 }
 *
 * The URL and publishable key come from environment variables
 * (VITE_SUPABASE_URL, VITE_SUPABASE_KEY), set in .env locally and in
 * the Vercel project settings for deployments. The publishable key is
 * safe in the browser: the table has row level security and only
 * allows reads.
 * ------------------------------------------------------------------ */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const SUPABASE_TABLE = "outlet_weekly";

async function loadData() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Supabase settings are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_KEY.");
  }
  const url = `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}` +
    "?select=outlet,week,sales,target,orders,returns&order=week.asc,outlet.asc";
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Supabase returned ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.map(normalizeRow);
}

function normalizeRow(r) {
  return {
    outlet: String(r.outlet),
    week: String(r.week).slice(0, 10),
    sales: Number(r.sales),
    target: Number(r.target),
    orders: Number(r.orders),
    returns: Number(r.returns),
  };
}

/* ------------------------------------------------------------------
 * RENDERING
 * ------------------------------------------------------------------ */
const THRESHOLD = 0.9;
// Filter buttons come from the outlets present in the data.
let OUTLETS = ["All"];
const state = { rows: [], outlet: "All", error: null };

const fmtMoney = n => "$" + Math.round(n).toLocaleString("en-SG");
const fmtInt = n => Math.round(n).toLocaleString("en-SG");
const fmtPct = (n, d = 1) => (n * 100).toFixed(d) + "%";
const fmtWeek = iso => new Date(iso + "T00:00:00").toLocaleDateString("en-SG", { day: "numeric", month: "short" });
const $ = id => document.getElementById(id);

function buildFilter() {
  OUTLETS = ["All", ...[...new Set(state.rows.map(r => r.outlet))].sort()];
  if (!OUTLETS.includes(state.outlet)) state.outlet = "All";
  $("filter").innerHTML = OUTLETS.map(o =>
    `<button type="button" data-outlet="${o}" aria-pressed="${o === state.outlet}">${o}</button>`
  ).join("");
  $("filter").addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    state.outlet = b.dataset.outlet;
    render();
  });
}

function render() {
  if (state.error) return;
  document.querySelectorAll("#filter button").forEach(b =>
    b.setAttribute("aria-pressed", b.dataset.outlet === state.outlet));

  const rows = state.rows
    .filter(r => state.outlet === "All" || r.outlet === state.outlet)
    .map(r => ({ ...r, attain: r.target ? r.sales / r.target : 0 }));

  // Header range
  const weeks = [...new Set(rows.map(r => r.week))].sort();
  $("range").textContent = weeks.length
    ? `Weeks of ${fmtWeek(weeks[0])} to ${fmtWeek(weeks[weeks.length - 1])} · ${state.outlet === "All" ? "All outlets" : state.outlet}`
    : "No data";

  // KPIs
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  const sales = sum("sales"), target = sum("target"), orders = sum("orders"), returns = sum("returns");
  const attain = target ? sales / target : 0;
  $("k-sales").textContent = fmtMoney(sales);
  $("k-sales-n").textContent = `Target ${fmtMoney(target)}`;
  $("k-pct").textContent = fmtPct(attain);
  $("k-pct").style.color = attain < THRESHOLD ? "var(--bad)" : "";
  $("k-pct-n").textContent = `${sales >= target ? "+" : "−"}${fmtMoney(Math.abs(sales - target))} vs target`;
  $("k-orders").textContent = fmtInt(orders);
  $("k-orders-n").textContent = `Avg ${fmtMoney(orders ? sales / orders : 0)} per order`;
  $("k-ret").textContent = fmtPct(orders ? returns / orders : 0, 2);
  $("k-ret-n").textContent = `${fmtInt(returns)} returns of ${fmtInt(orders)} orders`;

  // Bars: scale so 100% target line and the best week both fit
  const max = Math.max(1.1, ...rows.map(r => r.attain)) * 1.02;
  const pos = v => (v / max * 100).toFixed(2) + "%";
  const sorted = [...rows].sort((a, b) =>
    OUTLETS.indexOf(a.outlet) - OUTLETS.indexOf(b.outlet) || a.week.localeCompare(b.week));
  $("chart").innerHTML = sorted.map(r => {
    const low = r.attain < THRESHOLD;
    return `<div class="row" title="${r.outlet}, week of ${fmtWeek(r.week)}: ${fmtMoney(r.sales)} of ${fmtMoney(r.target)}">
      <div class="name">${r.outlet}<small>${fmtWeek(r.week)}</small></div>
      <div class="track">
        <div class="fill${low ? " low" : ""}" style="width:${pos(r.attain)}"></div>
        <div class="tick" style="left:${pos(THRESHOLD)}"></div>
        <div class="tick target" style="left:${pos(1)}"></div>
      </div>
      <div class="pct${low ? " low" : ""}">${fmtPct(r.attain)}</div>
    </div>`;
  }).join("") || `<div class="empty">No rows.</div>`;

  // Needs attention
  const attn = rows.filter(r => r.attain < THRESHOLD).sort((a, b) => a.attain - b.attain);
  $("attn-count").textContent = attn.length;
  $("attn").innerHTML = attn.length
    ? attn.map(r => `<li>
        <div><div class="who">${r.outlet}</div><div class="meta">Week of ${fmtWeek(r.week)} · ${fmtMoney(r.sales)} of ${fmtMoney(r.target)}</div></div>
        <div class="gap"><b>${fmtPct(r.attain)}</b><div class="meta">−${fmtMoney(r.target - r.sales)}</div></div>
      </li>`).join("")
    : `<li class="empty">Every outlet-week is at or above 90% of target.</li>`;
}

(async function init() {
  try {
    state.rows = await loadData();
    buildFilter();
    render();
  } catch (err) {
    console.error(err);
    state.error = err;
    $("range").innerHTML = "";
    const msg = document.createElement("span");
    msg.className = "error";
    msg.textContent = `Could not load data: ${err.message}`;
    $("range").append(msg);
  }
})();
