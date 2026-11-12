"use strict";
(() => {
  const API = "http://localhost:5000/api/inventory";
  const LOGIN = "../../staff/html/staff-login.html";
  const main = () => document.getElementById("main");
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
  let page = 1;
  function notify(message) {
    const el = document.getElementById("notice") || document.getElementById("notification");
    if (el) el.textContent = message;
  }
  function session() {
    try {
      const user = JSON.parse(localStorage.getItem("staffUser") || "null");
      if (!localStorage.getItem("staffToken") || !user ||
          !["inventory_staff", "admin"].includes(user.role)) throw Error("Login required");
      return user;
    } catch { location.replace(LOGIN); return null; }
  }
  async function request(path, method = "GET", body) {
    let response;
    try {
      response = await fetch(API + path, {
        method, cache: "no-store",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("staffToken") || ""}`,
          ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });

    } 
    catch { throw Error("Cannot reach the server. Start Node.js on port 5000 and check your connection."); }

    if (response.status === 401) {
      localStorage.removeItem("staffToken"); localStorage.removeItem("staffUser");
      location.replace(LOGIN); throw Error("Session expired. Please log in again.");
    }

    let data;
    try { data = await response.json(); }
    
    catch { throw Error("The inventory API did not return JSON. Check that the new backend route is installed."); }

    if (!response.ok || data.success === false) throw Error(data.message || "Request failed.");
   
    return data;
  }

  function pager(data) {

    return `<div class="toolbar" style="margin-top:20px"><button id="previous" class="ghost" ${page <= 1 ? "disabled" : ""
    }>Previous</button><span>Page ${page} · ${data.total}
     records</span><button id="next" class="ghost" ${page * data.limit >= data.total ? "disabled" : ""
     }>Next</button></div>`;
  }

  function bindPager() {
    document.getElementById("previous").onclick = () => { page--; render(); };
    document.getElementById("next").onclick = () => { page++; render(); };
    document.getElementById("refresh").onclick = () => render();
  }

  function errorView(error) {
    main().innerHTML = `<section class="panel"><h2>Unable to load data</h2><p>${esc(error.message)}</p><button id="retry">Retry</button></section>`;

    document.getElementById("retry").onclick = () => render();
  }

  function init() {
    const user = session(); if (!user || !main()) return;
    const badge = document.querySelector(".topbar .staff");
    if (badge) badge.textContent = user.full_name || user.username || "Inventory Staff";
    document.querySelectorAll("nav a").forEach(a => {
      a.classList.toggle("active", a.getAttribute("href") === document.body.dataset.page + ".html");
    });
    render();
  }

  async function render() {
    main().innerHTML = '<section class="panel">Loading stock history…</section>';
    try {
      const data = await request(`/history?page=${page}`);
      main().innerHTML =

       `<section class="panel">
       <div class="section-head"><h2>Stock History</h2>
       <button id="refresh">Refresh</button>
       </div><p>Permanent records from changes made after the SQL migration. Existing routes without a staff identity are labelled as unattributed.
       </p>
       <div class="toolbar">
       <input type="search" id="search" placeholder="Search this page…" aria-label="Search this history page">
       <button id="export">Export displayed rows</button>
       </div>
       
       <div class="table-wrap">
       <table><thead><tr><th>Date / Staff</th><th>Product / Size</th><th>Change
       </th>
       <th>Before → After</th>
       <th>Reason</th>
       </tr></thead>
       <tbody id="rows">
       </tbody></table>
       </div>
       
       ${pager(data)}</section>`;

      let visible = data.history;
      function display(query = "") {
        visible = data.history.filter(h => `${h.product} ${h.size} ${h.reason} ${h.actor}`.toLowerCase().includes(query.toLowerCase()));
        document.getElementById("rows")
        .innerHTML = visible.map(h => `<tr><td>${esc(new Date(h.created_at).toLocaleString("en-PH"))}
        
          <small>${esc(h.actor)}</small></td><td>${esc(h.product)}
          <small>${esc(h.size)}
          </small>
          </td>
          <td class="${h.change_qty > 0 ? "positive" : "negative"}">
          ${h.change_qty > 0 ? "+" : ""}${esc(h.change_qty)} </td>
          <td>${esc(h.before_qty)} → ${esc(h.after_qty)}</td>
          <td>${esc(h.reason)}</td></tr>`).join("") || '<tr><td colspan="5" class="empty">No stock movements on this page.</td></tr>';

        document.getElementById("export").disabled = visible.length === 0;
      }

      display(); document.getElementById("search").oninput = e => display(e.target.value);
      document.getElementById("export").onclick = () => {

        const rows = [["Date","Product","Size","Before","Change","After","Reason","Staff"], ...visible.map(h => [h.created_at,h.product,h.size,h.before_qty,h.change_qty,h.after_qty,h.reason,h.actor])];
        const csv = rows.map(row => row.map(v => { let s = String(v ?? ""); if (typeof v !== "number" && /^\s*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g,'""') + '"'; }).join(",")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\ufeff",csv], { type:"text/csv;charset=utf-8" }));
        const a = document.createElement("a"); a.href = url; a.download = `stock-history-page-${page}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
      }; bindPager();
    } catch (error) { errorView(error); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
