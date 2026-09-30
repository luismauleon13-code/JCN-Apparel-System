"use strict";

const express = require("express");

module.exports = function createInventoryRouter({
  supabase,
  verifyStaffToken
}) {
  if (!supabase || typeof verifyStaffToken !== "function") {
    throw new Error(
      "Inventory routes require supabase and verifyStaffToken."
    );
  }

  const router = express.Router();

  const allowedRoles = new Set([
    "inventory_staff",
    "admin"
  ]);

  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const normalize = value =>
    String(value ?? "").trim().toLowerCase();

  const invalid = message =>
    Object.assign(new Error(message), { status: 400 });

  // Error responses
  function failure(res, error) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        message: error.message
      });
    }

    if (error.code === "P0001") {
      const conflict = /changed|transition/i.test(error.message);

      return res.status(conflict ? 409 : 400).json({
        success: false,
        message: error.message
      });
    }

    console.error(
      "Inventory API error:",
      error.code || "",
      error.message
    );

    let message =
      "Inventory request failed. Check the server terminal for details.";

    if (["42501", "PGRST301"].includes(error.code)) {
      message =
        "Inventory database access denied. Check the backend Supabase privileged key and SQL grants.";
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
        "Inventory database setup is missing or outdated. Check the SQL migration and Supabase project.";
    }

    return res.status(500).json({
      success: false,
      message
    });
  }

  // Async route wrapper
  const handle = fn => async (req, res) => {
    try {
      await fn(req, res);
    } catch (error) {
      failure(res, error);
    }
  };

  // Pagination
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

  function recordId(value) {
    if (
      typeof value !== "string" ||
      !uuid.test(value)
    ) {
      throw invalid("Invalid record ID.");
    }

    return value;
  }

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

  // Disable caching
  router.use((req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });

  // Verify JWT using middleware from server.js
  router.use(verifyStaffToken);

  // Verify current account permissions in the database
  router.use(async (req, res, next) => {
    try {
      if (
        !req.staff ||
        !allowedRoles.has(normalize(req.staff.role)) ||
        !uuid.test(String(req.staff.id || ""))
      ) {
        return res.status(403).json({
          success: false,
          message: "Inventory staff or admin access is required."
        });
      }

      const {
        data: account,
        error
      } = await supabase
        .from("admin_users")
        .select("id,username,full_name,role,status")
        .eq("id", req.staff.id)
        .maybeSingle();

      if (error) throw error;

      if (!account) {
        return res.status(401).json({
          success: false,
          message: "Account no longer exists. Please log in again."
        });
      }

      if (
        !allowedRoles.has(normalize(account.role)) ||
        normalize(account.status) !== "active"
      ) {
        return res.status(403).json({
          success: false,
          message:
            "Your account must be active and authorized for inventory."
        });
      }

      // Actor comes from the verified database account.
      req.inventoryActor =
        `${account.full_name || account.username || "Staff"} (${account.id})`;

      next();
    } catch (error) {
      failure(res, error);
    }
  });

  // GET /api/inventory/products
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
        .order("title", { ascending: true })
        .order("id", { ascending: true })
        .range(p.from, p.to);

      if (error) throw error;

      res.json({
        success: true,
        products: data || [],
        total: count ?? 0,
        page: p.page,
        limit: p.limit
      });
    })
  );

  // POST /api/inventory/products/:id/adjust
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

      if (!["add", "remove", "set"].includes(mode)) {
        throw invalid("Invalid stock movement.");
      }

      if (
        !Number.isInteger(amount) ||
        amount < 0 ||
        amount > 1000000 ||
        (mode !== "set" && amount === 0)
      ) {
        throw invalid(
          "Quantity must be a whole number from 1 to 1000000 (zero is allowed for physical count)."
        );
      }

      if (
        !Number.isInteger(expected) ||
        expected < 0 ||
        expected > 2147483647
      ) {
        throw invalid(
          "Invalid current stock. Refresh this page."
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

      const { data, error } = await supabase.rpc(
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

      if (error) throw error;

      res.json({
        success: true,
        message: "Stock and history saved.",
        adjustment: data
      });
    })
  );

  // GET /api/inventory/history
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
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(p.from, p.to);

      if (error) throw error;

      res.json({
        success: true,
        history: data || [],
        total: count ?? 0,
        page: p.page,
        limit: p.limit
      });
    })
  );

  // GET /api/inventory/orders
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
          "id,customer_name,payment_method,payment_status,status,inventory_items,inventory_preparation,inventory_revision,inventory_prepared_by,inventory_prepared_at,created_at",
          { count: "exact" }
        )
        .in("status", ["Preparing", "Processing"])
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .range(p.from, p.to);

      if (error) throw error;

      res.json({
        success: true,
        orders: data || [],
        total: count ?? 0,
        page: p.page,
        limit: p.limit
      });
    })
  );

  // PATCH /api/inventory/orders/:id/preparation
  router.patch(
    "/orders/:id/preparation",
    handle(async (req, res) => {
      const id = recordId(req.params.id);

      const {
        action,
        revision,
        checked
      } = objectBody(req);

      if (!["start", "ready"].includes(action)) {
        throw invalid("Invalid preparation action.");
      }

      if (
        !Number.isInteger(revision) ||
        revision < 0 ||
        revision >= 2147483647
      ) {
        throw invalid(
          "Invalid order revision. Refresh this page."
        );
      }

      if (
        !Array.isArray(checked) ||
        checked.length > 200 ||
        checked.some(
          i => !Number.isInteger(i) || i < 0 || i >= 200
        ) ||
        new Set(checked).size !== checked.length
      ) {
        throw invalid("Send a valid item checklist.");
      }

      const { data, error } = await supabase.rpc(
        "jcn_inventory_prepare",
        {
          p_order_id: id,
          p_action: action,
          p_revision: revision,
          p_checked: checked,
          p_actor: req.inventoryActor
        }
      );

      if (error) throw error;

      res.json({
        success: true,
        message: "Preparation saved.",
        preparation: data?.preparation
      });
    })
  );

  // Unknown inventory endpoint
  router.use((req, res) => {
    res.status(404).json({
      success: false,
      message: "Inventory endpoint not found."
    });
  });

  return router;
};