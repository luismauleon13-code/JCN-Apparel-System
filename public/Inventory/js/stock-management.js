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

  function sizesOf(product) {
    const sizes = typeof product.sizes === "string" ? JSON.parse(product.sizes) : product.sizes;
    if (!Array.isArray(sizes)) throw Error(`Invalid sizes for ${product.title}.`);
    return sizes;
  }
  async function render() {
    main().innerHTML = '<section class="panel">Loading live stock…</section>';
    try {
      const data = await request(`/products?page=${page}`);
      const rows = data.products.flatMap(product => sizesOf(product).map(size => ({ product, size })));
      main().innerHTML = `<section class="panel"><div class="section-head"><h2>Stock Management</h2><button id="refresh">Refresh</button></div><p>Quantities are tracked per size. Available colors do not have separate stock counts in your current database.</p><input id="search" type="search" aria-label="Search this page" placeholder="Search products on this page…"><div class="table-wrap"><table><thead><tr><th>Product</th><th>Size</th><th>Quantity</th><th>Action</th></tr></thead><tbody id="rows"></tbody></table></div>${pager(data)}</section>`;
      function display(query = "") {
        const matches = rows.map((row, index) => ({ ...row, index })).filter(r => `${r.product.title} ${r.size.size}`.toLowerCase().includes(query.toLowerCase()));
        document.getElementById("rows").innerHTML = matches.map(({ product, size, index }) => `<tr><td>${esc(product.title)}<small>${esc(product.category)}</small></td><td>${esc(size.size)}</td><td>${esc(size.qty)}</td><td><button data-adjust="${index}">Adjust stock</button></td></tr>`).join("") || '<tr><td colspan="4" class="empty">No matching size stock on this page.</td></tr>';
        document.querySelectorAll("[data-adjust]").forEach(b => b.onclick = () => openAdjustment(rows[Number(b.dataset.adjust)]));
      }
      display(); document.getElementById("search").oninput = e => display(e.target.value); bindPager();
    } catch (error) { errorView(error); }
  }
  function openAdjustment({ product, size }) {
    const modal = document.getElementById("modal");
    modal.innerHTML = `<form id="adjust-form"><h2>Adjust stock</h2><p>${esc(product.title)} · ${esc(size.size)} · Current: ${esc(size.qty)}</p><label>Movement<select name="mode"><option value="add">Stock in</option><option value="remove">Stock out</option><option value="set">Physical count</option></select></label><label>Quantity<input name="amount" type="number" min="1" max="1000000" step="1" required></label><label>Reason<textarea name="reason" maxlength="300" required></textarea></label><p id="adjust-error" role="alert"></p><div class="dialog-actions"><button type="button" id="cancel" class="ghost">Cancel</button><button type="submit" id="save">Save to database</button></div></form>`;
    const form = document.getElementById("adjust-form");
    form.elements.mode.onchange = () => { form.elements.amount.min = form.elements.mode.value === "set" ? "0" : "1"; };
    document.getElementById("cancel").onclick = () => modal.close();
    form.onsubmit = async e => {
      e.preventDefault(); const button = document.getElementById("save"); button.disabled = true;
      const fd = new FormData(form);
      try {
        await request(`/products/${encodeURIComponent(product.id)}/adjust`, "POST", {
          size: size.size, mode: fd.get("mode"), amount: Number(fd.get("amount")),
          expected: Number(size.qty), reason: fd.get("reason")
        });
        modal.close(); notify("Stock and history saved to Supabase."); await render();
      } catch (error) { document.getElementById("adjust-error").textContent = error.message; }
      finally { button.disabled = false; }
    };
    modal.showModal();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();
