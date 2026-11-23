// JCN Personal Fit Studio 2.0 — Phase 1 selection controls, preview only.
(() => {
  const $ = id => document.getElementById(id);
  if (!$('shirtPanel') || !window.JCNStudio3DBridge) return;
  const API = ['127.0.0.1','localhost'].includes(location.hostname) && location.port !== '5000'
    ? 'http://127.0.0.1:5000' : '';
  const money = x => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(x);
  const ui = document.createElement('section');
  ui.className = 'jcn-v2-selection';
  ui.innerHTML = '<div class="jcn-v2-head"><strong>Size &amp; Color Matrix</strong><small>One design • multiple garment variants</small></div>'+
    '<p class="jcn-v2-help">Choose size and color above, then add how many pieces. Inventory quantities are shared between colors until staff configures per-color stock.</p>'+
    '<div class="jcn-v2-chips-block"><div class="jcn-v2-pick-head"><strong>Choose Size</strong><span>Use size chart below if unsure</span></div><div class="jcn-v2-chips" id="jcnV2SizeChoices" role="group" aria-label="Select shirt size"></div></div>'+
    '<div class="jcn-v2-chips-block"><div class="jcn-v2-pick-head"><strong>Choose Color</strong><span>Live preview on shirt</span></div><div class="jcn-v2-colors" id="jcnV2ColorChoices" role="group" aria-label="Select shirt color"></div></div>'+
    '<div class="jcn-v2-add"><label>Pieces <input id="jcnV2AddQty" type="number" min="1" max="30" step="1" value="1"></label>'+
    '<button type="button" id="jcnV2Add">+ Add Variant</button></div>'+
    '<div id="jcnV2Variants" class="jcn-v2-variants" aria-live="polite"></div>'+
    '<div class="jcn-v2-totals"><span>Total <b id="jcnV2Count">0 pcs</b></span><span>Garment subtotal <b id="jcnV2Sum">₱0.00</b></span></div>'+
    '<button type="button" id="jcnV2Check" class="jcn-v2-check">Validate Garment Selection</button>'+
    '<p id="jcnV2Status" class="jcn-v2-status" role="status">No order is created or stock reserved.</p>'+
    '<details class="jcn-v2-chart" open><summary>Size Chart (cm) &amp; Availability</summary><div id="jcnV2Chart"></div></details>'+
    '<div class="jcn-v2-fabric"><b>Garment Details</b><p id="jcnV2Info">Select a product to see its description.</p></div>'+
    '<p class="jcn-v2-disclaimer">Printing prices and checkout are not included in this Phase 1 preview. Actual color-specific stock requires a future database change.</p>';
  $('jcnStockHint').after(ui);
  // Keep product browsing available, but let customers collapse the catalog after choosing.
  // This moves the size/color matrix above the fold without replacing the approved JCN layout.
  const catalogPicker=document.createElement('details');
  catalogPicker.className='jcn-v2-browse';
  catalogPicker.id='jcnV2Browse';
  catalogPicker.open=true;
  const pickerTitle=document.createElement('summary');
  pickerTitle.textContent='Browse / Change JCN Apparel';
  catalogPicker.append(pickerTitle);
  const categoryFilter=$('apparelCategoryFilter');
  categoryFilter.before(catalogPicker);
  for(const id of ['apparelCategoryFilter','categoryResultCount','catalogSearch','demoProductList','productEmptyState']) {
    const element=$(id);
    if(id==='categoryResultCount'||id==='catalogSearch')continue;
    if(id==='demoProductList'||id==='productEmptyState'||id==='apparelCategoryFilter')catalogPicker.append(element);
  }
  // The existing search/count row must move together with the product list.
  const filterRow=document.querySelector('.catalog-filter-row');
  if(filterRow)catalogPicker.insertBefore(filterRow,$('demoProductList'));
  const state={catalog:new Map(),productId:null,items:[],revision:0,validated:false};
  const selection = () => window.JCNStudio3DBridge.selection();
  const selectedProduct = () => state.catalog.get(selection()?.id);
  const sizes = p => Array.isArray(p?.sizes)?p.sizes.map(s=>({
    size:String(s?.size||''),qty:Math.max(0,Math.floor(Number(s?.qty)||0)),
    length:Number(s?.length),width:Number(s?.width),sleeve:Number(s?.sleeve)
  })).filter(s=>s.size):[];
  const price = p => Number.isFinite(Number(p?.base_price))?Number(p.base_price):null;
  const stockFor = (p,size) => sizes(p).find(s=>s.size===size)?.qty||0;
  const used = (size,skip=-1) => state.items.reduce((n,x,i)=>n+(i!==skip&&x.size===size?x.quantity:0),0);
  const all = () => state.items.reduce((n,x)=>n+x.quantity,0);
  function say(message,type='neutral'){$('jcnV2Status').textContent=message;$('jcnV2Status').dataset.type=type;}
  function dirty(){state.revision++;state.validated=false;say('Selection changed. Validate again to confirm live stock and garment price.');}
  // Phase 1 variants are the sole source of truth for the quantity shown in the summary.
  // Legacy single-item quantity is visual only and cannot create an order on this page.
  function refreshSummary(){
    const p=selectedProduct();
    const count=all();
    const uniqueSizes=[...new Set(state.items.map(item=>item.size))];
    const uniqueColors=[...new Set(state.items.map(item=>item.color))];
    $('summarySize').textContent=uniqueSizes.length===1?uniqueSizes[0]:uniqueSizes.length?uniqueSizes.length+' sizes':'Not selected';
    $('summaryColor').textContent=uniqueColors.length===1?uniqueColors[0]:uniqueColors.length?uniqueColors.length+' colors':'Not selected';
    $('qtySummary').textContent='×'+count;
    $('orderQty').value=String(count);
    $('garmentSubtotal').textContent=p&&price(p)!==null?money(price(p)*count):'—';
    $('itemPrice').textContent=p&&price(p)!==null?money(price(p)):'—';
    $('increaseQty').disabled=true;
    $('decreaseQty').disabled=true;
    $('orderQty').readOnly=true;
    $('orderQty').setAttribute('aria-label','Total pieces from Shirt size and color variants');
    $('totalPrice').textContent='Pending';
  }
  function refreshReview(){
    const holder=$('jcnV2ReviewDetails');
    if(!holder)return;
    holder.replaceChildren();
    const p=selectedProduct(),heading=document.createElement('h3');
    heading.textContent=p?.title||'No apparel selected';holder.append(heading);
    const list=document.createElement('ul');
    for(const x of state.items){const li=document.createElement('li');li.textContent=x.size+' / '+x.color+' / '+x.quantity+' pcs';list.append(li);}
    holder.append(list);
    const note=document.createElement('p');
    note.textContent=(p&&state.items.length?all()+' pieces · '+money(price(p)*all())+' garment-only subtotal. ':'No variants chosen. ')+
      (state.validated?'Selection was validated. ':'Selection is not validated. ')+'This does not reserve stock or create an order.';
    holder.append(note);
  }
  function refresh(){
    const holder=$('jcnV2Variants'),p=selectedProduct();holder.replaceChildren();
    if(!state.items.length){const empty=document.createElement('p');empty.textContent='No sizes/colors added yet.';holder.append(empty);}
    state.items.forEach((v,i)=>{
      const row=document.createElement('div');row.className='jcn-v2-row';
      const desc=document.createElement('span');desc.textContent=v.size+' · '+v.color+' (size stock '+stockFor(p,v.size)+')';
      const qty=document.createElement('input');qty.type='number';qty.min='1';qty.max='30';qty.step='1';qty.value=v.quantity;
      qty.setAttribute('aria-label','Quantity '+v.size+' '+v.color);
      qty.addEventListener('change',()=>{
        const n=Number(qty.value);
        if(!Number.isInteger(n)||n<1||n+used(v.size,i)>stockFor(p,v.size)||all()-v.quantity+n>30){
          qty.value=v.quantity;say('Quantity exceeds available size stock or the 30-piece preview limit.','error');return;
        }
        v.quantity=n;dirty();refresh();
      });
      const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove this variant';
      remove.addEventListener('click',()=>{state.items.splice(i,1);dirty();refresh();});
      row.append(desc,qty,remove);holder.append(row);
    });
    $('jcnV2Count').textContent=all()+' pcs';
    $('jcnV2Sum').textContent=p&&price(p)!==null?money(price(p)*all()):'—';
    $('jcnV2Add').disabled=!p;
    $('jcnV2Check').disabled=!p||!state.items.length;
    $('nextToDesign').disabled=!p||!state.items.length||!state.validated;
    $('nextToDesign').title=state.validated?'Proceed to BodyFit':'Add variants and validate selection before continuing';
    refreshSummary();
    refreshReview();
    renderRightVariants();
  }
  function renderRightVariants(){
    const summary=$('jcnV2RightVariants');
    if(!summary)return;
    summary.replaceChildren();
    if(!state.items.length){
      const hint=document.createElement('p');
      hint.textContent='Choose sizes and colors in Step 01.';
      summary.append(hint);
      return;
    }
    const label=document.createElement('strong');label.textContent='Selected size & color breakdown';
    summary.append(label);
    const list=document.createElement('ul');
    for(const item of state.items){
      const li=document.createElement('li');
      const name=document.createElement('span');name.textContent=item.size+' · '+item.color;
      const count=document.createElement('b');count.textContent=item.quantity+' pcs';
      li.append(name,count);list.append(li);
    }
    summary.append(list);
  }
  const SWATCHES={
    'black':'#18191b','white':'#eeeeeb','navy blue':'#233a56','red':'#b4363d',
    'maroon':'#733042','blue':'#3272a9','gray':'#888888','grey':'#888888',
    'army green':'#57684d','mustard':'#c99d39','pink':'#e8aeb7',
    'dark green':'#31543d','brown':'#815c45','mint':'#95c9ae','cream':'#e4ddc9',
    'rust':'#ab6141','taupe':'#a28b78','deep royal':'#305cc9'
  };
  function changeVariantChoice(id,value){
    const el=$(id);if(!el||el.value===value)return;
    el.value=value;
    // The legacy selector remains the authoritative 3D-bridge source.
    el.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function renderQuickOptions(p){
    const sizeBox=$('jcnV2SizeChoices'),colorBox=$('jcnV2ColorChoices');
    sizeBox.replaceChildren();colorBox.replaceChildren();
    if(!p)return;
    const selectedSize=$('shirtSize').value;
    const selectedColor=$('shirtColor').value;
    for(const item of sizes(p)){
      const button=document.createElement('button');
      button.type='button';button.textContent=item.size;
      button.className='jcn-v2-size-chip'+(item.size===selectedSize?' is-active':'');
      button.disabled=item.qty<=0;
      button.setAttribute('aria-pressed',String(item.size===selectedSize));
      button.title=item.qty>0?item.qty+' pieces available across all colors':'Out of stock';
      button.addEventListener('click',()=>changeVariantChoice('shirtSize',item.size));
      sizeBox.append(button);
    }
    for(const color of (p.colors||[])){
      const button=document.createElement('button');button.type='button';
      button.className='jcn-v2-color-chip'+(color===selectedColor?' is-active':'');
      const swatch=document.createElement('span');
      swatch.className='jcn-v2-swatch';swatch.style.background=SWATCHES[color.toLowerCase()]||'#777a7c';
      const name=document.createElement('span');name.textContent=color;
      button.append(swatch,name);
      button.setAttribute('aria-pressed',String(color===selectedColor));
      button.addEventListener('click',()=>changeVariantChoice('shirtColor',color));
      colorBox.append(button);
    }
  }
  function chart(p){
    const box=$('jcnV2Chart');box.replaceChildren();
    if(!p){box.textContent='Select an apparel first.';return;}
    const table=document.createElement('table'),tr=table.createTHead().insertRow();
    for(const label of ['Size','Stock','Length','Width','Sleeve']){
      const th=document.createElement('th');th.textContent=label;tr.append(th);
    }
    const tbody=table.createTBody();
    for(const s of sizes(p)){
      const row=tbody.insertRow();
      [s.size,s.qty,s.length,s.width,s.sleeve].forEach((val,i)=>{
        const cell=row.insertCell();
        cell.textContent=i>=2?(Number.isFinite(val)&&val>0?val+' cm':'—'):String(val);
      });
    }
    box.append(table);
    const info=document.createElement('small');info.textContent='— means measurements have not been configured by JCN staff.';box.append(info);
  }
  function sync(){
    const id=selection()?.id||null,p=selectedProduct();
    if(id!==state.productId){state.productId=id;state.items=[];dirty();}
    chart(p);
    renderQuickOptions(p);
    $('jcnV2Info').textContent=p?(p.description||'Fabric composition, GSM and fit have not been configured for this garment.'):'Select an apparel to view its description.';
    refresh();
  }
  async function load(){
    say('Loading approved JCN products…');
    try{
      const r=await fetch(API+'/api/customer/studio/catalog',{cache:'no-store'});
      const data=await r.json();
      if(!r.ok||!data.success)throw Error(data.message||'Catalog unavailable');
      state.catalog=new Map((data.products||[]).map(p=>[String(p.id),p]));
      sync();say('Choose size/color combinations above and add the number of pieces.');
    }catch(e){say('Could not load the product details: '+e.message+'. Start the local Node server.','error');}
  }
  $('jcnV2Add').addEventListener('click',()=>{
    const p=selectedProduct(),size=$('shirtSize').value,color=$('shirtColor').value;
    const quantity=Number($('jcnV2AddQty').value);
    if(!p||!p.colors.includes(color)||!Number.isInteger(quantity)||quantity<1||quantity>30||
       used(size)+quantity>stockFor(p,size)||all()+quantity>30){
      say('Invalid size/color/quantity, insufficient size stock, or more than 30 pieces.','error');return;
    }
    const exists=state.items.find(x=>x.size===size&&x.color===color);
    if(exists)exists.quantity+=quantity;
    else state.items.push({size,color,quantity});
    dirty();refresh();
  });
  $('jcnV2Check').addEventListener('click',async()=>{
    const p=selectedProduct();if(!p||!state.items.length)return;
    const revision=++state.revision;
    say('Validating live garment stock and base price…');
    try{
      const r=await fetch(API+'/api/customer/studio/selection-preview',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({product_id:p.id,variants:state.items.map(x=>({...x}))})
      });
      const data=await r.json().catch(()=>({}));
      if(revision!==state.revision)return;
      if(!r.ok||!data.valid)throw Error(data.message||'Validation unavailable');
      state.validated=true;
      say('Validated '+data.total_quantity+' garments. Garment-only subtotal: '+money(data.garment_subtotal)+'. Stock is not reserved.','success');
    }catch(e){if(revision===state.revision){state.validated=false;say('Validation failed: '+e.message+'. Do not proceed to checkout.','error');}}
    refresh();
  });
  $('reviewButton').disabled=true;
  $('reviewButton').textContent='Checkout in Later Phase';
  $('reviewButton').title='Phase 1 preview only; cart integration is planned in a later phase.';
  document.addEventListener('click',e=>{
    if(e.target.closest('#demoProductList .demo-product')){
      setTimeout(()=>{
        sync();
        catalogPicker.open=false;
        const target=$('selectedProductName');
        if(target)target.scrollIntoView({block:'nearest',behavior:'smooth'});
      },0);
    }
    if(e.target.closest('[data-step="review"],#nextToBodyfit'))setTimeout(refreshReview,0);
  });
  // The original catalog can complete after our own catalog request.
  // Subscribe to its selection event so initial auto-selection is reflected immediately.
  window.addEventListener('jcn:studio3d-selection',sync);
  $('shirtSize').addEventListener('change',()=>setTimeout(sync,0));
  $('shirtColor').addEventListener('change',()=>setTimeout(sync,0));
  // Prevent the old one-size quantity control from overwriting a multi-variant summary.
  for(const id of ['increaseQty','decreaseQty','orderQty']){
    const old=$(id);
    old.setAttribute('title','Edit quantities in Step 01 · Size & Color Matrix');
  }
  refreshSummary();
  load();
})();