// JCN Personal Fit Studio 2.0 — focused step workspace layout.
// Presentation-only DOM relocation. Product, BodyFit preview, artwork, and order state
// remain owned by their existing controllers; no checkout or database mutation.
(() => {
  const $ = id => document.getElementById(id);
  const editor = $('editorPanel');
  const center = document.querySelector('.center-panel');
  const header = document.querySelector('.site-header');
  const guidance = $('bottomGuidance');
  const summary = document.querySelector('.order-panel');
  if (!editor || !center || !header || !guidance || !summary) return;

  const required = ['shirtPanel', 'bodyfitPanel', 'designPanel', 'reviewPanel', 'designStage', 'cameraStage'];
  if (required.some(id => !$(id))) {
    console.warn('JCN focus workspace: a required stage is missing; original layout retained.');
    return;
  }

  const focus = document.createElement('div');
  focus.className = 'jcn-focus-main';
  focus.id = 'jcnFocusMain';
  const work = document.createElement('section');
  work.className = 'jcn-focus-content';
  work.setAttribute('aria-label', 'Current customization step');
  const preview = document.createElement('section');
  preview.className = 'jcn-focus-preview';
  preview.setAttribute('aria-label', 'Clothing and fit preview');
  focus.append(work, preview);

  // Move the original, functioning nodes. Do not clone: existing event handlers,
  // selection state, and element IDs must remain the same.
  for (const id of ['shirtPanel','bodyfitPanel','designPanel','reviewPanel']) {
    work.append($(id));
  }
  preview.append($('designStage'), $('cameraStage'));
  center.insertBefore(focus, guidance);

  // Product hero stays visible even when the long catalog chooser is collapsed.
  const shirtPanel=$('shirtPanel');
  const hero=document.createElement('div');
  hero.className='jcn-focus-product-hero';
  hero.id='jcnFocusProductHero';
  const heroImage=document.createElement('img');
  heroImage.src='../assets/studio-shirt-placeholder.svg';
  heroImage.alt='Selected JCN apparel';
  heroImage.onerror=()=>{heroImage.onerror=null;heroImage.src='../assets/studio-shirt-placeholder.svg';};
  const heroInfo=document.createElement('div');
  heroInfo.className='jcn-focus-product-info';
  const heroKicker=document.createElement('small');
  heroKicker.textContent='CURRENT APPAREL';
  const heroTitle=document.createElement('strong');
  heroTitle.textContent='Choose an apparel';
  const heroDetails=document.createElement('span');
  heroDetails.textContent='Select an available JCN product to begin.';
  const heroPrice=document.createElement('b');
  heroPrice.textContent='Base price not selected';
  const heroChange=document.createElement('button');
  heroChange.type='button';
  heroChange.textContent='Change Apparel';
  heroChange.className='jcn-focus-change-apparel';
  heroChange.addEventListener('click',()=>{
    const browse=$('jcnV2Browse');
    if(browse){
      browse.open=true;
      browse.scrollIntoView({block:'nearest',behavior:'smooth'});
      $('catalogSearch')?.focus();
    }
  });
  heroInfo.append(heroKicker,heroTitle,heroDetails,heroPrice,heroChange);
  hero.append(heroImage,heroInfo);
  const heroAnchor=shirtPanel?.querySelector('.section-title-row');
  if(heroAnchor)heroAnchor.after(hero);
  function updateHero(){
    const selected=window.JCNStudio3DBridge?.selection?.();
    if(!selected){
      heroImage.src='../assets/studio-shirt-placeholder.svg';
      heroTitle.textContent='Choose an apparel';
      heroDetails.textContent='Select an available JCN garment.';
      heroPrice.textContent='Base price not selected';
      return;
    }
    heroTitle.textContent=selected.name||'Selected JCN garment';
    heroDetails.textContent=[selected.category,selected.size,selected.color].filter(Boolean).join(' · ');
    heroImage.src=selected.image||'../assets/studio-shirt-placeholder.svg';
    heroPrice.textContent=$('basePrice')?.textContent||'Price pending';
  }
  window.addEventListener('jcn:studio3d-selection',updateHero);
  updateHero();

  const intro = document.createElement('div');
  intro.className = 'jcn-focus-step-intro';
  intro.innerHTML = '<span>YOUR WORKFLOW</span><strong>Personal Fit Studio</strong><small>Make one decision at a time.</small>';
  const stepList = editor.querySelector('.steps-list');
  if (stepList) editor.insertBefore(intro, stepList);

  const contextual = document.createElement('div');
  contextual.className = 'jcn-focus-preview-label';
  contextual.id = 'jcnFocusPreviewLabel';
  preview.prepend(contextual);

  const basket = document.createElement('button');
  basket.type = 'button';
  basket.className = 'jcn-focus-summary-toggle';
  basket.id = 'jcnFocusSummaryToggle';
  basket.setAttribute('aria-controls','jcnFocusSummary');
  basket.setAttribute('aria-expanded','false');
  basket.innerHTML = '<span aria-hidden="true">▤</span> Order Summary';
  const actions = header.querySelector('.header-actions');
  if (actions) actions.prepend(basket);
  summary.id = 'jcnFocusSummary';
  const close = document.createElement('button');
  close.type='button';close.className='jcn-focus-summary-close';
  close.setAttribute('aria-label','Close order summary');
  close.textContent='Close ×';
  summary.prepend(close);
  const veil = document.createElement('div');
  veil.className='jcn-focus-summary-veil';
  veil.hidden=true;
  document.body.append(veil);

  function closeSummary() {
    document.body.classList.remove('jcn-focus-show-summary');
    basket.setAttribute('aria-expanded','false');
    veil.hidden=true;
  }
  function openSummary() {
    document.body.classList.add('jcn-focus-show-summary');
    basket.setAttribute('aria-expanded','true');
    veil.hidden=false;
    close.focus();
  }
  basket.addEventListener('click',()=>{
    if(document.body.classList.contains('jcn-focus-show-summary')) closeSummary();
    else openSummary();
  });
  close.addEventListener('click',()=>{closeSummary();basket.focus();});
  veil.addEventListener('click',closeSummary);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && document.body.classList.contains('jcn-focus-show-summary')) {
      closeSummary();basket.focus();
    }
  });

  // Reuse existing navigation and event dispatch. No second step-controller state.
  const names = {
    shirt: {name:'01 / SHIRT',title:'Choose apparel and sizes',helper:'Select your garment, colors, and quantities.'},
    bodyfit: {name:'02 / BODYFIT',title:'Find your fit',helper:'Camera guidance or manual measurements.'},
    design: {name:'03 / DESIGN',title:'Personalize your clothing',helper:'Your current design preview is preserved.'},
    review: {name:'04 / REVIEW',title:'Review your choices',helper:'Confirm garments and variants before ordering.'}
  };
  const top = document.createElement('div');
  top.className='jcn-focus-workspace-head';
  top.innerHTML='<div><span id="jcnFocusStepTag"></span><h2 id="jcnFocusStepTitle"></h2><p id="jcnFocusStepHelper"></p></div>';
  center.prepend(top);

  const hideInside = editor.querySelector('.editor-intro');
  if (hideInside) hideInside.setAttribute('data-jcn-focus-hidden','true');

  function showStep(step) {
    const key = Object.hasOwn(names,step) ? step : 'shirt';
    const item = names[key];
    document.body.dataset.jcnFocusStep = key;
    focus.dataset.jcnFocusStep = key;
    $('jcnFocusStepTag').textContent=item.name;
    $('jcnFocusStepTitle').textContent=item.title;
    $('jcnFocusStepHelper').textContent=item.helper;
    contextual.textContent=key==='bodyfit'
      ? 'BODYFIT WORKSPACE · CAMERA COMING IN PHASE 2'
      : key==='design'
        ? 'DESIGN PREVIEW · EXACT PRINT MAPPING COMING LATER'
        : key==='review'
          ? 'PRODUCT PREVIEW · THIS DOES NOT PLACE AN ORDER'
          : 'GARMENT PREVIEW · AVATAR TRY-ON';
    closeSummary();
    if (typeof work.scrollTo === 'function') work.scrollTo({top:0,behavior:'instant'});
    else work.scrollTop=0;
    if (typeof center.scrollTo === 'function') center.scrollTo({top:0,behavior:'instant'});
  }

  window.addEventListener('jcn:studio3d-step',event=>showStep(event.detail?.step));

  // Do not let direct clicking of the progress rail bypass selection validation.
  // Navigate back to Shirt instead of silently accepting an incomplete order.
  document.addEventListener('click',event=>{
    const target=event.target.closest('.step-card[data-step]');
    if(!target || target.dataset.step==='shirt')return;
    if(window.JCNStudioPhase1State?.canContinue?.())return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const status=$('jcnV2Status');
    if(status){
      status.textContent='Please choose shirt variants and validate garment availability before continuing.';
      status.dataset.type='error';
    }
    const shirtButton=document.querySelector('.step-card[data-step="shirt"]');
    if(shirtButton && !shirtButton.classList.contains('active'))shirtButton.click();
    const selector=$('jcnV2Add');
    if(selector && typeof selector.scrollIntoView==='function')
      selector.scrollIntoView({block:'nearest',behavior:'smooth'});
  },true);

  const selected=document.querySelector('.step-card.active');
  showStep(selected?.dataset.step||'shirt');
  document.body.classList.add('jcn-focused-studio');

  // Phase 1 clearly separates preview functionality from real checkout.
  if ($('reviewButton')) {
    $('reviewButton').disabled=true;
    $('reviewButton').title='Checkout integration is not available in this Phase 1 preview.';
  }
})();
