# JCN PERSONAL FIT STUDIO 2.0
## PHASE 1 — FINAL FOCUSED WORKSPACE UI STRUCTURE
Status: Focused layout committed on development branch; awaiting actual browser and responsive acceptance tests  
Target branch: `feature/personal-fit-studio-v2`  
Existing production customer page: **must remain unchanged** until complete testing and approval.

### 1. Design principles

1. **One primary task per step**. Do not display unrelated editing, body scanning, pricing or production widgets simultaneously.
2. **Progressive disclosure**. Secondary features open on demand as a drawer, popover, modal or accordion. Remove visual clutter, not functionality.
3. **Preserve the JCN identity**: near-black surfaces, restrained gold accent, large readable headings, subtle borders, clean product photography. Gold is for active state and the single primary CTA.
4. **A single source of truth**: selected product and variants determine 3D preview, stock warnings, summary quantities and garment-only subtotal. A different preview or subtotal must not imply checkout readiness.
5. **Real capability labels only**: BodyFit camera, texture/UV print placement, cloud drafts, export, and Add to Cart are not implemented here. Use clearly disabled or labeled preview states; never show an active action that cannot work.
6. **3D avatar is retained**. On the Shirt step the selected garment preview is prominent; the avatar is available as a toggle rather than always occupying the same visual priority. Avatar is central in BodyFit/Try-On and Design contexts.
7. **Safe integration**: do not modify main branch, orders, payments, production permissions, or Supabase tables in this UI redesign.

### 2. Site shell

#### Desktop >= 1200px
- **Navigation rail (64–84 px)**: existing JCN main navigation, icons only, expandable on hover / focus.
- **Header (64–72 px)**: JCN Personal Fit Studio, current-step breadcrumb, compact **My Drafts** (disabled/labeled if preview only), one overflow menu for Focus / Export; no row of equally prominent action buttons.
- **Step rail (220–260 px)**: one concise numbered step at a time. 01 Shirt; 02 BodyFit; 03 Design; 04 Review. Active step gold, completed step check only if complete; pending step neutral. Do NOT place catalog and tool controls underneath this rail.
- **Focus workspace (flex 1, minimum usable 560px)**: the active step's specific workspace, not a permanently mixed 3D viewer.
- **Contextual summary (250–300 px)**: brief selected product, variant count, pieces, and garment-only subtotal. Hidden/condensed on narrow screens; expanded full pricing only in Review.

Desktop width below 1200 px: replace always-open contextual summary with a slide-out **Order Summary** drawer; preserve workspace width and avoid overlapping the 3D scene.

#### Mobile <= 720px
- Compact progress pill (e.g. 01 / 04), horizontal step navigation, one active workspace panel.
- Product/catalog chooser fills a sheet/page; full-screen size chips, swipeable product photos, minimum 44×44 px targets.
- Sticky bottom action bar: one CTA and compact basket/summary count. Expand basket into a bottom sheet.
- Editor/3D/Avatar controls use switchable tabs (not side-by-side); user-selected elements, selections and drafts must persist across view changes.
- Sticky main navigation must not cover buttons or modals.

### 3. Exact visibility matrix

| Component | 01 Shirt | 02 BodyFit | 03 Design | 04 Review |
|---|---|---|---|---|
| Step rail and progress | Yes | Yes | Yes | Yes |
| Apparel catalog and search | On-demand chooser | Hidden | Hidden | Hidden, Edit link |
| Size/color controls | Main focus | Context only | Context only | Read only |
| Variant quantity matrix | Main focus | Compact total | Compact total | Full breakdown |
| 3D garment/Avatar | Main preview + mode toggle | Avatar/fit guidance | Live 3D + avatar toggle | Front/back/side proofs |
| BodyFit camera/manual controls | Hidden | Main focus | Hidden | Fit summary |
| Text/logo/layers editor | Hidden | Hidden | On-demand tools panel | Hidden |
| Printing charges/details | Hidden | Hidden | Context only | Quote status; no invented final price |
| Sticky summary | Minimal | Minimal | Minimal | Expanded |
| Primary CTA | Continue to BodyFit | Continue to Design | Continue to Review | Preview complete / checkout disabled until integrated |

### 4. Step 01 — Shirt: complete Phase 1 functional scope

**Workspace layout**:
- Top: `01 / CHOOSE APPAREL` label; heading *Choose the clothing you'll personalize.*; short help.
- Main left/top: selected product hero card with photo or 3D garment front/back, category, title and real base price. **Change Apparel** launches catalog drawer.
- Catalog chooser opens with search and category chips; product rows show image, title, category, price, available size count. Choosing a product closes the chooser and returns focus to the hero.
- Main right/below: clear **Size & Color** area, one-click size chips, named color swatches with selected states, disabled unavailable choices, collapsed **Size Chart** (measurements from real catalog).
- Below: **Add Variant** with quantity and a dedicated list of selected size/color/qty rows. Duplicate entries merge; edits, removals and product swaps invalidate server validation; show precise stock errors.
- One subtle information line: stock is currently tracked per size *across* colors, not per size-color combination; do not claim otherwise.
- **Validate Selection** is a secondary control; show last-confirmed garment-only subtotal, no reservation, no payment.
- **Continue to BodyFit** is the sole primary CTA, enabled only after successful server validation and positive quantity.
- On product switch, make selection reset explicit; do not silently carry incompatible variants into a new product.
- Use a single source of truth for right summary and Review. Remove legacy quantity stepper from the active selection workflow.

**Selected product fields**: id, canonical category, title, description, image, sizes and stock, available colors, current base price, sale state. Fabric composition, GSM and fit descriptor only when staff-configured; do not invent measurements or attributes.

**Phase 1 exclusion**: true garment-fit accuracy, UV print bounds, cart insertion, actual payment, pre-reserving stock, bulk discounts and per-color stock need dedicated later phases.

### 5. Step 02 — BodyFit

- Dedicated camera/fit workspace when Phase 2 actually connects the MediaPipe scanner; provide an explicit **Manual Sizing** option and later permission/failure states.
- For Phase 1, retain labeled preview and manual form, with no fake scans or scan success claims.
- User can skip body scanning when purchasing multiple sizes; BodyFit is an advisory size recommendation, not an order blocker.
- Separate *suggested fit for one wearer* from the multi-size order variant matrix. Do not overwrite multiple ordered sizes automatically.
- Primary CTA is **Continue to Design**.

### 6. Step 03 — Design

- Main Split 2D+3D workspace only after that engine exists; toggle **2D Editor / 3D Garment / Avatar**. Retain front/back and print-zone state.
- Design tools open in a drawer that does not obscure the entire garment. Text, Image, Elements, Layers; secondary controls collapse by default.
- In Phase 1, preserve existing design preview and mark limitations. Hide inactive design controls from other steps.
- Primary CTA **Continue to Review**.

### 7. Step 04 — Review

- Present final product choice, variant rows and quantities; BodyFit result if available, artwork preview and print scope.
- Financial summary clearly separates garment-only subtotal from *printing charges to be quoted* and any configured fees; **never show a fake final total**.
- Offer **Edit Shirt / Edit Fit / Edit Design** links back to steps without clearing design state.
- No enabled production purchase button until the backend order/cart and payment checks are integrated. Current Phase 1 uses **Preview Complete — Checkout Coming Later**, not a deceptive checkout CTA.
- A future checkout must validate inventory and current price again server-side before creating an order.

### 8. Visual system

- Background #0B0D10; surfaces #17191D and #202227; thin borders #3A3D42.
- Gold accent #EFC15B for active state, focused control, and primary CTA; body text #F4F4F1; secondary text #B5B7BD.
- Headings use the existing brand typography; body a readable sans-serif. Avoid more than two font families and avoid 9px key labels.
- Consistent spacing 8/12/16/24; controls >= 40px on desktop and >= 44px mobile; 10–16px card radius.
- Avoid giant background words, floating tool panels and multiple gold buttons in the same viewport.
- Use skeleton/empty/error states for loading and backend unavailability. If no garment is available, don't show a purchasable placeholder.
- Accessibility: semantic headings, `aria-current`/step states, focus management on chooser open/close, meaningful labels, keyboard escape, reduced motion, preserved tab order.

### 9. Implementation blueprint (small, testable changes)

1. **Shell restructure**: split step navigation from step content using a focused workspace element while preserving existing element IDs used by JS. Keep header and left navigation brand assets.
2. **Shirt view**: move catalog to modal/drawer; selected product card and size/color controls to main focus pane; 3D remains optional preview on this step. Reuse `/api/customer/studio/catalog`.
3. **Single state**: preserve the existing `jcn-studio-v2-phase1.js` variant list and `/api/customer/studio/selection-preview` validation. Do not duplicate pricing calculations in another state object.
4. **Contextual summary**: make right summary mode-aware; hide design and final pricing labels before relevant steps; use read-only variant totals.
5. **Step controllers**: update `selectStep`, form navigation, focus and scroll restoration; avoid hidden controls intercepting clicks.
6. **Mobile polish**: drawer/bottom sheet, adaptive workspace width, touch-friendly selector, preview fallback.
7. **Regression**: run existing mocked tests, then desktop/mobile browser tests with backend running, then verify original `customer-customize.html` unaffected. Keep prod `main` unchanged.

### 10. Acceptance criteria — Phase 1 cannot be marked complete until

- [ ] On entering 01 Shirt, user immediately sees the active apparel and variant controls without scrolling through unrelated features.
- [ ] Change Apparel chooser opens/closes; search/category filter works; selection syncs to 3D product preview.
- [ ] Size/color selection is keyboard accessible and stock-aware; across-color size stock limits remain correctly enforced.
- [ ] Multiple variants aggregate into a single garment-only estimate; no stale quantity in Review or summary.
- [ ] Validating against current backend works; invalid/changed selections cannot proceed as though validated.
- [ ] Switching steps does not discard variants or design state; moving back from Review returns to the prior selection.
- [ ] Mobile 360–430px has no horizontal scrolling or obscured primary action.
- [ ] Camera/demo/design/export/checkout features are clearly identified and do not pretend to function before integration.
- [ ] HTML, CSS, JS and API errors are checked in an actual browser (not just mocked tests).
- [ ] Existing production customer customization and payment flow remain untouched.
- [ ] Production security assessment and restore test are resolved before any merge/deployment.

**Design decision approved:** the Focused Step Workspace is the Phase 1 visual direction. Exact pixel values above are starting specifications that can be adjusted after browser screenshots and responsive testing.

### Implementation snapshot — 2026-11-24

- Added `customer/js/jcn-studio-v2-focus-layout.js`: moves the original step content nodes into a dedicated focus workspace without cloning or renaming the existing inputs; retains 3D and camera stage nodes, plus adaptive order-summary drawer.
- Added `customer/css/jcn-studio-v2-focus-layout.css`: responsive editorial-style step rail, contextual center workspace, minimized right summary, mobile layout.
- Added selected-garment hero in Step 01 with thumbnail, name, current price, and on-demand Change Apparel chooser. Existing size chips, color swatches, variant matrix and read-only stock validation are retained.
- Progress-rail navigation now checks the validated Phase 1 selection and returns user to Shirt instead of skipping it.
- `tests/jcn-studio-v2-focus-layout.test.js` added with Node mocked-DOM regression cases. Other Phase 1 variant/backend regression suites remain in `tests/`.
- Static JavaScript syntax and markup reference checks passed; simulated focus-step interaction checks passed. **Real browser rendering, mobile screenshots, keyboard accessibility, WebGL resizing, and live API integration are still pending.**
- The latest source remains an **isolated test page**, not the active live customer customization or production checkout.
