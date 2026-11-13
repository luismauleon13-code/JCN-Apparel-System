// JCN Studio V5 — visual composition only; preserves original 3D, camera, draft, and cart handlers.
(() => {
  if (window.__jcnStudioV5) return;
  window.__jcnStudioV5 = true;

  const $ = id => document.getElementById(id);
  const make = (tag, cls, content) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (content !== undefined) node.textContent = content;
    return node;
  };

  function init() {
    const editor = document.querySelector('.studio-editor');
    const summary = document.querySelector('.studio-summary');
    const center = document.querySelector('.studio-center');
    const panel = document.querySelector('.model-panel');
    if (!editor || !summary || !center || !panel || !$('viewer')) return;
    document.body.classList.add('jcn-v5-ready');
    document.body.classList.remove('jcn-focus-mode');
    localStorage.setItem('jcn-focus-preference', 'off');

    // The original step buttons retain their event listeners. Only restyle their layout.
    const stepIcons = {shirt:'fa-shirt', design:'fa-image', you:'fa-person'};
    const stepText = {shirt:'Choose your real T-shirt', design:'Add text, logo or artwork', you:'Find your recommended size'};
    const steps = document.querySelector('.steps');
    if (steps) {
      for (const button of steps.querySelectorAll('[data-step]')) {
        if (button.querySelector('.jcn-v5-step-icon')) continue;
        const kind = button.dataset.step;
        const label = button.textContent.trim();
        button.textContent = '';
        const mark = make('span', 'jcn-v5-step-icon');
        const ico = make('i', 'fa-solid ' + (stepIcons[kind] || 'fa-circle'));
        ico.setAttribute('aria-hidden', 'true');
        mark.append(ico);
        const copy = make('span', 'jcn-v5-step-copy');
        copy.append(make('strong', '', label),make('small', '', stepText[kind] || ''));
        const arrow = make('i', 'fa-solid fa-chevron-right jcn-v5-step-arrow');
        arrow.setAttribute('aria-hidden','true');
        button.append(mark, copy, arrow);
      }
    }

    const headline = editor.querySelector('h1');
    if (headline) headline.innerHTML = 'Design your<br><em>own apparel.</em>';
    const subtitle = editor.querySelector('.hero-subtitle');
    if (subtitle) subtitle.textContent = 'Choose, personalize and preview your real JCN clothing in 3D.';

    // Move existing Three.js view buttons (not clones!) into a floating toolbar.
    const toolbar = center.querySelector('.viewer-toolbar');
    if (toolbar && toolbar.parentElement !== panel) {
      toolbar.classList.add('jcn-v5-floating-tools');
      panel.insertBefore(toolbar, panel.firstChild);
    }
    const viewLabel = $('viewLabel');
    if (viewLabel) viewLabel.setAttribute('aria-hidden','true');

    const heading = make('div', 'jcn-v5-model-title');
    heading.append(make('span', 'jcn-v5-eyebrow', 'JCN 3D APPAREL STUDIO'),make('strong','', 'Live customization preview'));
    panel.insertBefore(heading, panel.firstChild);

    // Interactive front/back thumbnails reuse the original buttons.
    const views = make('div','jcn-v5-view-cards');
    const viewCards = {};
    for (const [value, label, icon] of [['front','Front view','fa-shirt'],['back','Back view','fa-shirt']]) {
      const b = make('button','jcn-v5-view-card');
      b.type = 'button'; b.setAttribute('aria-label','Show '+label);
      const pict = make('span','jcn-v5-view-pict');
      const i = make('i','fa-solid '+icon);i.setAttribute('aria-hidden','true'); pict.append(i);
      b.append(pict,make('span','',label));
      b.addEventListener('click',() => center.querySelector('.viewer-toolbar [data-view="'+value+'"]')?.click());
      views.append(b); viewCards[value] = b;
    }
    const syncViews = () => {
      const active = center.querySelector('.viewer-toolbar [data-view].active')?.dataset.view || 'front';
      for (const [key, b] of Object.entries(viewCards)) {
        b.classList.toggle('is-active', key === active);
        b.setAttribute('aria-pressed',String(key === active));
      }
    };
    panel.addEventListener('click', event => {
      if (event.target.closest('[data-view]')) setTimeout(syncViews,0);
    });
    panel.insertAdjacentElement('afterend', views);
    syncViews();

    // The product overview is backed by real catalog selection; don't create sample prices.
    const summaryTitle = summary.querySelector('h2');
    if (summaryTitle) summaryTitle.textContent = 'Your creation.';
    const selected = $('jcnSelectedProduct');
    if (selected) selected.classList.add('jcn-v5-real-product');
    const existing = summary.querySelector('.product-summary');
    if (existing) existing.classList.add('jcn-v5-fallback-product');
    const syncProduct = () => {
      if (existing) existing.hidden = Boolean(window.JCNCustomProduct?.getSelected?.());
    };
    window.addEventListener('jcn:product-selected',syncProduct);
    window.addEventListener('jcn:product-unselected',syncProduct);
    syncProduct();

    // Keep price information and cart confirmation in their existing native controls.
    const total = summary.querySelector('.summary-total');
    if (total && !summary.querySelector('.jcn-v5-total-heading')) {
      total.parentElement.insertBefore(make('h3','jcn-v5-total-heading','Estimated total'),total);
    }
    const primary = $('jcnCustomAddCart');
    if (primary) primary.classList.add('jcn-v5-cart-cta');

    // Camera is already moved by the V3 experience handler; V5 only changes presentation.
    const modal = $('jcnCameraWorkspace');
    if (modal) {
      modal.classList.add('jcn-v5-bodyfit-workspace');
      const h = modal.querySelector('h2');
      if (h) h.textContent = 'Live Body Scan';
      const p = modal.querySelector('header p');
      if (p) p.textContent = 'Position your shoulders and hips clearly in frame. Capture front, then side. The size recommendation is an estimate.';
      const portal = $('jcnCameraPortal');
      if (portal && !modal.querySelector('.jcn-v5-live-tag')) {
        const live = make('div','jcn-v5-live-tag','●  LIVE BODYFIT');
        portal.append(live);
      }
      const returnBtn = $('jcnReturn3D');
      if (returnBtn) returnBtn.textContent = 'Continue to 3D Avatar  →';
    }

    const focus = $('jcnFocusToggle');
    if (focus) {
      focus.textContent = '⛶ Expand preview';
      // Do not hijack existing click behavior; expanded preview stays opt-in.
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();
