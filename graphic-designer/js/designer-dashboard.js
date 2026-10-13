
"use strict";

const API = "http://localhost:5000/api/graphic-designer";

const $ = id => document.getElementById(id);

let page = 1;
let limit = 15;
let total = 0;
let rows = [];
let current = null;

/* ==========================================
   HTML ESCAPE
========================================== */

function html(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

/* ==========================================
   API REQUEST
========================================== */

async function fetchAPI(path, options = {}) {
  const token = localStorage.getItem("staffToken");

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });

  let body;

  try {
    body = await response.json();
  } catch {
    throw new Error(
      `Invalid server response (${response.status})`
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "Access denied. Log in with a Graphic Designer or Admin account."
    );
  }

  if (!response.ok || !body.success) {
    throw new Error(body.message || "Request failed");
  }

  return body;
}

/* ==========================================
   NOTIFICATION
========================================== */

function notify(message, target = "message") {
  const element = $(target);

  if (element) {
    element.textContent = message;
  }
}

/* ==========================================
   STAFF AUTHENTICATION
========================================== */


function auth() {
  const token = localStorage.getItem("staffToken");

  let user = {};

  try {
    user = JSON.parse(
      localStorage.getItem("staffUser") || "{}"
    );
  } catch (error) {
    console.error("Invalid staff session:", error);
  }

  const role = String(user.role || "")
    .trim()
    .toLowerCase();

  console.log("Graphic Designer Authentication");
  console.log("Has staff token:", Boolean(token));
  console.log("Staff role:", role);

  if (!token || role !== "graphic_designer") {
    console.warn("Graphic Designer access denied.");

    window.location.replace(
      "../../staff/html/staff-login.html"
    );

    return false;
  }

  const staffName = document.getElementById("staffName");

  if (staffName) {
    staffName.textContent =
      user.full_name ||
      user.username ||
      "Graphic Designer";
  }

  return true;
}


/* ==========================================
   LOAD DESIGN REQUESTS
========================================== */

async function load() {
  notify("Loading requests...");

  try {
    const status = $("statusFilter").value;

    const query =
      `/requests?page=${page}` +
      (status
        ? `&status=${encodeURIComponent(status)}`
        : "");

    const result = await fetchAPI(query);

    rows = result.requests || [];
    total = Number(result.total || 0);
    limit = Number(result.limit || 15);

    $("totalCount").textContent = total;

    $("reviewCount").textContent = rows.filter(
      row => row.status === "In Review"
    ).length;

    $("finalCount").textContent = rows.filter(
      row => row.status === "Finalized"
    ).length;

    render();
    notify("");

  } catch (error) {
    console.error("LOAD REQUESTS ERROR:", error);

    notify(error.message);

    $("requestsBody").innerHTML = `
      <tr>
        <td colspan="6">
          Unable to load design requests.
        </td>
      </tr>
    `;
  }
}

/* ==========================================
   RENDER DESIGN REQUESTS
========================================== */

function render() {
  const search = $("searchInput").value
    .toLowerCase()
    .trim();

  const filtered = rows.filter(row =>
    [
      row.id,
      row.customer_name,
      row.apparel_type,
      row.apparel_color
    ].some(value =>
      String(value || "")
        .toLowerCase()
        .includes(search)
    )
  );

  $("requestsBody").innerHTML = filtered.length
    ? filtered.map(row => `
      <tr>
        <td>${html(String(row.id).slice(0, 8))}</td>

        <td>${html(row.customer_name)}</td>

        <td>
          ${html(row.apparel_type)}
          /
          ${html(row.apparel_color)}
        </td>

        <td>
          <span class="pill">
            ${html(row.status)}
          </span>
        </td>

        <td>
          ${row.created_at
            ? new Date(row.created_at)
                .toLocaleString("en-PH")
            : "—"}
        </td>

        <td>
          <button
            type="button"
            class="review"
            data-id="${html(row.id)}"
          >
            Review
          </button>
        </td>
      </tr>
    `).join("")
    : `
      <tr>
        <td colspan="6">
          No requests found.
        </td>
      </tr>
    `;

  const pages = Math.max(
    1,
    Math.ceil(total / limit)
  );

  $("pageLabel").textContent =
    `Page ${page} of ${pages}`;

  $("prevBtn").disabled = page <= 1;
  $("nextBtn").disabled = page * limit >= total;
}

/* ==========================================
   REQUEST INFORMATION
========================================== */

function info(label, value) {
  return `
    <div>
      <dt>${html(label)}</dt>
      <dd>${html(value || "—")}</dd>
    </div>
  `;
}

/* ==========================================
   OPEN DESIGN REVIEW
========================================== */

async function openEditor(id) {
  notify("Loading design...");

  try {
    const response = await fetchAPI(
      `/requests/${encodeURIComponent(id)}`
    );

    current = response.request;

    $("requestTitle").textContent =
      `Request ${current.id.slice(0, 8)}`;

    $("requestInfo").innerHTML = [
      info("Customer", current.customer_name),
      info("Apparel", current.apparel_type),
      info("Color", current.apparel_color),
      info("Size", current.apparel_size),
      info("Status", current.status),
      info("Assigned to", current.assigned_designer)
    ].join("");

    $("customerNotes").value =
      current.design_notes || "";

    $("designerNotes").value =
      current.designer_notes || "";

    $("editorStatus").value = current.status;

    $("designText").value =
      current.design_data?.text ??
      current.design_text ??
      "";

    $("fontSize").value =
      current.design_data?.fontSize ?? 28;

    $("posX").value =
      current.design_data?.x ?? 50;

    $("posY").value =
      current.design_data?.y ?? 48;

    $("textColor").value =
      /^#[0-9a-f]{6}$/i.test(
        current.design_data?.textColor
      )
        ? current.design_data.textColor
        : "#ffffff";

    $("apparelColor").value =
      /^#[0-9a-f]{6}$/i.test(
        current.design_data?.apparelHex
      )
        ? current.design_data.apparelHex
        : guessColor(current.apparel_color);

    const links = [
      ["logoLink", current.logo_url],
      ["customerPreview", current.customer_preview_url],
      ["savedPreview", current.designer_preview_url]
    ];

    for (const [element, url] of links) {
      const anchor = $(element);

      anchor.hidden = !url;

      if (url) {
        anchor.href = url;
      } else {
        anchor.removeAttribute("href");
      }
    }

    const finalized = current.status === "Finalized";

    [
      "savePreviewBtn",
      "saveRequestBtn",
      "editorStatus",
      "designerNotes",
      "designText",
      "fontSize",
      "posX",
      "posY",
      "textColor",
      "apparelColor"
    ].forEach(elementId => {
      $(elementId).disabled = finalized;
    });

    draw();

    notify("", "editorMessage");
    $("editorDialog").showModal();
    notify("");

  } catch (error) {
    console.error("OPEN DESIGN ERROR:", error);
    notify(error.message);
  }
}

/* ==========================================
   APPAREL COLOR
========================================== */

function guessColor(name) {
  const palette = {
    black: "#242424",
    white: "#e8e8e8",
    red: "#aa2525",
    blue: "#223a7c",
    navy: "#182641",
    pink: "#e1a0b4",
    gray: "#777777",
    grey: "#777777",
    green: "#376447",
    maroon: "#632936",
    yellow: "#d1b52b"
  };

  return palette[
    String(name || "").toLowerCase()
  ] || "#303030";
}

/* ==========================================
   DRAW APPAREL PREVIEW
========================================== */

function draw() {
  const canvas = $("designCanvas");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, 520, 540);

  ctx.fillStyle = "#e5e1da";
  ctx.fillRect(0, 0, 520, 540);

  ctx.fillStyle = $("apparelColor").value;

  ctx.beginPath();

  ctx.moveTo(174, 65);
  ctx.lineTo(134, 90);
  ctx.lineTo(52, 155);
  ctx.lineTo(104, 233);
  ctx.lineTo(154, 200);
  ctx.lineTo(154, 467);
  ctx.lineTo(367, 467);
  ctx.lineTo(367, 200);
  ctx.lineTo(416, 233);
  ctx.lineTo(468, 155);
  ctx.lineTo(386, 90);
  ctx.lineTo(346, 65);

  ctx.quadraticCurveTo(260, 120, 174, 65);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#7778";
  ctx.lineWidth = 3;
  ctx.stroke();

  const fontSize = Math.min(
    70,
    Math.max(12, Number($("fontSize").value) || 28)
  );

  const x = Number($("posX").value);
  const y = Number($("posY").value);

  ctx.fillStyle = $("textColor").value;
  ctx.font = `bold ${fontSize}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const text =
    $("designText").value || "YOUR DESIGN";

  ctx.fillText(
    text.slice(0, 100),
    155 + x / 100 * 212,
    110 + y / 100 * 340,
    206
  );

  ctx.fillStyle = "#393939";
  ctx.font = "14px Arial";

  ctx.fillText(
    "JCN designer layout preview",
    260,
    510
  );
}

/* ==========================================
   COLLECT DESIGN DATA
========================================== */

function designData() {
  return {
    ...(current.design_data || {}),
    text: $("designText").value,
    fontSize: Number($("fontSize").value),
    x: Number($("posX").value),
    y: Number($("posY").value),
    textColor: $("textColor").value,
    apparelHex: $("apparelColor").value
  };
}

/* ==========================================
   UPLOAD FINAL PREVIEW
========================================== */

async function savePreview() {
  if (!current || current.status === "Finalized") {
    return;
  }

  $("savePreviewBtn").disabled = true;

  notify(
    "Uploading private preview...",
    "editorMessage"
  );

  try {
    const image_data = $("designCanvas")
      .toDataURL("image/png");

    const result = await fetchAPI(
      `/requests/${current.id}/preview`,
      {
        method: "POST",
        body: JSON.stringify({ image_data })
      }
    );

    current = result.request;

    $("savedPreview").hidden =
      !current.designer_preview_url;

    if (current.designer_preview_url) {
      $("savedPreview").href =
        current.designer_preview_url;
    }

    notify(
      "Preview uploaded. Save review next.",
      "editorMessage"
    );

  } catch (error) {
    console.error("PREVIEW ERROR:", error);

    notify(error.message, "editorMessage");

  } finally {
    $("savePreviewBtn").disabled = false;
  }
}

/* ==========================================
   SAVE / FINALIZE DESIGN
========================================== */

async function saveReview() {
  if (!current || current.status === "Finalized") {
    return;
  }

  const status = $("editorStatus").value;

  if (
    status === "Finalized" &&
    !current.designer_preview_path
  ) {
    notify(
      "Upload a preview before finalizing.",
      "editorMessage"
    );
    return;
  }

  $("saveRequestBtn").disabled = true;

  notify("Saving design review...", "editorMessage");

  try {
    const body = {
      status,
      revision: current.revision,
      designer_notes: $("designerNotes").value,
      design_data: designData()
    };

    const result = await fetchAPI(
      `/requests/${current.id}`,
      {
        method: "PATCH",
        body: JSON.stringify(body)
      }
    );

    current = result.request;

    notify(
      "Design review saved successfully.",
      "editorMessage"
    );

    $("editorDialog").close();

    await load();

  } catch (error) {
    console.error("SAVE REVIEW ERROR:", error);

    notify(error.message, "editorMessage");

  } finally {
    $("saveRequestBtn").disabled = false;
  }
}

/* ==========================================
   LOGOUT
========================================== */

function logout() {
  localStorage.removeItem("staffToken");
  localStorage.removeItem("staffUser");

  location.replace(
    "../../staff/html/staff-login.html"
  );
}

/* ==========================================
   PAGE INITIALIZATION
========================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {
    if (!auth()) return;

    $("refreshBtn").addEventListener(
      "click",
      load
    );

    $("searchInput").addEventListener(
      "input",
      render
    );

    $("statusFilter").addEventListener(
      "change",
      () => {
        page = 1;
        load();
      }
    );

    $("prevBtn").addEventListener(
      "click",
      () => {
        if (page > 1) {
          page--;
          load();
        }
      }
    );

    $("nextBtn").addEventListener(
      "click",
      () => {
        if (page * limit < total) {
          page++;
          load();
        }
      }
    );

    $("requestsBody").addEventListener(
      "click",
      event => {
        const button = event.target.closest(
          "button[data-id]"
        );

        if (button) {
          openEditor(button.dataset.id);
        }
      }
    );

    $("closeDialog").addEventListener(
      "click",
      () => {
        $("editorDialog").close();
      }
    );

    [
      "designText",
      "fontSize",
      "posX",
      "posY",
      "textColor",
      "apparelColor"
    ].forEach(id => {
      $(id).addEventListener("input", draw);
    });

    $("savePreviewBtn").addEventListener(
      "click",
      savePreview
    );

    $("saveRequestBtn").addEventListener(
      "click",
      saveReview
    );

    $("logoutBtn").addEventListener(
      "click",
      logout
    );

    load();
  }
);
