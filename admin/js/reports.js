"use strict";

(() => {
  const REPORTS_API = "http://localhost:5000/api/admin/reports";

  let reportOrders = [];
  let reportLoaded = false;

  const $ = id => document.getElementById(id);

  function peso(value) {
    return `₱${Number(value || 0).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function setText(id, value) {
    const element = $(id);
    if (element) element.textContent = value;
  }

  function displayDate(value, includeTime = false) {
    if (!value) return "N/A";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "N/A";

    const options = { timeZone: "Asia/Manila" };

    return includeTime
      ? date.toLocaleString("en-PH", options)
      : date.toLocaleDateString("en-PH", options);
  }

  function tableMessage(message) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;
    cell.className = "empty";
    cell.textContent = message;

    row.append(cell);
    $("reportTable").replaceChildren(row);
  }

  function renderReportTable() {
    if (!reportOrders.length) {
      tableMessage("No report data found.");
      return;
    }

    const fragment = document.createDocumentFragment();

    reportOrders.slice(0, 10).forEach(order => {
      const row = document.createElement("tr");

      const values = [
        `#${String(order.id || "").slice(0, 8)}`,
        "Order Report",
        displayDate(order.created_at),
        peso(order.total_amount)
      ];

      values.forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      });

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");

      badge.className = "status-badge";
      badge.textContent = order.status || "N/A";

      statusCell.append(badge);
      row.append(statusCell);
      fragment.append(row);
    });

    $("reportTable").replaceChildren(fragment);
  }

  function renderMonthlySalesChart() {
    const chart = $("monthlySalesChart");
    if (!chart) return;

    const monthlySales = Array(12).fill(0);

    const months = [
      "Jan", "Feb", "Mar", "Apr",
      "May", "Jun", "Jul", "Aug",
      "Sep", "Oct", "Nov", "Dec"
    ];

    // Preserves the original grouping: all returned years combined.
    const monthFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      month: "numeric"
    });

    reportOrders.forEach(order => {
      if (order.status !== "Completed" || !order.created_at) return;

      const date = new Date(order.created_at);
      const amount = Number(order.total_amount || 0);

      if (
        Number.isNaN(date.getTime()) ||
        !Number.isFinite(amount)
      ) {
        return;
      }

      const monthIndex = Number(monthFormatter.format(date)) - 1;
      monthlySales[monthIndex] += amount;
    });

    const maxSales = Math.max(...monthlySales, 1);
    const fragment = document.createDocumentFragment();

    months.forEach((month, index) => {
      const bar = document.createElement("div");
      const value = document.createElement("small");
      const label = document.createElement("span");

      bar.className = "bar";
      bar.style.height = `${(monthlySales[index] / maxSales) * 100}%`;
      bar.title = `${month}: ${peso(monthlySales[index])}`;
      bar.setAttribute("role", "img");
      bar.setAttribute("aria-label", bar.title);

      value.className = "bar-value";
      value.textContent = peso(monthlySales[index]);

      label.textContent = month;

      bar.append(value, label);
      fragment.append(bar);
    });

    chart.replaceChildren(fragment);
  }

  async function loadReports() {
    if (!$("reportTable")) return;

    reportLoaded = false;
    reportOrders = [];

    const exportButton = $("exportReportBtn");
    if (exportButton) exportButton.disabled = true;

    tableMessage("Loading report data…");

    try {
      const token = localStorage.getItem("adminToken");

      const response = await fetch(REPORTS_API, {
        cache: "no-store",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {}
      });

      if (response.status === 401) {
        localStorage.removeItem("adminToken");
        localStorage.removeItem("adminUser");
        localStorage.removeItem("admin");
        window.location.replace("admin-login.html");
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Cannot load reports.");
      }

      if (!Array.isArray(data.orders)) {
        throw new Error("The server did not return a valid order list.");
      }

      reportOrders = data.orders;

      setText("reportTotalSales", peso(data.totalSales));
      setText("reportTotalOrders", data.totalOrders ?? 0);
      setText("reportTotalUsers", data.totalUsers ?? 0);
      setText("reportDelivered", data.delivered ?? 0);

      setText("statusPreparing", data.statusCounts?.Preparing ?? 0);
      setText(
        "statusToDeliver",
        data.statusCounts?.["To Deliver"] ?? 0
      );
      setText("statusCompleted", data.statusCounts?.Completed ?? 0);
      setText("statusCancelled", data.statusCounts?.Cancelled ?? 0);

      renderReportTable();
      renderMonthlySalesChart();

      reportLoaded = true;
    } catch (error) {
      console.error("Reports loading error:", error);

      tableMessage(
        `${error.message || "Cannot load reports."} Check the server and refresh this page.`
      );
    } finally {
      if (exportButton) {
        exportButton.disabled =
          !reportLoaded || reportOrders.length === 0;
      }
    }
  }

  function exportReport() {
    if (!reportLoaded || !reportOrders.length) {
      alert("No report data to export.");
      return;
    }

    if (!window.jspdf?.jsPDF) {
      alert("PDF library not loaded. Check the jsPDF script.");
      return;
    }

    const button = $("exportReportBtn");
    if (button) button.disabled = true;

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("landscape");

      if (typeof doc.autoTable !== "function") {
        throw new Error(
          "PDF table library not loaded. Check the jsPDF AutoTable script."
        );
      }

      const totalSales = reportOrders
        .filter(order => order.status === "Completed")
        .reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0
        );

      doc.setFontSize(18);
      doc.text("JCN Apparel Full Report", 14, 15);

      doc.setFontSize(10);

      doc.text(
        `Generated: ${displayDate(new Date(), true)} PHT`,
        14,
        23
      );

      doc.text(
        `Completed Order Sales: PHP ${totalSales.toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`,
        14,
        31
      );

      doc.text(
        `Orders included: ${reportOrders.length}`,
        14,
        38
      );

      const rows = reportOrders.map(order => [
        String(order.id || "").slice(0, 8),
        order.customer_name || "Unknown",
        order.customer_email || "",
        order.customer_phone || "",
        `PHP ${Number(order.total_amount || 0).toLocaleString("en-PH", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        })}`,
        order.payment_method || "",
        order.payment_status || "",
        order.status || "",
        order.tracking_number || "",
        displayDate(order.created_at, true)
      ]);

      doc.autoTable({
        startY: 46,
        head: [[
          "Order ID",
          "Customer",
          "Email",
          "Phone",
          "Amount",
          "Method",
          "Payment",
          "Status",
          "Tracking",
          "Date (PHT)"
        ]],
        body: rows,
        styles: {
          fontSize: 8,
          overflow: "linebreak"
        },
        headStyles: {
          fillColor: [214, 165, 29],
          textColor: [0, 0, 0]
        },
        margin: {
          left: 14,
          right: 14
        }
      });

      doc.save("jcn-full-report.pdf");
    } catch (error) {
      console.error("PDF export error:", error);
      alert(error.message || "Unable to export the report.");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function init() {
    if (!$("reportTable")) return;

    $("exportReportBtn")?.addEventListener("click", exportReport);
    loadReports();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();