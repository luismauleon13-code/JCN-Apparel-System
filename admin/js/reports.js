/* ==========================================================
   JCN APPAREL PRINTING SERVICES
   ADMIN REPORTS
   WITH UNIFIED ADMIN LOGOUT MODAL
========================================================== */

(() => {

  /* ==========================================================
     01. API CONFIGURATION
  ========================================================== */

  const REPORTS_API = "/api/admin/reports";
  const LOGIN_PAGE = "admin-login.html";

  const $ = id => document.getElementById(id);

  let reportOrders = [];
  let reportLoaded = false;
  let reportLoading = false;
  let exporting = false;
  let initialized = false;


  /* ==========================================================
     02. ADMIN SESSION
  ========================================================== */

  function clearAdminSession() {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("adminUser");
    localStorage.removeItem("admin");

    // Preserve admin and customer theme preferences.
    // Do not use localStorage.clear().
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


  /* ==========================================================
     03. FORMAT CURRENCY
  ========================================================== */

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


  /* ==========================================================
     04. SET ELEMENT TEXT
  ========================================================== */

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent = value;
    }
  }


  /* ==========================================================
     05. FORMAT DATE
  ========================================================== */

  function displayDate(value, includeTime = false) {
    if (!value) return "N/A";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "N/A";
    }

    const options = {
      timeZone: "Asia/Manila"
    };

    return includeTime
      ? date.toLocaleString("en-PH", options)
      : date.toLocaleDateString("en-PH", options);
  }


  /* ==========================================================
     06. UPDATE BUTTON STATES
  ========================================================== */

  function updateControls() {
    const exportButton = $("exportReportBtn");
    const logoutButton = $("adminLogoutBtn") || $("logoutBtn");

    if (exportButton) {
      exportButton.disabled =
        reportLoading ||
        exporting ||
        !reportLoaded ||
        reportOrders.length === 0;
    }

    if (logoutButton) {
      logoutButton.disabled = exporting;
    }
  }


  /* ==========================================================
     07. REPORT TABLE MESSAGE
  ========================================================== */

  function tableMessage(message, isError = false) {
    const table = $("reportTable");

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


  /* ==========================================================
     08. REPORT STATUS BADGES
  ========================================================== */

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
        return "status-badge badge-pending";

      default:
        return "status-badge";
    }
  }


  /* ==========================================================
     09. RENDER RECENT REPORT SUMMARY
  ========================================================== */

  function renderReportTable() {
    const table = $("reportTable");

    if (!table) return;

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


      /* REPORT INFORMATION */

      values.forEach(value => {
        const cell = document.createElement("td");

        cell.textContent = value;

        row.append(cell);
      });


      /* ORDER STATUS */

      const statusCell = document.createElement("td");
      const badge = document.createElement("span");

      badge.className = getStatusClass(order.status);

      badge.textContent = order.status || "N/A";

      statusCell.append(badge);

      row.append(statusCell);

      fragment.append(row);
    });

    table.replaceChildren(fragment);
  }


  /* ==========================================================
     10. MONTHLY SALES CHART
  ========================================================== */

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


    /* PHILIPPINE MONTH FORMAT */

    const monthFormatter = new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone: "Asia/Manila",
        month: "numeric"
      }
    );


    /* CALCULATE COMPLETED ORDER SALES */

    reportOrders.forEach(order => {
      if (
        order.status !== "Completed" ||
        !order.created_at
      ) {
        return;
      }

      const date = new Date(order.created_at);

      const amount = Number(order.total_amount || 0);

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


    /* CALCULATE MAXIMUM SALES */

    const maxSales = Math.max(
      ...monthlySales,
      1
    );

    const fragment = document.createDocumentFragment();


    /* GENERATE MONTHLY CHART BARS */

    months.forEach((month, index) => {

      const bar = document.createElement("div");
      const value = document.createElement("small");
      const label = document.createElement("span");

      const sales = monthlySales[index];

      const percentage =
        (sales / maxSales) * 100;


      /* BAR DESIGN */

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


      /* SALES AMOUNT */

      value.className = "bar-value";

      value.textContent = peso(sales);


      /* MONTH LABEL */

      label.textContent = month;


      /* APPEND CHART ELEMENTS */

      bar.append(value, label);

      fragment.append(bar);
    });

    chart.replaceChildren(fragment);
  }


  /* ==========================================================
     11. RESET REPORT SUMMARY
  ========================================================== */

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


  /* ==========================================================
     12. LOAD REPORT DATA
  ========================================================== */

  async function loadReports() {
    if (!$("reportTable") || reportLoading) return;

    if (!checkAdminSession()) return;

    reportLoading = true;
    reportLoaded = false;
    reportOrders = [];

    updateControls();

    tableMessage("Loading report data...");

    try {

      /* GET ADMIN TOKEN */

      const token = localStorage.getItem("adminToken");


      /* SEND API REQUEST */

      const response = await fetch(REPORTS_API, {
        method: "GET",

        cache: "no-store",

        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`
        }
      });


      /* EXPIRED ADMIN SESSION */

      if (response.status === 401) {
        redirectToLogin();
        return;
      }


      /* PARSE SERVER RESPONSE */

      let data;

      try {
        data = await response.json();

      } catch {
        throw new Error(
          "The server returned an unexpected response. " +
          "Check the reports API."
        );
      }


      /* CHECK ADMIN PERMISSION */

      if (response.status === 403) {
        throw new Error(
          data.message ||
          "You do not have permission to view reports."
        );
      }


      /* VALIDATE SERVER RESPONSE */

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


      /* SAVE ORDER RECORDS */

      reportOrders = data.orders;


      /* PERFORMANCE OVERVIEW */

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


      /* ORDER STATUS COUNTS */

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


      /* RENDER REPORT MODULE */

      renderReportTable();

      renderMonthlySalesChart();


      /* MARK REPORT AS LOADED */

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

      tableMessage(
        `${error.message || "Cannot load reports."} ` +
        "Check the server and refresh this page.",
        true
      );

    } finally {

      reportLoading = false;

      updateControls();
    }
  }


  /* ==========================================================
     13. GLOBAL NOTIFICATION
  ========================================================== */

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


  /* ==========================================================
     14. EXPORT FULL REPORT TO PDF
  ========================================================== */

  function exportReport() {
    if (exporting) return;

    if (!reportLoaded || !reportOrders.length) {
      showNotification(
        "warning",
        "No Report Data",
        "No report data to export."
      );

      return;
    }


    /* CHECK PDF LIBRARY */

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

      /* INITIALIZE PDF */

      const { jsPDF } = window.jspdf;

      const doc = new jsPDF("landscape");


      /* CHECK AUTOTABLE */

      if (typeof doc.autoTable !== "function") {
        throw new Error(
          "PDF table library not loaded. " +
          "Check the jsPDF AutoTable script."
        );
      }


      /* CALCULATE COMPLETED SALES */

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


      /* PDF HEADER */

      doc.setFontSize(18);

      doc.setTextColor(20, 20, 20);

      doc.text(
        "JCN Apparel Full Report",
        14,
        15
      );


      /* REPORT INFORMATION */

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


      /* PREPARE REPORT TABLE ROWS */

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


      /* GENERATE PDF TABLE */

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


      /* SAVE PDF REPORT */

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


  /* ==========================================================
     15. UNIFIED ADMIN LOGOUT MODAL

     Same design as:
     - Manage Customers
     - Manage Staff
     - Announcements

     Compatible with admin-theme.css
  ========================================================== */

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


    /* PREVENT DUPLICATE INITIALIZATION */

    if (
      logoutButton.dataset.jcnLogoutReady === "true"
    ) {
      return;
    }

    let modal = $("adminLogoutModal");


    /* ========================================================
       CREATE NATIVE HTML DIALOG
    ======================================================== */

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


    /* ========================================================
       APPLY UNIFIED LOGOUT CLASS
    ======================================================== */

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


    /* ========================================================
       STANDARD LOGOUT HTML
    ======================================================== */

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


    /* ========================================================
       LOGOUT ELEMENTS
    ======================================================== */

    const confirmButton =
      $("adminConfirmLogout");

    const cancelButton =
      $("adminCancelLogout");

    let previousOverflow = "";
    let loggingOut = false;
    let outsidePress = false;


    /* ========================================================
       OPEN LOGOUT MODAL
    ======================================================== */

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


    /* ========================================================
       CLOSE LOGOUT MODAL
    ======================================================== */

    function closeLogoutModal() {
      if (loggingOut) return;

      if (modal.open) {
        modal.close();
      }
    }


    /* ========================================================
       DETECT OUTSIDE CLICK
    ======================================================== */

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


    /* ========================================================
       OPEN LOGOUT BUTTON EVENT
    ======================================================== */

    logoutButton.addEventListener(
      "click",
      openLogoutModal
    );


    /* ========================================================
       CANCEL LOGOUT BUTTON EVENT
    ======================================================== */

    cancelButton.addEventListener(
      "click",
      closeLogoutModal
    );


    /* ========================================================
       ESCAPE KEY SUPPORT
    ======================================================== */

    modal.addEventListener(
      "cancel",
      event => {
        event.preventDefault();

        closeLogoutModal();
      }
    );


    /* ========================================================
       OUTSIDE CLICK SUPPORT
    ======================================================== */

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


    /* ========================================================
       RESTORE PAGE AFTER CLOSING
    ======================================================== */

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


    /* ========================================================
       CONFIRM ADMIN LOGOUT
    ======================================================== */

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

          /* REMOVE ADMIN SESSION ONLY */

          clearAdminSession();


          /* PRESERVE THEME PREFERENCES */

          // jcnAdminAccountTheme remains saved.
          // jcnCustomerTheme remains saved.


          /* REDIRECT TO ADMIN LOGIN */

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


    /* ========================================================
       MARK LOGOUT AS INITIALIZED
    ======================================================== */

    logoutButton.dataset.jcnLogoutReady =
      "true";

    console.log(
      "[JCN Admin] Unified logout initialized."
    );
  }


  /* ==========================================================
     16. REPORT EVENTS
  ========================================================== */

  function setupReportEvents() {

    /* EXPORT REPORT */

    $("exportReportBtn")?.addEventListener(
      "click",
      exportReport
    );


    /* OPTIONAL REFRESH REPORT BUTTON */

    $("refreshReports")?.addEventListener(
      "click",
      () => {

        if (!reportLoading && !exporting) {
          loadReports();
        }

      }
    );
  }


  /* ==========================================================
     17. INITIALIZE ADMIN REPORTS
  ========================================================== */

  function init() {
    if (initialized) return;

    if (!checkAdminSession()) return;

    initialized = true;


    /* INITIALIZE UNIFIED LOGOUT */

    setupAdminLogout();


    /* CHECK REPORT TABLE */

    if (!$("reportTable")) {
      console.warn(
        "[JCN Reports] Report table was not found."
      );

      return;
    }


    /* INITIALIZE REPORT EVENTS */

    setupReportEvents();


    /* LOAD REPORT DATA */

    loadReports();

    console.log(
      "[JCN Admin] Reports initialized."
    );
  }


  /* ==========================================================
     18. DOM READY
  ========================================================== */

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