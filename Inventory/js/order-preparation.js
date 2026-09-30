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
    } catch { throw Error("Cannot reach the server. Start Node.js on port 5000 and check your connection."); }
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
    return `<div class="toolbar" style="margin-top:20px"><button id="previous" class="ghost" ${page <= 1 ? "disabled" : ""}>Previous</button><span>Page ${page} · ${data.total} records</span><button id="next" class="ghost" ${page * data.limit >= data.total ? "disabled" : ""}>Next</button></div>`;
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
    main().innerHTML = '<section class="panel">Loading customer orders…</section>';
    try {
      const data = await request(`/orders?page=${page}`);
      main().innerHTML = `<section class="panel"><div class="section-head"><h2>Order Preparation</h2><button id="refresh">Refresh</button></div><p>Check the ordered items before marking ready. Preparation does not deduct stock or change courier status. Unsubmitted checklists reset on refresh.</p><div id="orders"></div>${pager(data)}</section>`;
      document.getElementById("orders").innerHTML = data.orders.map((o, index) => {
        const items = Array.isArray(o.inventory_items) ? o.inventory_items : [];
        const eligible = o.payment_method === "COD" || (o.payment_method === "PayPal" && o.payment_status === "Paid");
        return `<article class="order" data-index="${index}"><div class="section-head"><h3>Order ${esc(o.id)}</h3><span class="badge">${esc(o.inventory_preparation)}</span></div><p>${esc(o.customer_name)} · ${esc(o.payment_method)} / ${esc(o.payment_status)}</p>${!eligible ? '<p class="negative">Payment confirmation required.</p>' : ''}${items.length ? items.map((item,i) => `<label class="check"><input type="checkbox" value="${i}" ${o.inventory_preparation !== "Preparing" || !eligible ? "disabled" : ""}><span>${esc(item.title || item.name || item.product_name || `Product ${item.product_id || item.id || ""}`)}<small style="display:block">${esc(item.size)} / ${esc(item.color)} · ${esc(item.quantity ?? item.qty ?? 1)} unit(s)</small></span></label>`).join("") : '<p class="negative">This older order has no saved item details. Preparation is blocked until its items are recovered from verified records.</p>'}<footer>${eligible && items.length && ["Queued","Preparing"].includes(o.inventory_preparation) ? `<button data-action="${o.inventory_preparation === "Queued" ? "start" : "ready"}" ${o.inventory_preparation === "Preparing" ? "disabled" : ""}>${o.inventory_preparation === "Queued" ? "Start preparation" : "Mark ready to ship"}</button>` : ''}</footer></article>`;
      }).join("") || '<p class="empty">No orders awaiting dispatch.</p>';
      document.querySelectorAll(".order").forEach(card => {
        const order = data.orders[Number(card.dataset.index)], button = card.querySelector("[data-action]");
        if (!button) return;
        card.querySelectorAll("input").forEach(el => el.onchange = () => { button.disabled = [...card.querySelectorAll("input")].some(x => !x.checked); });
        button.onclick = async () => {
          button.disabled = true;
          try {
            await request(`/orders/${encodeURIComponent(order.id)}/preparation`, "PATCH", {
              action: button.dataset.action, revision: order.inventory_revision,
              checked: [...card.querySelectorAll("input:checked")].map(x => Number(x.value))
            });
            notify("Preparation saved to Supabase."); await render();
          } catch (error) { notify(error.message); button.disabled = false; }
        };
      }); bindPager();
    } catch (error) { errorView(error); }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
