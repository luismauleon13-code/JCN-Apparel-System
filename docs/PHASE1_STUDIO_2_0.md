# JCN Personal Fit Studio 2.0 — Phase 1 Preview

Branch: `feature/personal-fit-studio-v2`  
Standalone URL (local Live Server): `/customer/html/jcn-customize-v2-phase1.html`

## Added without changing the live customer page
- Same black/gold structure, new navigation plan: 01 Shirt → 02 BodyFit → 03 Design → 04 Review.
- Read-only dynamic customizable apparel catalog from the existing `/api/customer/studio/catalog` endpoint.
- Product size chart (length/width/sleeve), selected style, and garment description.
- Multi-size/color entries per master design, with quantity change/removal.
- Compact collapsible apparel chooser; one-click size chips and live garment color swatches.
- Order summary and Review reflect selected size/color variants (not the legacy one-item quantity stepper).
- BodyFit continuation is gated on successful read-only validation; no production checkout is available.
- Sum stock across colors **per size**, because the existing schema has no per-size/per-color stock combination.
- Garment-only subtotal estimate, and read-only validation against real product price and size stock through `POST /api/customer/studio/selection-preview`.
- Non-ordering review panel, with separate Phase 1 preview state.
- Neutral local SVG fallback in place of missing Phase 1 reference images.

## Deliberately NOT done in Phase 1
- Checkout, cart, stock reservation, paid transactions, or order creation.
- Actual color-variant inventory schema, new price/discount rules, automated production pricing.
- BodyFit camera integration; current Phase 1 page still uses the previous illustrative camera UI.
- True split 2D/3D print editor, exact UV print mapping, and avatar body measurement-driven fitting.
- Cloud draft storage and final production export. Existing draft handling remains an old UI preview.
- Live database security remediation and restore drill — those remain pending.

## Local test instructions
1. In VS Code, run `git status`, then (only when clean) `git pull origin feature/personal-fit-studio-v2`.
2. Start the Node backend at port 5000 with existing configured environment variables (do not commit `.env`).
3. Open `http://127.0.0.1:5500/customer/html/jcn-customize-v2-phase1.html` via Live Server.
4. Pick a staff-enabled blank apparel. If the catalog is empty, the legacy route requires `JCN_CUSTOM_PRODUCT_IDS` or `JCN_CUSTOM_TSHIRT_PRODUCT_ID` to contain its product UUID. Do not turn on all shop products automatically.
5. Check size chart measurements, variant additions, duplicate size/color aggregation, per-size aggregate stock limits, and 30-piece temporary preview limit.
6. Click **Validate Garment Selection**, confirm garment subtotal, and confirm that stock is NOT reserved and checkout is disabled.
7. Check the preview on desktop and mobile. Check that the original `customer-customize.html` still behaves as before.

## Important
The connected Supabase security advisor reported exposed public tables without row-level security; do **not** deploy this branch to production until the pending security work, local browser tests, and role/permission audit are complete. The GitHub branch is isolated from production only while it is not merged and not deployed as the production branch.

## Regression checks
- Run `node --test tests/jcn-studio-selection-preview.test.js` to check the pure mocked backend before browser verification.
- Open Step 01; confirm the active garment and color options. Choose a product to collapse the catalog, expand **Browse / Change JCN Apparel** to change it.
- Add S Black ×2 and M White ×3 (if the product has sufficient stock); verify right summary shows 5 pieces and both rows.
- Click Validate; if the local backend is running, only valid stock is accepted and the Continue to BodyFit button becomes available.
- Confirm selecting a different product clears incompatible variants. The 3D GLB remains a preview; it is not a physically validated virtual fit.
- Verify responsive layout, front/back model controls, and 04 Review. Cart remains intentionally disabled.
