
/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN - BUSINESS REPORTS
   TODAY'S REPORTS & REPORT HISTORY
   PDF EXPORT & UNIFIED LOGOUT
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
  // 06. TODAY'S DATE FORMATTER
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
  // 07. UPDATE BUTTON STATES
  // ========================================================

  function updateControls() {

    const exportButton = $("exportReportBtn");

    const historyButton = $("viewAllReportsBtn");

    const logoutButton =
      $("adminLogoutBtn") || $("logoutBtn");

    // EXPORT BUTTON

    if (exportButton) {

      exportButton.disabled =
        reportLoading ||
        exporting ||
        !reportLoaded ||
        reportOrders.length === 0;

    }

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
  // 08. REPORT TABLE MESSAGE
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
  // 09. REPORT STATUS BADGES
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


      case "pending payment":
      case "pending":

        return "status-badge badge-pending";


      default:

        return "status-badge";

    }

  }


  // ========================================================
  // 10. REPORT STATUS FILTER GROUPS
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
  // 11. SORT REPORTS - NEWEST FIRST
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
  // 12. RENDER REPORT TABLE ROWS
  // ========================================================

  function renderReportRows(
    tableId,
    orders,
    emptyMessage
  ) {

    const table = $(tableId);

    if (!table) return;

    // EMPTY TABLE

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

      // REPORT INFORMATION

      const values = [

        `#${String(order.id || "").slice(0, 8)}`,

        "Order Report",

        displayDate(order.created_at),

        peso(order.total_amount)

      ];

      // CREATE TABLE CELLS

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
  // 13. TODAY'S RECENT REPORT SUMMARY
  // ========================================================

  function renderReportTable() {

    const today =
      reportDateKey(new Date());

    // FILTER TODAY'S REPORTS

    const todayOrders =
      sortedReportOrders().filter(order => {

        return reportDateKey(
          order.created_at
        ) === today;

      });

    // DISPLAY TODAY'S DATE

    setText(
      "todayReportDate",
      today
    );

    // DISPLAY MAXIMUM OF THREE REPORTS

    const visibleOrders = todayOrders.slice(
      0,
      TODAY_REPORT_LIMIT
    );

    // RENDER TODAY'S TABLE

    renderReportRows(
      "reportTable",
      visibleOrders,
      "No reports today."
    );

    // DISPLAY TODAY'S REPORT COUNT

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

    // UPDATE COMPLETE REPORT HISTORY

    renderReportHistory();

  }


  // ========================================================
  // 14. RENDER ALL AVAILABLE REPORT HISTORY
  // ========================================================

  function renderReportHistory() {

    const filter =
      $("reportHistoryFilter")?.value || "all";

    // GET FILTERED REPORTS

    const filteredOrders =
      sortedReportOrders().filter(order => {

        return filter === "all" ||
          reportStatusGroup(order) === filter;

      });

    // RENDER REPORT HISTORY TABLE

    renderReportRows(

      "allReportTable",

      filteredOrders,

      "No reports found in this category."

    );

    // UPDATE REPORT HISTORY COUNT

    setText(

      "reportHistoryCount",

      `${filteredOrders.length} available reports`

    );

  }


  // ========================================================
  // 15. MONTHLY SALES CHART
  // ========================================================

  function renderMonthlySalesChart() {

    const chart = $("monthlySalesChart");

    if (!chart) return;

    const monthlySales = Array(12).fill(0);

    const months = [

      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec"

    ];

    // PHILIPPINE MONTH FORMAT

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

    // MAXIMUM SALES VALUE

    const maxSales = Math.max(
      ...monthlySales,
      1
    );

    const fragment =
      document.createDocumentFragment();

    // GENERATE MONTHLY SALES BARS

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

      // BAR DESIGN

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

      // SALES VALUE

      value.className = "bar-value";

      value.textContent = peso(sales);

      // MONTH LABEL

      label.textContent = month;

      // APPEND CHART COMPONENTS

      bar.append(value, label);

      fragment.append(bar);

    });

    chart.replaceChildren(fragment);

  }


  // ========================================================
  // 16. RESET REPORT SUMMARY
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
  // 17. LOAD REPORT DATA
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

    // LOADING STATE

    tableMessage(
      "Loading report data..."
    );

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

      // GET ADMIN TOKEN

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

      // VALIDATE API RESPONSE

      if (!response.ok || !data.success) {

        throw new Error(

          data.message || "Cannot load reports."

        );

      }

      // VALIDATE ORDER LIST

      if (!Array.isArray(data.orders)) {

        throw new Error(

          "The server did not return a valid order list."

        );

      }

      // SAVE ALL ORDER RECORDS

      reportOrders = data.orders;

      // ====================================================
      // PERFORMANCE OVERVIEW
      // ====================================================

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

      // ====================================================
      // ORDER STATUS COUNTS
      // ====================================================

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

      // RENDER TODAY'S REPORTS AND REPORT HISTORY

      renderReportTable();

      // RENDER MONTHLY SALES CHART

      renderMonthlySalesChart();

      // REPORT DATA LOADED SUCCESSFULLY

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

      setText(
        "todayReportCount",
        ""
      );

      setText(
        "reportHistoryCount",
        ""
      );

    } finally {

      reportLoading = false;

      updateControls();

    }

  }


  // ========================================================
  // 18. GLOBAL NOTIFICATION
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
  // 19. EXPORT FULL REPORT TO PDF
  // ========================================================

  function exportReport() {

    if (exporting) return;

    // CHECK AVAILABLE REPORT DATA

    if (!reportLoaded || !reportOrders.length) {

      showNotification(

        "warning",

        "No Report Data",

        "No report data to export."

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

      // INITIALIZE PDF

      const { jsPDF } = window.jspdf;

      const doc = new jsPDF("landscape");

      // CHECK AUTOTABLE LIBRARY

      if (typeof doc.autoTable !== "function") {

        throw new Error(

          "PDF table library not loaded. " +

          "Check the jsPDF AutoTable script."

        );

      }

      // CALCULATE COMPLETED ORDER SALES

      const totalSales = reportOrders

        .filter(order =>

          order.status === "Completed"

        )

        .reduce((sum, order) => {

          const amount = Number(

            order.total_amount || 0

          );

          return sum + (

            Number.isFinite(amount)

              ? amount

              : 0

          );

        }, 0);

      // PDF HEADER

      doc.setFontSize(18);

      doc.setTextColor(20, 20, 20);

      doc.text(

        "JCN Apparel Full Report",

        14,

        15

      );

      // PDF REPORT INFORMATION

      doc.setFontSize(10);

      doc.text(

        `Generated: ${displayDate(new Date(), true)} PHT`,

        14,

        23

      );

      doc.text(

        `Completed Order Sales: ${pesoPDF(totalSales)}`,

        14,

        31

      );

      doc.text(

        `Orders included: ${reportOrders.length}`,

        14,

        38

      );

      // ====================================================
      // PREPARE ALL REPORT RECORDS
      //
      // PDF EXPORT IS NOT LIMITED TO TODAY'S REPORTS
      // OR THE CURRENT REPORT HISTORY FILTER
      // ====================================================

      const rows = reportOrders.map(order => [

        String(order.id || "").slice(0, 8),

        order.customer_name || "Unknown",

        order.customer_email || "",

        order.customer_phone || "",

        pesoPDF(order.total_amount),

        order.payment_method || "",

        order.payment_status || "",

        order.status || "",

        order.tracking_number || "",

        displayDate(order.created_at, true)

      ]);

      // GENERATE PDF TABLE

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

          overflow: "linebreak",

          cellPadding: 3

        },

        headStyles: {

          fillColor: [214, 165, 29],

          textColor: [0, 0, 0],

          fontStyle: "bold"

        },

        alternateRowStyles: {

          fillColor: [247, 247, 247]

        },

        margin: {

          left: 14,

          right: 14

        }

      });

      // SAVE PDF REPORT

      doc.save("jcn-full-report.pdf");

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
  // 20. UNIFIED ADMIN LOGOUT MODAL
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

    let modal = $("adminLogoutModal");

    // CREATE NATIVE HTML DIALOG IF NEEDED

    if (!(modal instanceof HTMLDialogElement)) {

      const newModal =
        document.createElement("dialog");

      newModal.id = "adminLogoutModal";

      if (modal) {

        modal.replaceWith(newModal);

      } else {

        document.body.appendChild(newModal);

      }

      modal = newModal;

    }

    // APPLY UNIFIED LOGOUT CLASS

    modal.id = "adminLogoutModal";

    modal.className = "jcn-unified-logout";

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

    // STANDARD LOGOUT HTML

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

    // LOGOUT ELEMENTS

    const confirmButton =
      $("adminConfirmLogout");

    const cancelButton =
      $("adminCancelLogout");

    let previousOverflow = "";

    let loggingOut = false;

    let outsidePress = false;


    // ======================================================
    // OPEN LOGOUT MODAL
    // ======================================================

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


    // ======================================================
    // CLOSE LOGOUT MODAL
    // ======================================================

    function closeLogoutModal() {

      if (loggingOut) return;

      if (modal.open) {

        modal.close();

      }

    }


    // ======================================================
    // DETECT OUTSIDE CLICK
    // ======================================================

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


    // ======================================================
    // LOGOUT BUTTON EVENT
    // ======================================================

    logoutButton.addEventListener(

      "click",

      openLogoutModal

    );


    // ======================================================
    // CANCEL LOGOUT BUTTON
    // ======================================================

    cancelButton.addEventListener(

      "click",

      closeLogoutModal

    );


    // ======================================================
    // ESCAPE KEY SUPPORT
    // ======================================================

    modal.addEventListener(

      "cancel",

      event => {

        event.preventDefault();

        closeLogoutModal();

      }

    );


    // ======================================================
    // OUTSIDE CLICK SUPPORT
    // ======================================================

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


    // ======================================================
    // RESTORE PAGE AFTER CLOSING
    // ======================================================

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


    // ======================================================
    // CONFIRM ADMIN LOGOUT
    // ======================================================

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

          // REMOVE ADMIN SESSION ONLY

          clearAdminSession();

          // PRESERVE ADMIN AND CUSTOMER THEMES

          // REDIRECT TO ADMIN LOGIN

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

    // MARK LOGOUT AS INITIALIZED

    logoutButton.dataset.jcnLogoutReady =
      "true";

    console.log(

      "[JCN Admin] Unified logout initialized."

    );

  }


  // ========================================================
  // 21. REPORT HISTORY SCROLL RESET
  // ========================================================

  function resetReportHistoryScroll() {

    const modal = $("reportHistoryModal");

    const body =
      modal?.querySelector(".modal-body");

    if (body) {

      body.scrollTop = 0;

    }

  }


  // ========================================================
  // 22. REPORT EVENTS
  // ========================================================

  function setupReportEvents() {

    // ======================================================
    // REPORT HISTORY STATUS FILTER
    // ======================================================

    $("reportHistoryFilter")?.addEventListener(

      "change",

      () => {

        renderReportHistory();

        resetReportHistoryScroll();

      }

    );


    // ======================================================
    // OPEN REPORT HISTORY MODAL
    // ======================================================

    $("reportHistoryModal")?.addEventListener(

      "show.bs.modal",

      () => {

        // RESET FILTER TO ALL

        const filter =
          $("reportHistoryFilter");

        if (filter) {

          filter.value = "all";

        }

        // UPDATE TODAY'S TABLE AND REPORT HISTORY

        renderReportTable();

        // RESET SCROLL POSITION

        resetReportHistoryScroll();

      }

    );


    // ======================================================
    // MODAL SHOWN
    // ======================================================

    $("reportHistoryModal")?.addEventListener(

      "shown.bs.modal",

      () => {

        resetReportHistoryScroll();

      }

    );


    // ======================================================
    // EXPORT REPORT
    // ======================================================

    $("exportReportBtn")?.addEventListener(

      "click",

      exportReport

    );


    // ======================================================
    // OPTIONAL REFRESH REPORT BUTTON
    // ======================================================

    $("refreshReports")?.addEventListener(

      "click",

      () => {

        if (!reportLoading && !exporting) {

          loadReports();

        }

      }

    );

  }


  // ========================================================
  // 23. INITIALIZE ADMIN REPORTS
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
  // 24. DOM READY
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
