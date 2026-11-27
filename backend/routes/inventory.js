
const express = require("express");

/* ==========================================
   JCN APPAREL - INVENTORY ROUTES
========================================== */

module.exports = function createInventoryRouter({
  supabase,
  verifyStaffToken
}) {

  if (
    !supabase ||
    typeof verifyStaffToken !== "function"
  ) {
    throw new Error(
      "Inventory routes require Supabase and authentication middleware."
    );
  }

  const router = express.Router();

  /* ==========================================
     CONSTANTS
  ========================================== */

  const allowedRoles = new Set([
    "inventory_staff",
    "admin"
  ]);

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const normalize = value => {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  };

  const invalid = message => {
    return Object.assign(
      new Error(message),
      { status: 400 }
    );
  };

  /* ==========================================
     ERROR HANDLER
  ========================================== */

  function failure(res, error) {

    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    if (error.code === "P0001") {

      const conflict = /changed|transition/i.test(
        error.message
      );

      return res.status(
        conflict ? 409 : 400
      ).json({
        success: false,
        message: error.message
      });

    }

    console.error(
      "INVENTORY API ERROR:",
      error.code || "",
      error.message
    );

    let message =
      "Inventory request failed. Check the server terminal.";

    if (
      ["42501", "PGRST301"].includes(error.code)
    ) {

      message =
        "Inventory database access denied. Check Supabase permissions.";

    } else if (
      [
        "42P01",
        "42703",
        "42883",
        "PGRST202",
        "PGRST204",
        "PGRST205"
      ].includes(error.code)
    ) {

      message =
        "Inventory database setup is missing or outdated.";

    }

    return res.status(500).json({
      success: false,
      message
    });

  }

  /* ==========================================
     ASYNC ROUTE HANDLER
  ========================================== */

  const handle = fn => {

    return async (req, res) => {

      try {
        await fn(req, res);
      } catch (error) {
        failure(res, error);
      }

    };

  };

  /* ==========================================
     PAGINATION
  ========================================== */

  function pagination(req) {

    const raw = req.query.page ?? "1";

    if (
      typeof raw !== "string" ||
      !/^[1-9][0-9]*$/.test(raw)
    ) {
      throw invalid("Invalid page number.");
    }

    const page = Number(raw);

    if (
      !Number.isSafeInteger(page) ||
      page > 1000000
    ) {
      throw invalid("Invalid page number.");
    }

    const limit = 25;

    return {
      page,
      limit,
      from: (page - 1) * limit,
      to: page * limit - 1
    };

  }

  /* ==========================================
     VALIDATE RECORD ID
  ========================================== */

  function recordId(value) {

    if (
      typeof value !== "string" ||
      !uuid.test(value)
    ) {
      throw invalid("Invalid record ID.");
    }

    return value;

  }

  /* ==========================================
     VALIDATE JSON BODY
  ========================================== */

  function objectBody(req) {

    if (
      !req.body ||
      typeof req.body !== "object" ||
      Array.isArray(req.body)
    ) {
      throw invalid("A JSON object is required.");
    }

    return req.body;

  }

  /* ==========================================
     DISABLE API CACHING
  ========================================== */

  router.use((req, res, next) => {

    res.set("Cache-Control", "no-store");

    next();

  });

  /* ==========================================
     VERIFY STAFF TOKEN
  ========================================== */

  router.use(verifyStaffToken);

  /* ==========================================
     VERIFY INVENTORY ROLE
  ========================================== */

  router.use(async (req, res, next) => {

    try {

      if (
        !req.staff ||
        !allowedRoles.has(
          normalize(req.staff.role)
        ) ||
        !uuid.test(
          String(req.staff.id || "")
        )
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Inventory Staff or Admin access is required."
        });

      }

      const {
        data: account,
        error
      } = await supabase
        .from("admin_users")
        .select(
          "id,username,full_name,role,status"
        )
        .eq("id", req.staff.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!account) {

        return res.status(401).json({
          success: false,
          message:
            "Account no longer exists. Please log in again."
        });

      }

      if (
        !allowedRoles.has(
          normalize(account.role)
        ) ||
        normalize(account.status) !== "active"
      ) {

        return res.status(403).json({
          success: false,
          message:
            "Your account is inactive or unauthorized."
        });

      }

      req.inventoryActor =
        `${account.full_name || account.username || "Staff"} (${account.id})`;

      req.inventoryStaff = account;

      next();

    } catch (error) {

      failure(res, error);

    }

  });

  /* ==========================================
     GET INVENTORY PRODUCTS
  ========================================== */

  router.get(
    "/products",

    handle(async (req, res) => {

      const p = pagination(req);

      const {
        data,
        error,
        count
      } = await supabase
        .from("products")
        .select(
          "id,title,category,sizes,quantity",
          { count: "exact" }
        )
        .order("title", {
          ascending: true
        })
        .order("id", {
          ascending: true
        })
        .range(p.from, p.to);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        products: data || [],
        total: count ?? 0,
        page: p.page,
        limit: p.limit
      });

    })
  );

  /* ==========================================
     ADJUST PRODUCT STOCK
  ========================================== */

  router.post(
    "/products/:id/adjust",

    handle(async (req, res) => {

      const id = recordId(req.params.id);

      const {
        size,
        mode,
        amount,
        expected,
        reason
      } = objectBody(req);

      if (
        typeof size !== "string" ||
        !size.trim() ||
        size.length > 100
      ) {
        throw invalid("Select a valid size.");
      }

      if (
        !["add", "remove", "set"].includes(mode)
      ) {
        throw invalid("Invalid stock movement.");
      }

      if (
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > 1000000 ||
        (
          mode !== "set" &&
          amount === 0
        )
      ) {

        throw invalid(
          "Quantity must be a valid whole number."
        );

      }

      if (
        !Number.isInteger(expected) ||
        expected < 0 ||
        expected > 2147483647
      ) {

        throw invalid(
          "Invalid current stock. Refresh the page."
        );

      }

      if (
        typeof reason !== "string" ||
        !reason.trim() ||
        reason.trim().length > 300
      ) {

        throw invalid(
          "Enter a reason of 1 to 300 characters."
        );

      }

      const {
        data,
        error
      } = await supabase.rpc(
        "jcn_inventory_adjust",
        {
          p_product_id: id,
          p_size: size,
          p_mode: mode,
          p_amount: amount,
          p_expected: expected,
          p_reason: reason.trim(),
          p_actor: req.inventoryActor
        }
      );

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        message: "Stock and history saved.",
        adjustment: data
      });

    })
  );

  /* ==========================================
     GET STOCK HISTORY
  ========================================== */

  router.get(
    "/history",

    handle(async (req, res) => {

      const p = pagination(req);

      const {
        data,
        error,
        count
      } = await supabase
        .from("inventory_stock_history")
        .select(
          "id,product_id,product,size,before_qty,change_qty,after_qty,reason,actor,created_at",
          { count: "exact" }
        )
        .order("created_at", {
          ascending: false
        })
        .order("id", {
          ascending: false
        })
        .range(p.from, p.to);

      if (error) {
        throw error;
      }

      return res.json({
        success: true,
        history: data || [],
        total: count ?? 0,
        page: p.page,
        limit: p.limit
      });

    })
  );

  /* ==========================================
     GET INVENTORY ORDERS

     Includes:
     - Preparing
     - Processing
     - To Ship

     Also retrieves J&T tracking information.
  ========================================== */

  // =====================================================
// INVENTORY - GET VERIFIED ORDERS FOR PREPARATION
// =====================================================

/* ==========================================
   GET VERIFIED ORDERS FOR PREPARATION
========================================== */

router.get(
  "/orders",

  handle(async (req, res) => {

    const p = pagination(req);

    const {
      data,
      error,
      count
    } = await supabase

      .from("orders")

      .select(
        [
          "id",
          "order_number",
          "customer_name",
          "customer_phone",
          "shipping_address",
          "payment_method",
          "payment_status",
          "status",
          "tracking_number",
          "courier",
          "inventory_items",
          "inventory_preparation",
          "inventory_revision",
          "inventory_prepared_by",
          "inventory_prepared_at",
          "cashier_verified_at",
          "cashier_verified_by",
          "cashier_released_at",
          "created_at"
        ].join(","),
        {
          count: "exact"
        }
      )

      /* ----------------------------------
         INCLUDE VERIFIED PENDING ORDERS
      ---------------------------------- */

      .in(
        "status",
        [
          "Pending",
          "Preparing",
          "Processing",
          "To Ship"
        ]
      )

      /* ----------------------------------
         CASHIER VERIFICATION REQUIRED
      ---------------------------------- */

      .not(
        "cashier_verified_at",
        "is",
        null
      )

      /* ----------------------------------
         EXCLUDE RELEASED ORDERS
      ---------------------------------- */

      .is(
        "cashier_released_at",
        null
      )

      /* ----------------------------------
         PAYMENT ELIGIBILITY
         COD: Pending or Paid
         PayPal: Paid only
      ---------------------------------- */

      .or(
        "payment_method.eq.COD,and(payment_method.eq.PayPal,payment_status.ilike.Paid)"
      )

      /* ----------------------------------
         ORDER SORTING
      ---------------------------------- */

      .order("created_at", {
        ascending: true
      })

      .order("id", {
        ascending: true
      })

      /* ----------------------------------
         PAGINATION
      ---------------------------------- */

      .range(
        p.from,
        p.to
      );

    if (error) {
      throw error;
    }

    /* ==========================================
       FORMAT INVENTORY ORDER DETAILS
    ========================================== */

    const orders = (data || []).map(order => {

      const preparationStatus = String(
        order.inventory_preparation || "Queued"
      ).trim();

      const normalizedPreparation =
        preparationStatus.toLowerCase();

      const orderStatus = String(
        order.status || ""
      ).trim().toLowerCase();

      const paymentMethod = String(
        order.payment_method || ""
      ).trim().toLowerCase();

      const paymentStatus = String(
        order.payment_status || ""
      ).trim().toLowerCase();

      const cashierVerified = Boolean(
        order.cashier_verified_at
      );

      const cashierReleased = Boolean(
        order.cashier_released_at
      );

      /* ----------------------------------
         PAYMENT VALIDATION
      ---------------------------------- */

      const paymentEligible =
        paymentMethod === "cod" ||
        (
          paymentMethod === "paypal" &&
          paymentStatus === "paid"
        );

      /* ----------------------------------
         PREPARATION STATUS
      ---------------------------------- */

      const isQueued =
        normalizedPreparation === "queued";

      const isPreparing =
        normalizedPreparation === "preparing";

      const isReady = [
        "ready",
        "ready to ship",
        "prepared"
      ].includes(normalizedPreparation);

      /* ----------------------------------
         INVENTORY ITEMS
      ---------------------------------- */

      let items = order.inventory_items;

      if (typeof items === "string") {

        try {
          items = JSON.parse(items);
        } catch {
          items = [];
        }

      }

      if (!Array.isArray(items)) {
        items = [];
      }

      const hasItems =
        items.length > 0 &&
        items.length <= 200;

      /* ----------------------------------
         START PREPARATION ELIGIBILITY
      ---------------------------------- */

      const canStartPreparation =

        cashierVerified &&

        !cashierReleased &&

        paymentEligible &&

        hasItems &&

        isQueued &&

        [
          "pending",
          "preparing",
          "processing"
        ].includes(orderStatus);

      /* ----------------------------------
         MARK READY ELIGIBILITY
      ---------------------------------- */

      const canMarkReady =

        cashierVerified &&

        !cashierReleased &&

        paymentEligible &&

        hasItems &&

        isPreparing &&

        [
          "preparing",
          "processing"
        ].includes(orderStatus);

      /* ----------------------------------
         SHIPPING ADDRESS
      ---------------------------------- */

      const shippingAddress = String(
        order.shipping_address ?? ""
      ).trim();

      /* ----------------------------------
         RETURN ORDER DETAILS
      ---------------------------------- */

      return {

        ...order,

        order_number:
          order.order_number || String(order.id),

        shipping_address:
          shippingAddress || null,

        inventory_items:
          items,

        inventory_preparation:
          preparationStatus,

        cashier_verified:
          cashierVerified,

        payment_eligible:
          paymentEligible,

        can_start_preparation:
          canStartPreparation,

        can_mark_ready:
          canMarkReady,

        is_ready_for_tracking:

          isReady &&

          cashierVerified &&

          paymentEligible &&

          !cashierReleased,

        has_tracking:
          Boolean(order.tracking_number)

      };

    });

    /* ==========================================
       RETURN INVENTORY ORDER LIST
    ========================================== */

    return res.json({

      success: true,

      orders,

      total: count ?? 0,

      page: p.page,

      limit: p.limit

    });

  })
);


/* ==========================================
   START / COMPLETE ORDER PREPARATION
========================================== */

router.patch(
  "/orders/:id/preparation",

  handle(async (req, res) => {

    const id = recordId(req.params.id);

    const {
      action,
      revision,
      checked
    } = objectBody(req);

    /* ----------------------------------
       VALIDATE ACTION
    ---------------------------------- */

    if (
      !["start", "ready"].includes(action)
    ) {

      throw invalid(
        "Invalid preparation action."
      );

    }

    /* ----------------------------------
       VALIDATE REVISION
    ---------------------------------- */

    if (
      !Number.isInteger(revision) ||
      revision < 0 ||
      revision >= 2147483647
    ) {

      throw invalid(
        "Invalid order revision. Refresh this page."
      );

    }

    /* ----------------------------------
       VALIDATE CHECKLIST
    ---------------------------------- */

    if (

      !Array.isArray(checked) ||

      checked.length > 200 ||

      checked.some(
        index =>
          !Number.isInteger(index) ||
          index < 0 ||
          index >= 200
      ) ||

      new Set(checked).size !== checked.length

    ) {

      throw invalid(
        "Send a valid item checklist."
      );

    }

    /* ----------------------------------
       READY ACTION REQUIRES CHECKED ITEMS
    ---------------------------------- */

    if (
      action === "ready" &&
      checked.length === 0
    ) {

      throw invalid(
        "Check all ordered items before completing preparation."
      );

    }

    /* ==========================================
       GET CURRENT ORDER DETAILS
    ========================================== */

    const {
      data: order,
      error: orderError
    } = await supabase

      .from("orders")

      .select(
        [
          "id",
          "status",
          "payment_method",
          "payment_status",
          "cashier_verified_at",
          "cashier_released_at",
          "inventory_preparation",
          "inventory_revision",
          "inventory_items",
          "inventory_prepared_at"
        ].join(",")
      )

      .eq("id", id)

      .maybeSingle();

    if (orderError) {
      throw orderError;
    }

    if (!order) {

      throw invalid(
        "Order not found."
      );

    }

    /* ----------------------------------
       CASHIER VERIFICATION REQUIRED
    ---------------------------------- */

    if (!order.cashier_verified_at) {

      throw invalid(
        "This order must be verified by the cashier first."
      );

    }

    /* ----------------------------------
       BLOCK RELEASED ORDERS
    ---------------------------------- */

    if (order.cashier_released_at) {

      throw invalid(
        "This order has already been released."
      );

    }

    /* ----------------------------------
       NORMALIZE CURRENT STATUS
    ---------------------------------- */

    const orderStatus = String(
      order.status || ""
    ).trim().toLowerCase();

    const preparationStatus = String(
      order.inventory_preparation || "Queued"
    ).trim().toLowerCase();

    const paymentMethod = String(
      order.payment_method || ""
    ).trim().toLowerCase();

    const paymentStatus = String(
      order.payment_status || ""
    ).trim().toLowerCase();

    /* ----------------------------------
       PAYMENT ELIGIBILITY
    ---------------------------------- */

    const paymentEligible =

      paymentMethod === "cod" ||

      (
        paymentMethod === "paypal" &&
        paymentStatus === "paid"
      );

    if (!paymentEligible) {

      throw invalid(
        "Payment confirmation is required."
      );

    }

    /* ----------------------------------
       VALIDATE CURRENT REVISION
    ---------------------------------- */

    if (
      revision !== order.inventory_revision
    ) {

      throw invalid(
        "Order changed. Please refresh this page."
      );

    }

    /* ----------------------------------
       GET SAVED INVENTORY ITEMS
    ---------------------------------- */

    let items = order.inventory_items;

    if (typeof items === "string") {

      try {
        items = JSON.parse(items);
      } catch {
        items = [];
      }

    }

    if (
      !Array.isArray(items) ||
      items.length === 0 ||
      items.length > 200
    ) {

      throw invalid(
        "Valid saved inventory items are required."
      );

    }

    /* ==========================================
       START PREPARATION VALIDATION
    ========================================== */

    if (action === "start") {

      if (
        ![
          "pending",
          "preparing",
          "processing"
        ].includes(orderStatus)
      ) {

        throw invalid(
          "This order cannot enter preparation."
        );

      }

      if (
        preparationStatus !== "queued" ||
        order.inventory_prepared_at
      ) {

        throw invalid(
          "This order is not queued for preparation."
        );

      }

    }

    /* ==========================================
       MARK READY VALIDATION
    ========================================== */

    if (action === "ready") {

      if (
        ![
          "preparing",
          "processing"
        ].includes(orderStatus)
      ) {

        throw invalid(
          "Start preparation before marking this order ready."
        );

      }

      if (
        preparationStatus !== "preparing" ||
        order.inventory_prepared_at
      ) {

        throw invalid(
          "This order is not currently being prepared."
        );

      }

      const checkedItems =
        new Set(checked);

      const allItemsChecked =

        checkedItems.size === items.length &&

        items.every(
          (_, index) =>
            checkedItems.has(index)
        );

      if (!allItemsChecked) {

        throw invalid(
          "All ordered items must be checked."
        );

      }

    }

    /* ==========================================
       SAVE PREPARATION USING SUPABASE RPC

       The RPC must enforce these validations
       and update both statuses atomically.
    ========================================== */

    const {
      data,
      error
    } = await supabase.rpc(

      "jcn_inventory_prepare",

      {

        p_order_id: id,

        p_action: action,

        p_revision: revision,

        p_checked: checked,

        p_actor: req.inventoryActor

      }

    );

    if (error) {
      throw error;
    }

    /* ----------------------------------
       RETURN SUCCESS
    ---------------------------------- */

    return res.json({

      success: true,

      message:

        action === "ready"

          ? "Order is ready for shipment."

          : "Order preparation started.",

      preparation:
        data?.preparation

    });

  })
);

  /* ==========================================
     UNKNOWN INVENTORY ENDPOINT
  ========================================== */

  router.use((req, res) => {

    return res.status(404).json({
      success: false,
      message: "Inventory endpoint not found."
    });

  });

  /* ==========================================
     EXPORT INVENTORY ROUTER
  ========================================== */

  return router;

};
