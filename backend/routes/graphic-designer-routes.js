
const crypto = require("crypto");

module.exports = function registerGraphicDesignerRoutes({
  app,
  supabase,
  verifyStaffToken,
  allowRoles,
  verifyCustomerToken
}) {
  if (
    typeof verifyStaffToken !== "function" ||
    typeof allowRoles !== "function" ||
    typeof verifyCustomerToken !== "function"
  ) {
    throw new Error(
      "Graphic Designer requires staff and customer authentication middleware."
    );
  }

  const TABLE = "graphic_design_requests";
  const BUCKET = "jcn-design-previews";

  const STATUSES = [
    "Submitted",
    "In Review",
    "Revision Requested",
    "Finalized"
  ];

  const staffAuth = [
    verifyStaffToken,
    allowRoles("graphic_designer")
  ];

  function validUUID(id) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      String(id || "")
    );
  }

  function fail(res, status, message) {
    return res.status(status).json({
      success: false,
      message
    });
  }

  function serverError(res, error) {
    console.error("DESIGNER ERROR:", error);
    return fail(
      res,
      500,
      "Graphic Designer request failed. Check server logs."
    );
  }

  async function signedUrl(path) {
    if (!path) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600);

    if (error) throw error;
    return data.signedUrl;
  }

  async function withUrls(row) {
    if (!row) return null;

    return {
      ...row,
      logo_url: await signedUrl(row.logo_path),
      customer_preview_url:
        await signedUrl(row.customer_preview_path),
      designer_preview_url:
        await signedUrl(row.designer_preview_path)
    };
  }

  async function getRequest(id) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  // =====================================================
  // CUSTOMER: SUBMIT CUSTOMIZATION DESIGN
  // =====================================================

  app.post(
    "/api/customer/design-requests",
    verifyCustomerToken,
    async (req, res) => {
      try {
        // This must come from a VERIFIED customer JWT,
        // not from req.body.
        const authUser =
          req.customer ||
          req.user ||
          req.auth;

        const userId =
          authUser?.id ||
          authUser?.user_id ||
          authUser?.sub;

        if (!validUUID(userId)) {
          return fail(
            res,
            401,
            "Valid customer authentication required."
          );
        }

        const {
          customer_name,
          customer_email,
          apparel_type,
          apparel_size,
          apparel_color,
          design_text,
          design_notes,
          design_data
        } = req.body;

        if (
          !customer_name?.trim() ||
          !apparel_type?.trim() ||
          !apparel_size?.trim() ||
          !apparel_color?.trim()
        ) {
          return fail(
            res,
            400,
            "Customer name, apparel, size and color are required."
          );
        }

        if (
          !design_data ||
          typeof design_data !== "object" ||
          Array.isArray(design_data)
        ) {
          return fail(
            res,
            400,
            "Valid customization design data is required."
          );
        }

        // Customer identity should ultimately come from
        // the authenticated database account.
        const payload = {
          user_id: userId,
          customer_name: customer_name.trim(),
          customer_email: customer_email || null,
          apparel_type: apparel_type.trim(),
          apparel_size: apparel_size.trim(),
          apparel_color: apparel_color.trim(),
          design_text: design_text || "",
          design_notes: design_notes || "",
          design_data,
          status: "Submitted"
        };

        const { data, error } = await supabase
          .from(TABLE)
          .insert(payload)
          .select("*")
          .single();

        if (error) throw error;

        return res.status(201).json({
          success: true,
          message: "Design submitted for review.",
          request: data
        });

      } catch (error) {
        return serverError(res, error);
      }
    }
  );

  // =====================================================
  // DESIGNER: LIST DESIGN REQUESTS
  // =====================================================

  app.get(
    "/api/graphic-designer/requests",
    ...staffAuth,
    async (req, res) => {
      try {
        const page = Math.max(
          1,
          parseInt(req.query.page, 10) || 1
        );

        const limit = 15;
        const offset = (page - 1) * limit;
        const status = String(req.query.status || "");

        if (status && !STATUSES.includes(status)) {
          return fail(res, 400, "Invalid status filter.");
        }

        let query = supabase
          .from(TABLE)
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false });

        if (status) {
          query = query.eq("status", status);
        }

        const { data, error, count } =
          await query.range(offset, offset + limit - 1);

        if (error) throw error;

        return res.json({
          success: true,
          requests: data || [],
          total: count || 0,
          page,
          limit
        });

      } catch (error) {
        return serverError(res, error);
      }
    }
  );

  // =====================================================
  // DESIGNER: VIEW ONE REQUEST
  // =====================================================

  app.get(
    "/api/graphic-designer/requests/:id",
    ...staffAuth,
    async (req, res) => {
      try {
        const { id } = req.params;

        if (!validUUID(id)) {
          return fail(res, 400, "Invalid request ID.");
        }

        const row = await getRequest(id);

        if (!row) {
          return fail(res, 404, "Design request not found.");
        }

        return res.json({
          success: true,
          request: await withUrls(row)
        });

      } catch (error) {
        return serverError(res, error);
      }
    }
  );

  // =====================================================
  // DESIGNER: UPLOAD DESIGN PREVIEW
  // =====================================================

  app.post(
    "/api/graphic-designer/requests/:id/preview",
    ...staffAuth,
    async (req, res) => {
      try {
        const { id } = req.params;

        if (!validUUID(id)) {
          return fail(res, 400, "Invalid request ID.");
        }

        const row = await getRequest(id);

        if (!row) {
          return fail(res, 404, "Design not found.");
        }

        if (row.status === "Finalized") {
          return fail(
            res,
            409,
            "Finalized designs cannot be modified."
          );
        }

        const imageData = String(
          req.body.image_data || ""
        );

        const match = imageData.match(
          /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/
        );

        if (!match) {
          return fail(
            res,
            400,
            "A PNG preview is required."
          );
        }

        const buffer = Buffer.from(match[1], "base64");

        if (
          buffer.length === 0 ||
          buffer.length > 5 * 1024 * 1024 ||
          buffer.subarray(0, 8).toString("hex") !==
            "89504e470d0a1a0a"
        ) {
          return fail(
            res,
            400,
            "Invalid or oversized PNG image."
          );
        }

        const path =
          `${id}/designer-${crypto.randomUUID()}.png`;

        const { error: uploadError } =
          await supabase.storage
            .from(BUCKET)
            .upload(path, buffer, {
              contentType: "image/png",
              upsert: false
            });

        if (uploadError) throw uploadError;

        const { data, error } = await supabase
          .from(TABLE)
          .update({
            designer_preview_path: path,
            updated_at: new Date().toISOString()
          })
          .eq("id", id)
          .eq("revision", row.revision)
          .neq("status", "Finalized")
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          await supabase.storage
            .from(BUCKET)
            .remove([path]);

          return fail(
            res,
            409,
            "Design changed. Refresh and try again."
          );
        }

        return res.json({
          success: true,
          message: "Preview uploaded.",
          request: await withUrls(data)
        });

      } catch (error) {
        return serverError(res, error);
      }
    }
  );

  // =====================================================
  // DESIGNER: REVIEW / REQUEST REVISION / FINALIZE
  // =====================================================

  app.patch(
    "/api/graphic-designer/requests/:id",
    ...staffAuth,
    async (req, res) => {
      try {
        const { id } = req.params;

        if (!validUUID(id)) {
          return fail(res, 400, "Invalid request ID.");
        }

        const row = await getRequest(id);

        if (!row) {
          return fail(res, 404, "Design not found.");
        }

        if (row.status === "Finalized") {
          return fail(
            res,
            409,
            "This design has already been finalized."
          );
        }

        const {
          status,
          revision,
          designer_notes,
          design_data
        } = req.body;

        if (!STATUSES.includes(status)) {
          return fail(res, 400, "Invalid design status.");
        }

        if (
          !Number.isInteger(revision) ||
          revision !== row.revision
        ) {
          return fail(
            res,
            409,
            "Design was updated. Refresh first."
          );
        }

        if (
          !design_data ||
          typeof design_data !== "object" ||
          Array.isArray(design_data)
        ) {
          return fail(
            res,
            400,
            "Valid design data is required."
          );
        }

        if (
          status === "Revision Requested" &&
          !String(designer_notes || "").trim()
        ) {
          return fail(
            res,
            400,
            "Please provide revision instructions."
          );
        }

        if (
          status === "Finalized" &&
          !row.designer_preview_path
        ) {
          return fail(
            res,
            400,
            "Upload the designer preview before finalizing."
          );
        }

        const staff =
          req.staff ||
          req.user ||
          req.auth ||
          {};

        const designer =
          staff.full_name ||
          staff.username ||
          staff.sub ||
          "Graphic Designer";

        const updates = {
          status,
          designer_notes: String(
            designer_notes || ""
          ).slice(0, 2000),
          design_data,
          assigned_designer: String(designer),
          revision: row.revision + 1,
          updated_at: new Date().toISOString(),
          finalized_at:
            status === "Finalized"
              ? new Date().toISOString()
              : null
        };

        const { data, error } = await supabase
          .from(TABLE)
          .update(updates)
          .eq("id", id)
          .eq("revision", row.revision)
          .neq("status", "Finalized")
          .select("*")
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          return fail(
            res,
            409,
            "Request changed. Refresh and try again."
          );
        }

        return res.json({
          success: true,
          message:
            status === "Finalized"
              ? "Design finalized successfully."
              : "Design review saved successfully.",
          request: await withUrls(data)
        });

      } catch (error) {
        return serverError(res, error);
      }
    }
  );
};
