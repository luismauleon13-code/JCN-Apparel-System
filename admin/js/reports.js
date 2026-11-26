
/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN - BUSINESS REPORTS VERSION 16

   PER DAY / THIS WEEK / THIS MONTH
   DAILY REPORT DATE SELECTION
   PROFESSIONAL PDF EXPORT
   REPORT HISTORY & UNIFIED LOGOUT
========================================================== */

(() => {

  // ========================================================
  // 01. API CONFIGURATION
  // ========================================================

  const REPORTS_API = "/api/admin/reports";
  const LOGIN_PAGE = "admin-login.html";

  const REPORT_TIMEZONE = "Asia/Manila";
  const TODAY_REPORT_LIMIT = 3;

  const $ = id => document.getElementById(id);

  let reportOrders = [];
  let reportLoaded = false;
  let reportLoading = false;
  let exporting = false;
  let initialized = false;

  // ========================================================
  // 02. ADMIN SESSION
  // ========================================================

  function clearAdminSession() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");
  }

  function redirectToLogin() {
    clearAdminSession();
    window.location.replace(LOGIN_PAGE);
  }

  function checkAdminSession() {
    if (!localStorage.getItem("adminToken")) {
      redirectToLogin();
      return false;
    }

    return true;
  }

  // ========================================================
  // 03. CURRENCY FORMATTERS
  // ========================================================

  function peso(value) {
    const amount = Number(value || 0);

    return `₱${(
      Number.isFinite(amount) ? amount : 0
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  function pesoPDF(value) {
    const amount = Number(value || 0);

    return `PHP ${(
      Number.isFinite(amount) ? amount : 0
    ).toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  }

  // ========================================================
  // 04. DOM HELPER
  // ========================================================

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }

  // ========================================================
  // 05. DATE FORMATTERS
  // ========================================================

  function displayDate(value, includeTime = false) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    const options = {
      timeZone: REPORT_TIMEZONE
    };

    return includeTime
      ? date.toLocaleString("en-PH", options)
      : date.toLocaleDateString("en-PH", options);
  }

  function displayPDFDate(value) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    const formattedDate = date.toLocaleDateString("en-GB", {
      timeZone: REPORT_TIMEZONE,
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const formattedTime = date.toLocaleTimeString("en-US", {
      timeZone: REPORT_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    });

    return `${formattedDate}\n${formattedTime}`;
  }

  // ========================================================
  // 06. PHILIPPINE DATE FORMAT
  // ========================================================

  const reportDateFormatter = new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone: REPORT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  );

  function reportDateKey(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return reportDateFormatter.format(date);
  }

  // ISO FORMAT: YYYY-MM-DD

  function phDateISO(value = new Date()) {
    const date = new Date(value);

    if (!Number.isFinite(date.getTime())) {
      return "";
    }

    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: REPORT_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const part = type =>
      parts.find(p => p.type === type)?.value;

    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  // ========================================================
  // 07. DAILY DATE VALIDATION
  // ========================================================

  function validDailyDate(value) {

    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
      return false;
    }

    const date = new Date(
      `${value}T00:00:00+08:00`
    );

    return (
      Number.isFinite(date.getTime()) &&
      phDateISO(date) === value &&
      value <= phDateISO()
    );

  }

  // ========================================================
  // 08. UPDATE BUTTON STATES
  // ========================================================

  function updateControls() {

    const exportButton = $("exportReportBtn");
    const historyButton = $("viewAllReportsBtn");

    const logoutButton =
      $("adminLogoutBtn") || $("logoutBtn");

    const unavailable =
      reportLoading ||
      exporting ||
      !reportLoaded;

    // EXPORT BUTTON

    if (exportButton) {
      exportButton.disabled = unavailable;
    }

    // EXPORT OPTIONS

    document
      .querySelectorAll(
        "[data-export-range], #exportPerDayBtn"
      )
      .forEach(button => {
        button.disabled = unavailable;
      });

    // VIEW ALL REPORTS

    if (historyButton) {
      historyButton.disabled =
        reportLoading || !reportLoaded;
    }

    // LOGOUT

    if (logoutButton) {
      logoutButton.disabled = exporting;
    }

    // DAILY REPORT SUMMARY

    updateDailyReportSummary();

  }

  // ========================================================
  // 09. TABLE MESSAGES
  // ========================================================

  function tableMessage(
    message,
    isError = false,
    tableId = "reportTable"
  ) {

    const table = $(tableId);

    if (!table) return;

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 5;

    cell.className = isError
      ? "empty error"
      : "empty";

    cell.textContent = message;

    row.append(cell);
    table.replaceChildren(row);

  }

  // ========================================================
  // 10. REPORT STATUS BADGES
  // ========================================================

  function getStatusClass(status) {

    const normalized = String(status || "")
      .trim()
      .toLowerCase();

    switch (normalized) {

      case "completed":
      case "delivered":
        return "status-badge badge-success";

      case "cancelled":
      case "canceled":
        return "status-badge badge-danger";

      case "processing":
      case "preparing":
        return "status-badge badge-warning";

      case "to deliver":
      case "to ship":
      case "to receive":
        return "status-badge badge-info";

      case "pending":
      case "pending payment":
        return "status-badge badge-pending";

      default:
        return "status-badge";

    }

  }

  // ========================================================
  // 11. REPORT STATUS FILTER GROUPS
  // ========================================================

  function reportStatusGroup(order) {

    const status = String(order.status || "")
      .trim()
      .toLowerCase();

    if (
      ["preparing", "processing"].includes(status)
    ) {
      return "preparing";
    }

    if (
      ["pending", "pending payment"].includes(status)
    ) {
      return "pending payment";
    }

    if (
      ["to deliver", "to ship", "to receive"]
        .includes(status)
    ) {
      return "to deliver";
    }

    if (
      ["completed", "delivered"].includes(status)
    ) {
      return "completed";
    }

    if (
      ["cancelled", "canceled"].includes(status)
    ) {
      return "cancelled";
    }

    return "other";

  }

  // ========================================================
  // 12. SORT REPORT ORDERS
  // NEWEST FIRST
  // ========================================================

  function sortedReportOrders() {

    const timestamp = order => {

      const value = order.created_at
        ? Date.parse(order.created_at)
        : NaN;

      return Number.isFinite(value)
        ? value
        : -Infinity;

    };

    return [...reportOrders].sort((a, b) => {

      const first = timestamp(a);
      const second = timestamp(b);

      return first === second
        ? 0
        : second > first
          ? 1
          : -1;

    });

  }

  // ========================================================
  // 13. RENDER REPORT TABLE ROWS
  // ========================================================

  function renderReportRows(
    tableId,
    orders,
    emptyMessage
  ) {

    const table = $(tableId);

    if (!table) return;

    if (!orders.length) {

      tableMessage(
        emptyMessage,
        false,
        tableId
      );

      return;

    }

    const fragment =
      document.createDocumentFragment();

    orders.forEach(order => {

      const row =
        document.createElement("tr");

      const values = [

        `#${String(order.id || "").slice(0, 8)}`,
        "Order Report",
        displayDate(order.created_at),
        peso(order.total_amount)

      ];

      values.forEach(value => {

        const cell =
          document.createElement("td");

        cell.textContent = value;

        row.append(cell);

      });

      // STATUS BADGE

      const statusCell =
        document.createElement("td");

      const badge =
        document.createElement("span");

      badge.className =
        getStatusClass(order.status);

      badge.textContent =
        order.status || "N/A";

      statusCell.append(badge);
      row.append(statusCell);

      fragment.append(row);

    });

    table.replaceChildren(fragment);

  }

  // ========================================================
  // 14. TODAY'S RECENT REPORT SUMMARY
  // ========================================================

  function renderReportTable() {

    const today =
      reportDateKey(new Date());

    const todayOrders =
      sortedReportOrders().filter(order => {

        return reportDateKey(
          order.created_at
        ) === today;

      });

    setText("todayReportDate", today);

    // MAXIMUM THREE REPORTS

    const visibleOrders =
      todayOrders.slice(0, TODAY_REPORT_LIMIT);

    renderReportRows(
      "reportTable",
      visibleOrders,
      "No reports today."
    );

    if (todayOrders.length > 0) {

      setText(
        "todayReportCount",
        `Showing ${visibleOrders.length} of ` +
        `${todayOrders.length} available reports today`
      );

    } else {

      setText("todayReportCount", "");

    }

    renderReportHistory();

  }

  // ========================================================
  // 15. REPORT HISTORY
  // ========================================================

  function renderReportHistory() {

    const filter =
      $("reportHistoryFilter")?.value || "all";

    const filteredOrders =
      sortedReportOrders().filter(order => {

        return filter === "all" ||
          reportStatusGroup(order) === filter;

      });

    renderReportRows(
      "allReportTable",
      filteredOrders,
      "No reports found in this category."
    );

    setText(
      "reportHistoryCount",
      `${filteredOrders.length} available reports`
    );

  }

  // ========================================================
  // 16. MONTHLY SALES OVERVIEW
  // ========================================================

  function renderMonthlySalesChart() {

    const chart = $("monthlySalesChart");

    if (!chart) return;

    const monthlySales = Array(12).fill(0);

    const months = [

      "Jan", "Feb", "Mar",
      "Apr", "May", "Jun",
      "Jul", "Aug", "Sep",
      "Oct", "Nov", "Dec"

    ];

    const monthFormatter =
      new Intl.DateTimeFormat("en-US", {
        timeZone: REPORT_TIMEZONE,
        month: "numeric"
      });

    reportOrders.forEach(order => {

      if (
        order.status !== "Completed" ||
        !order.created_at
      ) {
        return;
      }

      const date =
        new Date(order.created_at);

      const amount =
        Number(order.total_amount || 0);

      if (
        Number.isNaN(date.getTime()) ||
        !Number.isFinite(amount)
      ) {
        return;
      }

      const monthIndex =
        Number(monthFormatter.format(date)) - 1;

      monthlySales[monthIndex] += amount;

    });

    const maxSales = Math.max(
      ...monthlySales,
      1
    );

    const fragment =
      document.createDocumentFragment();

    months.forEach((month, index) => {

      const bar =
        document.createElement("div");

      const value =
        document.createElement("small");

      const label =
        document.createElement("span");

      const sales =
        monthlySales[index];

      const percentage =
        (sales / maxSales) * 100;

      bar.className = "bar";

      bar.style.height =
        `${Math.max(0, percentage)}%`;

      bar.title =
        `${month}: ${peso(sales)}`;

      bar.setAttribute("role", "img");

      bar.setAttribute(
        "aria-label",
        bar.title
      );

      value.className = "bar-value";
      value.textContent = peso(sales);

      label.textContent = month;

      bar.append(value, label);
      fragment.append(bar);

    });

    chart.replaceChildren(fragment);

  }

  // ========================================================
  // 17. RESET REPORT SUMMARY
  // ========================================================

  function resetReportSummary() {

    setText("reportTotalSales", peso(0));
    setText("reportTotalOrders", 0);
    setText("reportTotalUsers", 0);
    setText("reportDelivered", 0);

    setText("statusPreparing", 0);
    setText("statusToDeliver", 0);
    setText("statusCompleted", 0);
    setText("statusCancelled", 0);

  }

  // ========================================================
  // 18. LOAD REPORT DATA
  // ========================================================

  async function loadReports() {

    if (
      !$("reportTable") ||
      reportLoading
    ) {
      return;
    }

    if (!checkAdminSession()) return;

    reportLoading = true;
    reportLoaded = false;
    reportOrders = [];

    updateControls();

    tableMessage("Loading report data...");

    setText("todayReportCount", "");

    setText(
      "todayReportDate",
      reportDateKey(new Date())
    );

    tableMessage(
      "Loading report data...",
      false,
      "allReportTable"
    );

    setText("reportHistoryCount", "");

    try {

      const token =
        localStorage.getItem("adminToken");

      const response = await fetch(REPORTS_API, {

        method: "GET",
        cache: "no-store",

        headers: {

          Accept: "application/json",

          Authorization: `Bearer ${token}`

        }

      });

      // SESSION EXPIRED

      if (response.status === 401) {

        redirectToLogin();
        return;

      }

      let data;

      try {

        data = await response.json();

      } catch {

        throw new Error(
          "The server returned an unexpected response. " +
          "Check the reports API."
        );

      }

      // ADMIN PERMISSION

      if (response.status === 403) {

        throw new Error(
          data.message ||
          "You do not have permission to view reports."
        );

      }

      // RESPONSE VALIDATION

      if (!response.ok || !data.success) {

        throw new Error(
          data.message ||
          "Cannot load reports."
        );

      }

      if (!Array.isArray(data.orders)) {

        throw new Error(
          "The server did not return a valid order list."
        );

      }

      reportOrders = data.orders;

      // PERFORMANCE OVERVIEW

      setText(
        "reportTotalSales",
        peso(data.totalSales)
      );

      setText(
        "reportTotalOrders",
        data.totalOrders ?? 0
      );

      setText(
        "reportTotalUsers",
        data.totalUsers ?? 0
      );

      setText(
        "reportDelivered",
        data.delivered ?? 0
      );

      // ORDER STATUS

      setText(
        "statusPreparing",
        data.statusCounts?.Preparing ?? 0
      );

      setText(
        "statusToDeliver",
        data.statusCounts?.["To Deliver"] ?? 0
      );

      setText(
        "statusCompleted",
        data.statusCounts?.Completed ?? 0
      );

      setText(
        "statusCancelled",
        data.statusCounts?.Cancelled ?? 0
      );

      // RENDER REPORT COMPONENTS

      renderReportTable();
      renderMonthlySalesChart();

      reportLoaded = true;

    } catch (error) {

      console.error(
        "Reports loading error:",
        error
      );

      reportOrders = [];
      reportLoaded = false;

      resetReportSummary();
      renderMonthlySalesChart();

      const errorMessage =
        `${error.message || "Cannot load reports."} ` +
        "Check the server and refresh this page.";

      tableMessage(
        errorMessage,
        true
      );

      tableMessage(
        errorMessage,
        true,
        "allReportTable"
      );

      setText("todayReportCount", "");
      setText("reportHistoryCount", "");

    } finally {

      reportLoading = false;

      updateControls();

    }

  }

  // ========================================================
// 19. JCN PREMIUM GLOBAL NOTIFICATION
// ========================================================

function showNotification(icon, title, message) {

  if (window.Swal) {

    return window.Swal.fire({

      icon: icon,

      title: title,

      text: message,

      confirmButtonText: "OK",

      buttonsStyling: false,

      heightAuto: false,

      allowOutsideClick: false,

      allowEscapeKey: true,

      customClass: {
        popup: "jcn-report-alert"
      }

    });

  }

  window.alert(`${title}\n\n${message}`);

}

  // ========================================================
  // 20. EXPORT REPORT DATE RANGE
  // PER DAY / THIS WEEK / THIS MONTH
  // ========================================================

  function getExportReportData(
    range,
    selectedDate = ""
  ) {

    const DAY = 86400000;

    const today =
      phDateISO();

    const todayStart =
      Date.parse(`${today}T00:00:00+08:00`);

    const localCalendar =
      new Date(`${today}T00:00:00Z`);

    let start;
    let end;
    let title;

    switch (range) {

      // PER DAY

      case "day":

        if (!validDailyDate(selectedDate)) {
          return null;
        }

        start = Date.parse(
          `${selectedDate}T00:00:00+08:00`
        );

        end = start + DAY;

        title = "Daily Business Report";

        break;

      // THIS WEEK - MONDAY TO SUNDAY

      case "week": {

        const daysSinceMonday =
          (localCalendar.getUTCDay() + 6) % 7;

        start =
          todayStart - daysSinceMonday * DAY;

        end =
          start + 7 * DAY;

        title =
          "Weekly Business Report";

        break;

      }

      // THIS MONTH

      case "month": {

        const year =
          localCalendar.getUTCFullYear();

        const month =
          localCalendar.getUTCMonth();

        start =
          Date.UTC(year, month, 1) -
          8 * 3600000;

        end =
          Date.UTC(year, month + 1, 1) -
          8 * 3600000;

        title =
          "Monthly Business Report";

        break;

      }

      default:

        return null;

    }

    // FILTER ORDERS

    const orders =
      sortedReportOrders().filter(order => {

        const timestamp =
          Date.parse(order.created_at);

        return (

          Number.isFinite(timestamp) &&

          timestamp >= start &&

          timestamp < end

        );

      });

    // FORMAT REPORT PERIOD

    const formatter =
      new Intl.DateTimeFormat("en-GB", {

        timeZone: REPORT_TIMEZONE,

        year: "numeric",
        month: "short",
        day: "2-digit"

      });

    const period = range === "day"

      ? formatter.format(start)

      : `${formatter.format(start)} - ` +
        `${formatter.format(end - 1)}`;

    return {

      orders,

      title,

      period,

      filename:
        `jcn-${range}-report-${phDateISO(start)}.pdf`

    };

  }

  // ========================================================
  // 21. CALCULATE PDF REPORT SUMMARY
  // ========================================================

  function calculatePDFSummary(orders) {

    const completedOrders =
      orders.filter(order => {

        return String(order.status || "")
          .trim()
          .toLowerCase() === "completed";

      });

    const cancelledOrders =
      orders.filter(order => {

        const status =
          String(order.status || "")
            .trim()
            .toLowerCase();

        return [
          "cancelled",
          "canceled"
        ].includes(status);

      });

    const totalSales =
      completedOrders.reduce((sum, order) => {

        const amount =
          Number(order.total_amount || 0);

        return sum + (
          Number.isFinite(amount)
            ? amount
            : 0
        );

      }, 0);

    return {

      totalSales,

      totalOrders:
        orders.length,

      completedOrders:
        completedOrders.length,

      cancelledOrders:
        cancelledOrders.length

    };

  }

  // ========================================================
  // 22. UPDATE DAILY REPORT SUMMARY
  // ========================================================

  function updateDailyReportSummary() {

    const input =
      $("dailyReportDate");

    const summaryBox =
      $("dailyReportSummary");

    const message =
      $("dailyReportMessage");

    const confirm =
      $("confirmDailyReportBtn");

    if (
      !input ||
      !summaryBox ||
      !message ||
      !confirm
    ) {
      return;
    }

    const data = getExportReportData(
      "day",
      input.value
    );

    const ready =

      reportLoaded &&

      !reportLoading &&

      !exporting;

    // SUMMARY VISIBILITY

    summaryBox.hidden =
      !data || !reportLoaded;

    // EXPORT BUTTON VALIDATION

    confirm.disabled =
      !ready ||
      !data ||
      !data.orders.length;

    // UPDATE DAILY REPORT COUNTS

    if (data && reportLoaded) {

      const summary =
        calculatePDFSummary(data.orders);

      setText(
        "dailyReportOrders",
        summary.totalOrders
      );

      setText(
        "dailyReportSales",
        peso(summary.totalSales)
      );

    } else {

      setText(
        "dailyReportOrders",
        0
      );

      setText(
        "dailyReportSales",
        peso(0)
      );

    }

    // VALIDATION MESSAGES

    if (!data) {

      message.textContent =
        "Select a valid date, not later than today.";

    } else if (
      !reportLoaded ||
      reportLoading
    ) {

      message.textContent =
        "Report data is not ready.";

    } else if (!data.orders.length) {

      message.textContent =
        "No orders found for this date.";

    } else {

      message.textContent = "";

    }

    message.hidden =
      !message.textContent;

  }

  // ========================================================
  // 23. CLOSE EXPORT DROPDOWN
  // ========================================================

  function closeExportDropdown() {

    const exportButton =
      $("exportReportBtn");

    if (
      exportButton &&
      window.bootstrap?.Dropdown
    ) {

      const dropdown =
        window.bootstrap.Dropdown
          .getInstance(exportButton);

      dropdown?.hide();

    }

  }

  // ========================================================
  // 24. SETUP DAILY REPORT MODAL
  // ========================================================

  function setupDailyReport() {

    const modal =
      $("dailyReportModal");

    const input =
      $("dailyReportDate");

    const form =
      $("dailyReportForm");

    if (!modal || !input || !form) {
      return;
    }

    // OPEN DAILY REPORT MODAL

    $("exportPerDayBtn")?.addEventListener(
      "click",
      () => {

        if (
          !reportLoaded ||
          reportLoading ||
          exporting
        ) {
          return;
        }

        if (!window.bootstrap?.Modal) {

          showNotification(
            "error",
            "Modal Unavailable",
            "Check the Bootstrap script."
          );

          return;

        }

        closeExportDropdown();

        window.bootstrap.Modal
          .getOrCreateInstance(modal)
          .show();

      }
    );

    // DEFAULT DATE AND MAXIMUM DATE

    modal.addEventListener(
      "show.bs.modal",
      () => {

        input.max = phDateISO();

        input.value = input.max;

        updateDailyReportSummary();

      }
    );

    // FOCUS DATE INPUT

    modal.addEventListener(
      "shown.bs.modal",
      () => {

        input.focus();

      }
    );

    // UPDATE SUMMARY ON DATE CHANGE

    input.addEventListener(
      "input",
      updateDailyReportSummary
    );

    input.addEventListener(
      "change",
      updateDailyReportSummary
    );

    // EXPORT SELECTED DAILY REPORT

    form.addEventListener(
      "submit",
      event => {

        event.preventDefault();

        updateDailyReportSummary();

        const confirm =
          $("confirmDailyReportBtn");

        if (
          !confirm ||
          confirm.disabled ||
          exporting ||
          reportLoading ||
          !reportLoaded
        ) {
          return;
        }

        const selectedDate =
          input.value;

        if (!validDailyDate(selectedDate)) {

          updateDailyReportSummary();

          return;

        }

        const modalInstance =
          window.bootstrap?.Modal
            ?.getInstance(modal);

        if (!modalInstance) {
          return;
        }

        confirm.disabled = true;

        // GENERATE PDF AFTER MODAL CLOSES

        modal.addEventListener(

          "hidden.bs.modal",

          () => {

            exportReport(
              "day",
              selectedDate
            );

          },

          { once: true }

        );

        modalInstance.hide();

      }
    );

    // RESTORE FOCUS

    modal.addEventListener(
      "hidden.bs.modal",
      () => {

        $("exportReportBtn")?.focus();

      }
    );

  }

  // ========================================================
  // 25. FORMAT PDF CELL VALUES
  // ========================================================

  function pdfText(
    value,
    fallback = "-"
  ) {

    if (
      value === undefined ||
      value === null
    ) {
      return fallback;
    }

    const text =
      String(value).trim();

    return text || fallback;

  }

  // ========================================================
  // 26. EXPORT REPORT TO PDF
  // ========================================================

  function exportReport(
    range,
    selectedDate = ""
  ) {

    if (exporting) return;

    // CHECK REPORT STATE

    if (!reportLoaded || reportLoading) {

      showNotification(

        "warning",

        "Report Not Ready",

        "Please wait until the report data is loaded."

      );

      return;

    }

    // SELECTED REPORT DATA

    const selectedReport =
      getExportReportData(
        range,
        selectedDate
      );

    if (!selectedReport) {

      showNotification(

        "warning",

        "Invalid Report Date",

        "Please select a valid report period."

      );

      return;

    }

    const selectedOrders =
      selectedReport.orders;

    // EMPTY REPORT VALIDATION

    if (!selectedOrders.length) {

      showNotification(

        "info",

        "No Report Data",

        `No orders found for ${selectedReport.period}.`

      );

      return;

    }

    // PDF LIBRARY VALIDATION

    if (!window.jspdf?.jsPDF) {

      showNotification(

        "error",

        "PDF Library Not Loaded",

        "Check the jsPDF script connection."

      );

      return;

    }

    exporting = true;

    updateControls();

    try {

      // ====================================================
      // A4 LANDSCAPE DOCUMENT
      // ====================================================

      const { jsPDF } =
        window.jspdf;

      const doc = new jsPDF({

        orientation: "landscape",

        unit: "mm",

        format: "a4",

        compress: true

      });

      if (
        typeof doc.autoTable !== "function"
      ) {

        throw new Error(

          "PDF table library not loaded. " +

          "Check the jsPDF AutoTable script."

        );

      }

      // PAGE SIZE

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const margin = 10;

      const contentWidth =
        pageWidth - margin * 2;

      const summary =
        calculatePDFSummary(selectedOrders);

      // ====================================================
      // DOCUMENT METADATA
      // ====================================================

      doc.setProperties({

        title:
          `JCN Apparel - ${selectedReport.title}`,

        subject:
          selectedReport.period,

        author:
          "JCN Apparel Printing Services",

        creator:
          "JCN Admin Reports System"

      });

      // ====================================================
      // PROFESSIONAL BLACK AND GOLD HEADER
      // ====================================================

      doc.setFillColor(20, 20, 20);

      doc.rect(
        0,
        0,
        pageWidth,
        28,
        "F"
      );

      // GOLD ACCENT

      doc.setFillColor(244, 197, 66);

      doc.rect(
        0,
        28,
        pageWidth,
        2,
        "F"
      );

      // BUSINESS NAME

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(18);

      doc.setTextColor(
        244,
        197,
        66
      );

      doc.text(

        "JCN APPAREL PRINTING SERVICES",

        margin,

        12

      );

      // REPORT TITLE

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.setFontSize(12);

      doc.setTextColor(
        255,
        255,
        255
      );

      doc.text(

        selectedReport.title,

        margin,

        22

      );

      doc.setFontSize(9);

      doc.text(

        "ADMINISTRATIVE REPORT",

        pageWidth - margin,

        22,

        { align: "right" }

      );

      // ====================================================
      // REPORT PERIOD INFORMATION
      // ====================================================

      doc.setTextColor(
        45,
        45,
        45
      );

      doc.setFontSize(10);

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.text(
        "Report Period:",
        margin,
        38
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(

        selectedReport.period,

        margin + 29,

        38

      );

      // GENERATION DATE

      doc.setFontSize(9);

      doc.text(

        `Generated: ${displayDate(new Date(), true)} PHT`,

        pageWidth - margin,

        38,

        { align: "right" }

      );

      // ====================================================
      // COMPACT PDF SUMMARY CARDS
      // ====================================================

      const cardGap = 4;

      const cardWidth =
        (contentWidth - cardGap * 3) / 4;

      const cardY = 44;

      const cardHeight = 18;

      const summaryCards = [

        {
          label: "Completed Order Sales",
          value: pesoPDF(summary.totalSales)
        },

        {
          label: "Total Orders",
          value: String(summary.totalOrders)
        },

        {
          label: "Completed Orders",
          value: String(summary.completedOrders)
        },

        {
          label: "Cancelled Orders",
          value: String(summary.cancelledOrders)
        }

      ];

      summaryCards.forEach((card, index) => {

        const x =
          margin + index * (cardWidth + cardGap);

        // CARD BACKGROUND

        doc.setFillColor(
          248,
          248,
          248
        );

        doc.setDrawColor(
          220,
          220,
          220
        );

        doc.setLineWidth(0.2);

        doc.roundedRect(

          x,

          cardY,

          cardWidth,

          cardHeight,

          2,

          2,

          "FD"

        );

        // CARD LABEL

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8.5);

        doc.setTextColor(
          95,
          95,
          95
        );

        doc.text(

          card.label,

          x + 4,

          cardY + 6

        );

        // CARD VALUE

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(12);

        doc.setTextColor(
          35,
          35,
          35
        );

        doc.text(

          card.value,

          x + 4,

          cardY + 14

        );

      });

      // ====================================================
      // REPORT TABLE TITLE
      // ====================================================

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(10);

      doc.setTextColor(
        25,
        25,
        25
      );

      doc.text(

        "ORDER TRANSACTION DETAILS",

        margin,

        69

      );

      // ====================================================
      // PREPARE PDF TABLE RECORDS
      // CUSTOMER ADDRESS NOT INCLUDED
      // ====================================================

      const rows =
        selectedOrders.map(order => [

          pdfText(
            String(order.id || "").slice(0, 8)
          ),

          pdfText(
            order.customer_name,
            "Unknown"
          ),

          pdfText(
            order.customer_email
          ),

          pdfText(
            order.customer_phone
          ),

          pesoPDF(
            order.total_amount
          ),

          pdfText(
            order.payment_method
          ),

          pdfText(
            order.payment_status
          ),

          pdfText(
            order.status
          ),

          pdfText(
            order.tracking_number
          ),

          displayPDFDate(
            order.created_at
          )

        ]);

      // ====================================================
      // RESPONSIVE PDF COLUMN WIDTHS
      //
      // BASE WIDTH: 277 MM
      // WIDTHS ARE SCALED TO THE ACTUAL A4 PAGE WIDTH
      // ====================================================

      const baseWidths = [

        19, // ORDER ID
        32, // CUSTOMER
        48, // EMAIL
        28, // PHONE
        25, // AMOUNT
        18, // METHOD
        20, // PAYMENT
        27, // STATUS
        32, // TRACKING
        28  // DATE

      ];

      const baseTotal =
        baseWidths.reduce(
          (sum, width) => sum + width,
          0
        );

      const columnWidth = index =>

        contentWidth *
        (baseWidths[index] / baseTotal);

      // ====================================================
      // GENERATE PDF TABLE
      // ====================================================

      doc.autoTable({

        startY: 73,

        theme: "grid",

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

        tableWidth: contentWidth,

        // GENERAL TABLE DESIGN

        styles: {

          font: "helvetica",

          fontStyle: "normal",

          fontSize: 8,

          textColor: [35, 35, 35],

          overflow: "linebreak",

          valign: "middle",

          halign: "left",

          cellPadding: {

            top: 2.2,

            right: 1.5,

            bottom: 2.2,

            left: 1.5

          },

          lineColor: [225, 225, 225],

          lineWidth: 0.15

        },

        // TABLE HEADINGS

        headStyles: {

          fillColor: [218, 174, 40],

          textColor: [15, 15, 15],

          fontStyle: "bold",

          fontSize: 8.5,

          valign: "middle",

          halign: "left",

          minCellHeight: 9,

          cellPadding: {

            top: 2,

            right: 1.5,

            bottom: 2,

            left: 1.5

          }

        },

        bodyStyles: {

          fillColor: [255, 255, 255]

        },

        alternateRowStyles: {

          fillColor: [246, 247, 248]

        },

        // ==================================================
        // COLUMN WIDTH SETTINGS
        // ==================================================

        columnStyles: {

          0: {

            cellWidth: columnWidth(0),

            fontStyle: "bold"

          },

          1: {

            cellWidth: columnWidth(1)

          },

          2: {

            cellWidth: columnWidth(2),

            fontSize: 7.5

          },

          3: {

            cellWidth: columnWidth(3)

          },

          4: {

            cellWidth: columnWidth(4),

            halign: "right",

            fontStyle: "bold"

          },

          5: {

            cellWidth: columnWidth(5)

          },

          6: {

            cellWidth: columnWidth(6)

          },

          7: {

            cellWidth: columnWidth(7)

          },

          8: {

            cellWidth: columnWidth(8),

            fontSize: 7.5

          },

          9: {

            cellWidth: columnWidth(9),

            fontSize: 7.5

          }

        },

        // PAGE MARGINS

        margin: {

          top: 18,

          bottom: 20,

          left: margin,

          right: margin

        },

        showHead: "everyPage",

        pageBreak: "auto",

        rowPageBreak: "avoid",

        // ==================================================
        // PAYMENT AND ORDER STATUS COLORS
        // ==================================================

        didParseCell(data) {

          if (data.section !== "body") {
            return;
          }

          const columnIndex =
            data.column.index;

          const value =
            String(data.cell.raw || "")
              .trim()
              .toLowerCase();

          // PAYMENT STATUS

          if (columnIndex === 6) {

            if (value === "paid") {

              data.cell.styles.textColor =
                [25, 130, 75];

              data.cell.styles.fontStyle =
                "bold";

            } else if (

              [
                "pending",
                "unpaid",
                "pending payment"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [155, 110, 15];

            } else if (

              [
                "failed",
                "cancelled",
                "canceled"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [180, 45, 45];

            }

          }

          // ORDER STATUS

          if (columnIndex === 7) {

            data.cell.styles.fontStyle =
              "bold";

            if (

              [
                "completed",
                "delivered"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [25, 130, 75];

            } else if (

              [
                "cancelled",
                "canceled"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [185, 45, 45];

            } else if (

              [
                "preparing",
                "processing",
                "pending",
                "pending payment"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [155, 110, 15];

            } else if (

              [
                "to deliver",
                "to ship",
                "to receive"
              ].includes(value)

            ) {

              data.cell.styles.textColor =
                [40, 90, 175];

            }

          }

        }

      });

      // ====================================================
      // AUTOMATIC PAGE NUMBERING
      // ====================================================

      const totalPages =
        doc.internal.getNumberOfPages();

      for (
        let page = 1;
        page <= totalPages;
        page++
      ) {

        doc.setPage(page);

        // SECOND AND NEXT PAGE HEADER

        if (page > 1) {

          doc.setFont(
            "helvetica",
            "bold"
          );

          doc.setFontSize(9);

          doc.setTextColor(
            50,
            50,
            50
          );

          doc.text(

            "JCN APPAREL PRINTING SERVICES",

            margin,

            10

          );

          doc.setFont(
            "helvetica",
            "normal"
          );

          doc.text(

            selectedReport.title,

            pageWidth - margin,

            10,

            { align: "right" }

          );

        }

        // FOOTER DIVIDER

        doc.setDrawColor(
          218,
          174,
          40
        );

        doc.setLineWidth(0.35);

        doc.line(

          margin,

          pageHeight - 15,

          pageWidth - margin,

          pageHeight - 15

        );

        // FOOTER TEXT

        doc.setFont(
          "helvetica",
          "normal"
        );

        doc.setFontSize(8);

        doc.setTextColor(
          110,
          110,
          110
        );

        doc.text(

          "JCN Apparel Printing Services | Confidential",

          margin,

          pageHeight - 8

        );

        // PAGE NUMBER

        doc.text(

          `Page ${page} of ${totalPages}`,

          pageWidth - margin,

          pageHeight - 8,

          { align: "right" }

        );

      }

      // ====================================================
      // DOWNLOAD PDF
      // ====================================================

      doc.save(
        selectedReport.filename
      );

      showNotification(

        "success",

        "Report Exported",

        `${selectedReport.title} has been generated ` +
        `with ${selectedOrders.length} order records.`

      );

    } catch (error) {

      console.error(

        "PDF export error:",

        error

      );

      showNotification(

        "error",

        "Export Failed",

        error.message ||
        "Unable to export the report."

      );

    } finally {

      exporting = false;

      updateControls();

    }

  }

  // ========================================================
  // 27. UNIFIED ADMIN LOGOUT MODAL
  // ========================================================

  function setupAdminLogout() {

    const logoutButton =
      $("adminLogoutBtn") ||
      $("logoutBtn");

    if (!logoutButton) {

      console.warn(
        "[JCN Admin] Logout button was not found."
      );

      return;

    }

    // PREVENT DUPLICATE INITIALIZATION

    if (
      logoutButton.dataset.jcnLogoutReady === "true"
    ) {
      return;
    }

    let modal =
      $("adminLogoutModal");

    // CREATE NATIVE DIALOG IF NEEDED

    if (!(modal instanceof HTMLDialogElement)) {

      const newModal =
        document.createElement("dialog");

      newModal.id =
        "adminLogoutModal";

      if (modal) {

        modal.replaceWith(newModal);

      } else {

        document.body.appendChild(newModal);

      }

      modal = newModal;

    }

    // UNIFIED LOGOUT MODAL

    modal.id =
      "adminLogoutModal";

    modal.className =
      "jcn-unified-logout";

    modal.removeAttribute("hidden");
    modal.removeAttribute("aria-hidden");
    modal.removeAttribute("style");

    modal.setAttribute(

      "aria-labelledby",

      "adminLogoutTitle"

    );

    modal.setAttribute(

      "aria-describedby",

      "adminLogoutDescription"

    );

    if (modal.open) {
      modal.close();
    }

    // LOGOUT MODAL HTML

    modal.innerHTML = `

      <div class="logout-icon">

        <i
          class="fa-solid fa-right-from-bracket"
          aria-hidden="true"
        ></i>

      </div>

      <h3 id="adminLogoutTitle">

        Confirm Admin Logout

      </h3>

      <p id="adminLogoutDescription">

        Are you sure you want to end your current session?

      </p>

      <div class="logout-actions">

        <button
          type="button"
          id="adminConfirmLogout"
          class="logout-confirm-btn"
        >

          Yes, Logout

        </button>

        <button
          type="button"
          id="adminCancelLogout"
          class="logout-cancel-btn"
          autofocus
        >

          Cancel

        </button>

      </div>

    `;

    const confirmButton =
      $("adminConfirmLogout");

    const cancelButton =
      $("adminCancelLogout");

    let previousOverflow = "";

    let loggingOut = false;

    let outsidePress = false;

    // OPEN LOGOUT MODAL

    function openLogoutModal(event) {

      event.preventDefault();

      if (
        modal.open ||
        loggingOut ||
        exporting
      ) {
        return;
      }

      previousOverflow =
        document.body.style.overflow;

      modal.showModal();

      document.body.style.overflow =
        "hidden";

      cancelButton.focus();

    }

    // CLOSE LOGOUT MODAL

    function closeLogoutModal() {

      if (loggingOut) return;

      if (modal.open) {

        modal.close();

      }

    }

    // OUTSIDE CLICK DETECTION

    function isOutsideModal(event) {

      const rect =
        modal.getBoundingClientRect();

      return (

        event.target === modal &&

        (

          event.clientX < rect.left ||

          event.clientX > rect.right ||

          event.clientY < rect.top ||

          event.clientY > rect.bottom

        )

      );

    }

    // OPEN LOGOUT EVENT

    logoutButton.addEventListener(

      "click",

      openLogoutModal

    );

    // CANCEL LOGOUT

    cancelButton.addEventListener(

      "click",

      closeLogoutModal

    );

    // ESCAPE KEY

    modal.addEventListener(

      "cancel",

      event => {

        event.preventDefault();

        closeLogoutModal();

      }

    );

    // OUTSIDE CLICK

    modal.addEventListener(

      "pointerdown",

      event => {

        outsidePress =
          isOutsideModal(event);

      }

    );

    modal.addEventListener(

      "click",

      event => {

        if (
          outsidePress &&
          isOutsideModal(event)
        ) {

          closeLogoutModal();

        }

        outsidePress = false;

      }

    );

    // RESTORE BODY SCROLL

    modal.addEventListener(

      "close",

      () => {

        document.body.style.overflow =
          previousOverflow;

        outsidePress = false;

        if (!loggingOut) {

          confirmButton.disabled = false;

          cancelButton.disabled = false;

          logoutButton.focus();

        }

      }

    );

    // CONFIRM ADMIN LOGOUT

    confirmButton.addEventListener(

      "click",

      () => {

        if (
          loggingOut ||
          exporting
        ) {
          return;
        }

        loggingOut = true;

        confirmButton.disabled = true;

        cancelButton.disabled = true;

        try {

          // REMOVE ADMIN SESSION ONLY

          clearAdminSession();

          // PRESERVE THEME PREFERENCES

          window.location.replace(
            LOGIN_PAGE
          );

        } catch (error) {

          loggingOut = false;

          confirmButton.disabled = false;

          cancelButton.disabled = false;

          console.error(

            "ADMIN LOGOUT ERROR:",

            error

          );

          window.alert(

            "Unable to clear the admin session. " +

            "Please try again."

          );

        }

      }

    );

    logoutButton.dataset.jcnLogoutReady =
      "true";

    console.log(
      "[JCN Admin] Unified logout initialized."
    );

  }

  // ========================================================
  // 28. REPORT HISTORY SCROLL RESET
  // ========================================================

  function resetReportHistoryScroll() {

    const modal =
      $("reportHistoryModal");

    const body =
      modal?.querySelector(".modal-body");

    if (body) {

      body.scrollTop = 0;

      body.scrollLeft = 0;

    }

  }

  // ========================================================
  // 29. REPORT EVENTS
  // ========================================================

  function setupReportEvents() {

    // DAILY REPORT MODAL

    setupDailyReport();

    // REPORT HISTORY FILTER

    $("reportHistoryFilter")?.addEventListener(

      "change",

      () => {

        renderReportHistory();

        resetReportHistoryScroll();

      }

    );

    // OPEN REPORT HISTORY

    $("reportHistoryModal")?.addEventListener(

      "show.bs.modal",

      () => {

        const filter =
          $("reportHistoryFilter");

        if (filter) {

          filter.value = "all";

        }

        renderReportTable();

        resetReportHistoryScroll();

      }

    );

    // REPORT HISTORY SHOWN

    $("reportHistoryModal")?.addEventListener(

      "shown.bs.modal",

      () => {

        resetReportHistoryScroll();

      }

    );

    // ======================================================
    // THIS WEEK / THIS MONTH EXPORT
    // ======================================================

    document

      .querySelectorAll("[data-export-range]")

      .forEach(button => {

        button.addEventListener(

          "click",

          () => {

            if (

              exporting ||

              reportLoading ||

              !reportLoaded

            ) {
              return;
            }

            const range =
              button.dataset.exportRange;

            // ALLOW WEEK AND MONTH ONLY

            if (
              !["week", "month"].includes(range)
            ) {
              return;
            }

            closeExportDropdown();

            exportReport(range);

          }

        );

      });

    // OPTIONAL REFRESH REPORT BUTTON

    $("refreshReports")?.addEventListener(

      "click",

      () => {

        if (

          !reportLoading &&

          !exporting

        ) {

          loadReports();

        }

      }

    );

  }

  // ========================================================
  // 30. INITIALIZE ADMIN REPORTS
  // ========================================================

  function init() {

    if (initialized) return;

    if (!checkAdminSession()) return;

    initialized = true;

    // INITIALIZE LOGOUT

    setupAdminLogout();

    // CHECK REPORT TABLE

    if (!$("reportTable")) {

      console.warn(

        "[JCN Reports] Report table was not found."

      );

      return;

    }

    // INITIALIZE REPORT EVENTS

    setupReportEvents();

    // LOAD REPORT DATA

    loadReports();

    console.log(

      "[JCN Admin] Reports Version 16 initialized."

    );

  }

  // ========================================================
  // 31. DOM READY
  // ========================================================

  if (document.readyState === "loading") {

    document.addEventListener(

      "DOMContentLoaded",

      init,

      { once: true }

    );

  } else {

    init();

  }

})();
