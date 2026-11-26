
/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN - BUSINESS REPORTS
   TODAY'S REPORTS & REPORT HISTORY
   DATE RANGE PDF EXPORT & UNIFIED LOGOUT
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

    // Preserve existing theme preferences.
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
  // 03. FORMAT CURRENCY
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
  // 04. SET ELEMENT TEXT
  // ========================================================

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }

  // ========================================================
  // 05. FORMAT DATE - PHILIPPINE TIME
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

  // ========================================================
  // 06. PDF DATE AND TIME FORMAT
  // ========================================================

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
  // 07. TODAY'S DATE FORMATTER
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

  // ========================================================
  // 08. UPDATE BUTTON STATES
  // ========================================================

  function updateControls() {

    const exportButton = $("exportReportBtn");
    const historyButton = $("viewAllReportsBtn");

    const logoutButton =
      $("adminLogoutBtn") || $("logoutBtn");

    if (exportButton) {
      exportButton.disabled =
        reportLoading ||
        exporting ||
        !reportLoaded ||
        reportOrders.length === 0;
    }

    // EXPORT DROPDOWN OPTIONS

    document
      .querySelectorAll("[data-export-range]")
      .forEach(button => {
        button.disabled =
          reportLoading ||
          exporting ||
          !reportLoaded ||
          reportOrders.length === 0;
      });

    // VIEW ALL REPORTS

    if (historyButton) {
      historyButton.disabled =
        reportLoading || !reportLoaded;
    }

    // LOGOUT BUTTON

    if (logoutButton) {
      logoutButton.disabled = exporting;
    }

  }

  // ========================================================
  // 09. REPORT TABLE MESSAGE
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
      [
        "to deliver",
        "to ship",
        "to receive"
      ].includes(status)
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
  // 12. SORT REPORTS - NEWEST FIRST
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

    setText(
      "todayReportDate",
      today
    );

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
        `Showing ${visibleOrders.length} ` +
        `of ${todayOrders.length} available reports today`
      );

    } else {

      setText(
        "todayReportCount",
        ""
      );

    }

    renderReportHistory();

  }

  // ========================================================
  // 15. RENDER REPORT HISTORY
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
  // 16. MONTHLY SALES CHART
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

    // COMPLETED ORDER SALES ONLY

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

    if (!$("reportTable") || reportLoading) {
      return;
    }

    if (!checkAdminSession()) return;

    reportLoading = true;
    reportLoaded = false;
    reportOrders = [];

    updateControls();

    tableMessage("Loading report data...");

    setText(
      "todayReportCount",
      ""
    );

    setText(
      "todayReportDate",
      reportDateKey(new Date())
    );

    tableMessage(
      "Loading report data...",
      false,
      "allReportTable"
    );

    setText(
      "reportHistoryCount",
      ""
    );

    try {

      const token =
        localStorage.getItem("adminToken");

      // SEND API REQUEST

      const response = await fetch(REPORTS_API, {

        method: "GET",

        cache: "no-store",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }

      });

      // EXPIRED ADMIN SESSION

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      // PARSE RESPONSE

      let data;

      try {

        data = await response.json();

      } catch {

        throw new Error(
          "The server returned an unexpected response. " +
          "Check the reports API."
        );

      }

      // CHECK ADMIN PERMISSION

      if (response.status === 403) {

        throw new Error(
          data.message ||
          "You do not have permission to view reports."
        );

      }

      // VALIDATE RESPONSE

      if (!response.ok || !data.success) {

        throw new Error(
          data.message || "Cannot load reports."
        );

      }

      if (!Array.isArray(data.orders)) {

        throw new Error(
          "The server did not return a valid order list."
        );

      }

      // SAVE ALL ORDER RECORDS

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

      // ORDER STATUS COUNTS

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

      // RENDER REPORT MODULE

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
  // 19. GLOBAL NOTIFICATION
  // ========================================================

  function showNotification(
    icon,
    title,
    message
  ) {

    if (window.Swal) {

      return Swal.fire({

        icon,
        title,
        text: message,

        confirmButtonText: "OK",
        confirmButtonColor: "#f4c542"

      });

    }

    window.alert(`${title}\n\n${message}`);

  }

  // ========================================================
  // 20. EXPORT REPORT DATE RANGE
  // TODAY / THIS WEEK / THIS MONTH / ALL
  // ========================================================

  function getExportReportData(range = "all") {

    const PH_OFFSET =
      8 * 60 * 60 * 1000;

    const ONE_DAY =
      24 * 60 * 60 * 1000;

    const nowPH =
      new Date(Date.now() + PH_OFFSET);

    const todayStart = Date.UTC(

      nowPH.getUTCFullYear(),
      nowPH.getUTCMonth(),
      nowPH.getUTCDate()

    );

    let start;
    let end;
    let title;

    switch (range) {

      // TODAY

      case "today":

        start = todayStart;
        end = start + ONE_DAY;

        title = "Daily Business Report";

        break;

      // THIS WEEK - MONDAY TO SUNDAY

      case "week": {

        const day =
          nowPH.getUTCDay();

        const daysSinceMonday =
          (day + 6) % 7;

        start =
          todayStart - (daysSinceMonday * ONE_DAY);

        end =
          start + (7 * ONE_DAY);

        title =
          "Weekly Business Report";

        break;

      }

      // THIS MONTH

      case "month":

        start = Date.UTC(

          nowPH.getUTCFullYear(),
          nowPH.getUTCMonth(),
          1

        );

        end = Date.UTC(

          nowPH.getUTCFullYear(),
          nowPH.getUTCMonth() + 1,
          1

        );

        title = "Monthly Business Report";

        break;

      // ALL REPORTS

      default:

        return {

          orders: sortedReportOrders(),

          title: "Full Business Report",

          period: "All available records",

          filename: "jcn-full-report.pdf"

        };

    }

    // FILTER ORDERS USING PHILIPPINE TIME

    const orders =
      sortedReportOrders().filter(order => {

        if (!order.created_at) return false;

        const timestamp =
          Date.parse(order.created_at);

        if (!Number.isFinite(timestamp)) {
          return false;
        }

        const orderDatePH =
          timestamp + PH_OFFSET;

        return (
          orderDatePH >= start &&
          orderDatePH < end
        );

      });

    // FORMAT REPORT PERIOD

    const formatter =
      new Intl.DateTimeFormat("en-GB", {

        timeZone: "UTC",
        year: "numeric",
        month: "short",
        day: "numeric"

      });

    const startDate =
      formatter.format(new Date(start));

    const endDate =
      formatter.format(new Date(end - 1));

    const period =
      range === "today"
        ? startDate
        : `${startDate} - ${endDate}`;

    // GENERATE FILE NAME

    const fileDate =
      new Date(start)
        .toISOString()
        .slice(0, 10);

    return {

      orders,

      title,

      period,

      filename:
        `jcn-${range}-report-${fileDate}.pdf`

    };

  }

  // ========================================================
  // 21. FORMAT PDF CELL VALUES
  // ========================================================

  function pdfText(value, fallback = "-") {

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
  // 22. CALCULATE PDF REPORT SUMMARY
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
  // 23. EXPORT REPORT TO PDF
  // IMPROVED PROFESSIONAL PDF LAYOUT
  // ========================================================

  function exportReport(range = "all") {

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

    // GET SELECTED REPORT PERIOD

    const selectedReport =
      getExportReportData(range);

    const selectedOrders =
      selectedReport.orders;

    // NO AVAILABLE DATA

    if (!selectedOrders.length) {

      showNotification(

        "info",

        "No Report Data",

        `No orders found for ${selectedReport.period}.`

      );

      return;

    }

    // CHECK PDF LIBRARY

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
      // INITIALIZE A4 LANDSCAPE PDF
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

      // PDF PAGE SIZE

      const pageWidth =
        doc.internal.pageSize.getWidth();

      const pageHeight =
        doc.internal.pageSize.getHeight();

      const margin = 10;

      const contentWidth =
        pageWidth - (margin * 2);

      // REPORT SUMMARY

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
        30,
        "F"
      );

      // GOLD ACCENT LINE

      doc.setFillColor(244, 197, 66);

      doc.rect(
        0,
        30,
        pageWidth,
        2,
        "F"
      );

      // BUSINESS NAME

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(19);

      doc.setTextColor(
        244,
        197,
        66
      );

      doc.text(

        "JCN APPAREL PRINTING SERVICES",

        margin,

        13

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

        23

      );

      // ADMIN REPORT LABEL

      doc.setFontSize(9);

      doc.text(

        "ADMINISTRATIVE REPORT",

        pageWidth - margin,

        23,

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
        40
      );

      doc.setFont(
        "helvetica",
        "normal"
      );

      doc.text(

        selectedReport.period,

        margin + 29,

        40

      );

      // GENERATION DATE

      doc.setFontSize(9);

      doc.text(

        `Generated: ${displayDate(new Date(), true)} PHT`,

        pageWidth - margin,

        40,

        { align: "right" }

      );

      // ====================================================
      // PDF SUMMARY CARDS
      // ====================================================

      const cardGap = 4;

      const cardWidth =
        (contentWidth - (cardGap * 3)) / 4;

      const cardY = 46;

      const cardHeight = 20;

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
          margin + (index * (cardWidth + cardGap));

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

        doc.setFontSize(9);

        doc.setTextColor(
          95,
          95,
          95
        );

        doc.text(

          card.label,

          x + 4,

          cardY + 7

        );

        // CARD VALUE

        doc.setFont(
          "helvetica",
          "bold"
        );

        doc.setFontSize(13);

        doc.setTextColor(
          35,
          35,
          35
        );

        doc.text(

          card.value,

          x + 4,

          cardY + 15

        );

      });

      // ====================================================
      // REPORT TABLE TITLE
      // ====================================================

      doc.setFont(
        "helvetica",
        "bold"
      );

      doc.setFontSize(11);

      doc.setTextColor(
        25,
        25,
        25
      );

      doc.text(

        "ORDER TRANSACTION DETAILS",

        margin,

        74

      );

      // ====================================================
      // PREPARE PDF TABLE DATA
      // NO CUSTOMER ADDRESS
      // ====================================================

      const rows = selectedOrders.map(order => [

        // ORDER ID

        pdfText(
          String(order.id || "").slice(0, 8)
        ),

        // CUSTOMER NAME

        pdfText(
          order.customer_name,
          "Unknown"
        ),

        // EMAIL

        pdfText(
          order.customer_email
        ),

        // PHONE NUMBER

        pdfText(
          order.customer_phone
        ),

        // ORDER AMOUNT

        pesoPDF(
          order.total_amount
        ),

        // PAYMENT METHOD

        pdfText(
          order.payment_method
        ),

        // PAYMENT STATUS

        pdfText(
          order.payment_status
        ),

        // ORDER STATUS

        pdfText(
          order.status
        ),

        // TRACKING NUMBER

        pdfText(
          order.tracking_number
        ),

        // DATE AND TIME

        displayPDFDate(
          order.created_at
        )

      ]);

      // ====================================================
      // GENERATE PROFESSIONAL PDF TABLE
      // ====================================================

      doc.autoTable({

        startY: 79,

        theme: "grid",

        // TABLE HEADINGS

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

        // TABLE WIDTH

        tableWidth: contentWidth,

        // GENERAL CELL STYLING

        styles: {

          font: "helvetica",

          fontStyle: "normal",

          fontSize: 8,

          textColor: [35, 35, 35],

          overflow: "linebreak",

          valign: "middle",

          halign: "left",

          cellPadding: {

            top: 3,

            right: 2,

            bottom: 3,

            left: 2

          },

          lineColor: [225, 225, 225],

          lineWidth: 0.15

        },

        // TABLE HEADERS

        headStyles: {

          fillColor: [218, 174, 40],

          textColor: [15, 15, 15],

          fontStyle: "bold",

          fontSize: 8.5,

          valign: "middle",

          halign: "left",

          minCellHeight: 11,

          cellPadding: {

            top: 3,

            right: 2,

            bottom: 3,

            left: 2

          }

        },

        // TABLE BODY

        bodyStyles: {

          fillColor: [255, 255, 255]

        },

        // ALTERNATING ROW COLORS

        alternateRowStyles: {

          fillColor: [246, 247, 248]

        },

        // ==================================================
        // FIXED COLUMN WIDTHS
        // TOTAL WIDTH: 277 MM
        // A4 LANDSCAPE: 297 MM
        // LEFT AND RIGHT MARGINS: 10 MM
        // ==================================================

        columnStyles: {

          // ORDER ID
          0: {
            cellWidth: 19,
            fontStyle: "bold"
          },

          // CUSTOMER NAME
          1: {
            cellWidth: 32
          },

          // EMAIL ADDRESS
          2: {
            cellWidth: 48,
            fontSize: 7.5
          },

          // PHONE NUMBER
          3: {
            cellWidth: 28
          },

          // AMOUNT
          4: {
            cellWidth: 25,
            halign: "right",
            fontStyle: "bold"
          },

          // PAYMENT METHOD
          5: {
            cellWidth: 18
          },

          // PAYMENT STATUS
          6: {
            cellWidth: 20
          },

          // ORDER STATUS
          7: {
            cellWidth: 27
          },

          // TRACKING NUMBER
          8: {
            cellWidth: 32,
            fontSize: 7.5
          },

          // DATE AND TIME
          9: {
            cellWidth: 28,
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

        // KEEP TABLE HEADER ON EVERY PAGE

        showHead: "everyPage",

        pageBreak: "auto",

        rowPageBreak: "avoid",

        // ==================================================
        // PDF CELL COLOR FORMATTING
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

          // PAYMENT STATUS COLORS

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

          // ORDER STATUS COLORS

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
      // AUTOMATIC PAGE FOOTER AND PAGE NUMBERS
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
      // SAVE FILTERED PDF REPORT
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
  // 24. UNIFIED ADMIN LOGOUT MODAL
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

    // CREATE NATIVE HTML DIALOG IF NEEDED

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

    // APPLY UNIFIED LOGOUT CLASS

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

    // DETECT OUTSIDE CLICK

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

    // LOGOUT BUTTON

    logoutButton.addEventListener(
      "click",
      openLogoutModal
    );

    // CANCEL BUTTON

    cancelButton.addEventListener(
      "click",
      closeLogoutModal
    );

    // ESCAPE KEY SUPPORT

    modal.addEventListener(
      "cancel",
      event => {

        event.preventDefault();

        closeLogoutModal();

      }
    );

    // OUTSIDE CLICK SUPPORT

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

    // RESTORE PAGE AFTER CLOSING

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

        if (loggingOut || exporting) {
          return;
        }

        loggingOut = true;

        confirmButton.disabled = true;
        cancelButton.disabled = true;

        try {

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
  // 25. REPORT HISTORY SCROLL RESET
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
  // 26. REPORT EVENTS
  // ========================================================

  function setupReportEvents() {

    // REPORT HISTORY STATUS FILTER

    $("reportHistoryFilter")?.addEventListener(

      "change",

      () => {

        renderReportHistory();

        resetReportHistoryScroll();

      }

    );

    // OPEN REPORT HISTORY MODAL

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

    // MODAL SHOWN

    $("reportHistoryModal")?.addEventListener(

      "shown.bs.modal",

      () => {

        resetReportHistoryScroll();

      }

    );

    // ======================================================
    // EXPORT REPORT DROPDOWN OPTIONS
    // TODAY / WEEK / MONTH / ALL
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

            // CLOSE DROPDOWN BEFORE EXPORTING

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

            // GENERATE SELECTED REPORT

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
  // 27. INITIALIZE ADMIN REPORTS
  // ========================================================

  function init() {

    if (initialized) return;

    if (!checkAdminSession()) return;

    initialized = true;

    // INITIALIZE ADMIN LOGOUT

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

      "[JCN Admin] Reports initialized."

    );

  }

  // ========================================================
  // 28. DOM READY
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
