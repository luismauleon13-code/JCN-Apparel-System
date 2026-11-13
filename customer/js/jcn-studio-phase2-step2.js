// JCN PERSONAL FIT STUDIO — PHASE 2 STEP 2 — REAL APPAREL CATALOG + APPROVED UI
// Standalone integration test: live apparel catalog + realistic T-shirt GLB. Camera/cart remain UI previews.
// Direct shirt placement mode is an editable reference; the live GLB displays approximate front/back print planes, NOT true UV placement.
(() => {
  const $ = id => document.getElementById(id);
  const money = value => value == null ? 'To be priced' : new Intl.NumberFormat('en-PH', {style:'currency', currency:'PHP'}).format(value);
  const draftKey = 'jcnStudioPhase2CatalogDraft'; // retain Step 1 draft compatibility
  const categories = ['All', 'T-Shirt', 'Hoodie', 'Polo Shirt', 'Sweatshirt'];
  // Real products come from the server. Never show demo garments as purchasable items.
  let products = [];
  let catalogLoading = true;
  let catalogError = null;
  const LOCAL_BACKEND = ['localhost','127.0.0.1'].includes(location.hostname)
    && location.port !== '5000';
  const API_BASE = LOCAL_BACKEND ? 'http://127.0.0.1:5000' : '';
  const fallbackImage = '../assets/phase1/white-shirt.svg';
  function canonicalCategory(value) {
    const v = String(value || '').toLowerCase().replace(/[ _-]+/g,' ').trim();
    if (v === 't shirt' || v === 'tee' || v === 'tshirt') return 'T-Shirt';
    if (v === 'hoodie') return 'Hoodie';
    if (v === 'polo shirt' || v === 'polo') return 'Polo Shirt';
    if (v === 'sweatshirt' || v === 'crewneck') return 'Sweatshirt';
    return '';
  }
  function safeImage(value) {
    const url = String(value || '').trim();
    return /^https:\/\//i.test(url) ? url : fallbackImage;
  }
  function normalizeProduct(row) {
    if (!row || !row.id || !canonicalCategory(row.category)) return null;
    const colors = Array.isArray(row.colors) ? [...new Set(row.colors.map(v=>String(v).trim()).filter(Boolean))] : [];
    const details = Array.isArray(row.sizes) ? row.sizes : [];
    const sizeStock = {};
    for (const entry of details) {
      const size = String(typeof entry === 'string' ? entry : entry?.size || '').trim();
      const qty = Number(typeof entry === 'string' ? 0 : entry?.qty);
      if (size) sizeStock[size] = Math.max(0, Number.isFinite(qty) ? Math.floor(qty) : 0);
    }
    const sizes = Object.keys(sizeStock).filter(size=>sizeStock[size]>0);
    const p = Number(row.base_price ?? row.price);
    if (!sizes.length || !colors.length || !Number.isFinite(p) || p<0) return null;
    return {
      id:String(row.id), category:canonicalCategory(row.category),
      name:String(row.title || 'Untitled apparel'), desc:String(row.description || '').slice(0,250),
      base:p, image:safeImage(row.image || row.product_image), colors, sizes, sizeStock
    };
  }
  async function loadCatalog() {
    catalogLoading = true; catalogError = null; renderCatalog();
    try {
      const res = await fetch(API_BASE + '/api/customer/studio/catalog', {
        headers: {Accept:'application/json'}, cache:'no-store'
      });
      const data = await res.json().catch(()=>({}));
      if (!res.ok || !data.success) throw new Error((data.message || 'Catalog endpoint is unavailable') + ' (HTTP '+res.status+')');
      products = (Array.isArray(data.products) ? data.products : []).map(normalizeProduct).filter(Boolean);
      catalogLoading = false;
      if (!products.length) {
        resetProductUI(); renderCatalog();
        showToast('No blank apparel has been enabled for customization yet.');
        return;
      }
      const preselect = products.some(p=>p.id===state.product) ? state.product : products[0].id;
      selectProduct(preselect);
    } catch (error) {
      catalogLoading = false; catalogError = error.message;
      products = [];
      resetProductUI(); renderCatalog();
      console.error('JCN real apparel catalog:',error);
    }
  }
  const state = {
    step:'shirt', category:'All', product:null, size:'M', color:'White', placement:'back', angle:'back', qty:1,
    fitMethod:'auto', fitPreference:'Regular', manual:{}, layers:{front:[], back:[]}, selectedId:null, nextId:1
  };
  // Read-only app bridge: GLB renderer reads selected apparel and design layers.
  // No Supabase secrets or editing state are exposed.
  window.JCNStudio3DBridge = {
    selection: () => {
      const p = currentProduct();
      return p ? {id:p.id,category:p.category,name:p.name,color:state.color,size:state.size,image:p.image} : null;
    },
    layers: () => ({ front:[...state.layers.front],back:[...state.layers.back] }),
    imageUrl: id => artImages.get(id) || null,
    view: () => state.angle,
    step: () => state.step
  };
  const emit3D = (type, detail) => window.dispatchEvent(new CustomEvent('jcn:studio3d-'+type, {detail}));
  const artImages = new Map();
  const undoStack = [], redoStack = [];
  let toastTimer = null, dragging = null;
  let dockOpen=true;
  const dockStage = () => $('designStage');
  function setDockOpen(open) {
    dockOpen=Boolean(open);
    dockStage().classList.toggle('dock-open',dockOpen);
    dockStage().classList.toggle('dock-closed',!dockOpen);
    $('reopenDesignDock').setAttribute('aria-expanded',String(dockOpen));
    $('closeDesignDock').setAttribute('aria-expanded',String(dockOpen));
    $('openInspectorFromTools').textContent=dockOpen?'Design Tools are open →':'Open Design Tools →';
    $('reopenDesignDock').querySelector('span').textContent=dockOpen?'Hide Tools':'Design Tools';
  }
  function showDockSection(id) {
    setDockOpen(true);
    for(const key of ['textAccordion','artworkAccordion','elementsAccordion','layersAccordion']) {
      $(key).open=(key===id);
      const button=document.querySelector('[data-dock-section="'+key+'"]');
      button?.classList.toggle('active',key===id);
    }
    const element=$(id);
    if(element) {
      const scroller=$('dockScroll');
      // Scroll INSIDE the right-side design dock, never the entire page.
      const nextTop=element.getBoundingClientRect().top-scroller.getBoundingClientRect().top+scroller.scrollTop;
      scroller.scrollTo({top:nextTop-175,behavior:'smooth'});
    }
  }

  const activeSide = () => state.placement === 'both' ? (state.angle === 'front' ? 'front' : 'back') : state.placement;
  const activeList = () => state.layers[activeSide()];
  const findSelected = () => activeList().find(layer => layer.id === state.selectedId);
  const currentProduct = () => products.find(product => product.id === state.product) || null;
  const showToast = message => {
    const toast = $('toast');toast.textContent = message;toast.classList.add('show');
    clearTimeout(toastTimer);toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
  };
  const showDialog = (title,message) => { $('dialogTitle').textContent=title;$('dialogText').textContent=message;$('demoDialog').showModal(); };
  function captureHistory() {
    undoStack.push(JSON.stringify(state.layers));
    if (undoStack.length>35) undoStack.shift();
    redoStack.length=0;
  }
  function updateUndoButtons() {
    $('undoLayer').disabled = undoStack.length===0;
    $('redoLayer').disabled = redoStack.length===0;
  }
  function renderCategories() {
    const box=$('apparelCategoryFilter');box.replaceChildren();
    categories.forEach(category=>{
      const b=document.createElement('button');b.type='button';b.textContent=category;
      b.className='category-chip'+(category===state.category?' active':'');b.setAttribute('aria-pressed',String(category===state.category));
      b.onclick=()=>{state.category=category;renderCategories();renderCatalog();};box.append(b);
    });
  }
  function renderCatalog() {
    const match=String($('catalogSearch').value||'').trim().toLowerCase();
    const found=products.filter(p=>(state.category==='All'||p.category===state.category) && (p.name+' '+p.desc).toLowerCase().includes(match));
    $('categoryResultCount').textContent=catalogLoading ? 'Loading…' : found.length+' style'+(found.length!==1?'s':'');
    const empty=$('productEmptyState');
    empty.hidden=found.length>0;
    empty.textContent=catalogLoading ? 'Loading JCN apparel from the shop…' :
      catalogError ? 'Unable to load the real catalog: '+catalogError+' Start the backend or check your Vercel deployment.' :
      !products.length ? 'No blank apparel is enabled for customization yet. Ask the shop administrator to activate a product.' :
      'No matching customizable apparel. Try another category or search.';
    const holder=$('demoProductList');holder.replaceChildren();
    found.forEach(p=>{
      const button=document.createElement('button');button.type='button';button.className='demo-product'+(state.product===p.id?' selected':'');
      button.setAttribute('aria-pressed',String(state.product===p.id));
      const img=document.createElement('img');img.src=p.image;img.alt=p.name;img.loading='lazy';
      img.onerror=()=>{img.onerror=null;img.src=fallbackImage;};
      const content=document.createElement('span');content.className='product-choice-copy';
      const title=document.createElement('strong');title.textContent=p.name;
      const desc=document.createElement('small');desc.textContent=p.desc || p.category;
      const price=document.createElement('em');price.textContent='Base price '+money(p.base)+' · '+p.sizes.length+' size'+(p.sizes.length>1?'s':'')+' in stock';
      content.append(title,desc,price);
      const tick=document.createElement('span');tick.className='select-tick';tick.textContent=state.product===p.id?'✓':'+';
      button.append(img,content,tick);button.onclick=()=>selectProduct(p.id);holder.append(button);
    });
  }
  function resetProductUI(){
    state.product=null;
    $('selectedProductName').textContent='No apparel selected';
    $('summaryProduct').textContent='Select an apparel';
    $('summaryImage').src=fallbackImage;
    $('summarySize').textContent='—';$('summaryColor').textContent='—';
    $('shirtSize').replaceChildren();$('shirtColor').replaceChildren();
    $('shirtSize').disabled=true;$('shirtColor').disabled=true;
    $('basePrice').textContent='Not selected';$('itemPrice').textContent='—';
    $('totalPrice').textContent='Pending';
    emit3D('selection', null);
    $('orderQty').max=1;
    const stock=$('jcnStockHint');if(stock)stock.textContent='Choose an available apparel to view stock.';
  }
  function availableStock(p,size) {
    return p ? Math.max(0,Number(p.sizeStock[size] || 0)) : 0;
  }
  function syncStock(){
    const p=currentProduct();if(!p)return;
    const stock=availableStock(p,state.size);
    const max=Math.min(30,stock); // checkout custom order has a max of 30 units
    $('orderQty').max=String(max);
    const label=$('jcnStockHint');if(label)label.textContent=stock+' available in size '+state.size;
    if(state.qty>max)setQty(max || 1);
    $('increaseQty').disabled=state.qty>=max;
    $('decreaseQty').disabled=state.qty<=1;
  }
  function selectProduct(id) {
    const next=products.find(p=>p.id===id);if(!next)return;
    state.product=id;
    if(!next.sizes.includes(state.size))state.size=next.sizes[0];
    if(!next.colors.includes(state.color))state.color=next.colors[0];
    const size=$('shirtSize'), color=$('shirtColor');size.replaceChildren();color.replaceChildren();
    size.disabled=false;color.disabled=false;
    for(const v of next.sizes){const opt=new Option(v,v);size.add(opt);}
    for(const v of next.colors){const opt=new Option(v,v);color.add(opt);}
    size.value=state.size;color.value=state.color;
    $('selectedProductName').textContent=next.name;
    $('summaryProduct').textContent=next.name;
    $('summaryImage').src=next.image;$('summaryImage').alt=next.name;
    $('summarySize').textContent=state.size;$('summaryColor').textContent=state.color;
    $('basePrice').textContent='Base price '+money(next.base);
    $('itemPrice').textContent=money(next.base);
    // The model is still the Phase 1.3 visual placeholder; do not imply correct garment mesh.
    const hint=$('jcnGarmentPreviewNote');
    if(hint)hint.textContent='Selected: '+next.name+' · '+next.category+'. T-Shirt uses real GLB; other apparel requires matching GLB. Print placement is approximate.';
    updateOrder();syncStock();renderCatalog();
    emit3D('selection', window.JCNStudio3DBridge.selection());
  }
  function updateOrder() {
    const p=currentProduct();
    $('summarySize').textContent=p?state.size:'—';
    $('summaryColor').textContent=p?state.color:'—';
    $('qtySummary').textContent='×'+state.qty;
    $('orderQty').value=state.qty;
    $('garmentSubtotal').textContent=p ? money(p.base*state.qty) : '—';
    $('totalPrice').textContent='Pending';
  }
  function setQty(value) {
    const n=Number(value),p=currentProduct();
    const max=p ? Math.min(30,availableStock(p,state.size)) : 1;
    state.qty=Number.isFinite(n)?Math.max(1,Math.min(max||1,Math.floor(n))):1;
    updateOrder();
    $('decreaseQty').disabled=state.qty<=1;
    $('increaseQty').disabled=!p || state.qty>=max;
  }
  function selectStep(step) {
    if(!['shirt','design','bodyfit'].includes(step))return;
    state.step=step;
    document.body.classList.toggle('design-step-active',step==='design');
    document.querySelectorAll('.step-card').forEach(button=>{
      const yes=button.dataset.step===step;button.classList.toggle('active',yes);button.setAttribute('aria-selected',String(yes));
    });
    document.querySelectorAll('[data-content]').forEach(content=>content.hidden=content.dataset.content!==step);
    const fit=step==='bodyfit';$('designStage').hidden=fit;$('cameraStage').hidden=!fit;
    emit3D('step',{step});
    $('bottomGuidance').querySelector('span').textContent=fit
      ? 'Next: Review your BodyFit settings. Camera and automatic fitting connect in a later phase; manual values stay in this preview only.'
      : 'Next: Choose your apparel and design both sides. A real 3D editor and final quotation will be connected after UI approval.';
    if(step==='bodyfit')renderFitMethod();
  }
  function renderPlacement() {
    document.querySelectorAll('.placement').forEach(b=>{b.classList.toggle('active',b.dataset.placement===state.placement);b.setAttribute('aria-pressed',String(b.dataset.placement===state.placement));});
    $('printSideName').textContent=(activeSide()==='front'?'Front':'Back')+' side · shirt preview';
    $('designType').textContent=(state.placement==='both'?'Front & back':state.placement==='front'?'Front':'Back')+' · preview layers';
    $('printSize').textContent='Print dimensions: decide later';
    renderLayers();
    emit3D('layers',null);
  }
  function setPlacement(value) {
    if(!['front','back','both'].includes(value))return;
    state.placement=value;
    state.selectedId=null;
    if(value==='front')setView('front',false);if(value==='back')setView('back',false);
    renderPlacement();
  }
  function setView(view,notify=true) {
    state.angle=view;
    document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
    if(state.placement==='both' && ['front','back'].includes(view))renderPlacement();
    emit3D('view',{view});
    if(notify && !window.JCNStudio3DReady) showToast('3D viewer is loading; angle preview will activate when ready.');
  }
  function selectLayer(id) {state.selectedId=id;setDockOpen(true);renderLayers();}
  function addLayer(kind,data={}) {
    window.JCNStudio3D?.setMode?.('placement');
    captureHistory();
    const layer={kind,x:50,y:50,scale:100,rotate:0,opacity:100,hidden:false,...data,id:state.nextId++,side:activeSide()};
    activeList().push(layer);state.selectedId=layer.id;renderLayers();
    return layer;
  }
  function escapeStr(s) {return String(s||'').trim();}
  function addText() {
    const val=escapeStr($('demoText').value)||'YOUR TEXT';
    const layer=addLayer('text',{name:val.slice(0,22),text:val,color:$('demoTextColor').value,font:$('demoFont').value});
    showToast('Text added to '+layer.side+' shirt preview. Drag to reposition.');
  }
  const shapeEntries=[{label:'Star',symbol:'★'},{label:'Heart',symbol:'♥'},{label:'Circle',symbol:'●'},{label:'Square',symbol:'■'},{label:'Arrow',symbol:'➜'},{label:'Spark',symbol:'✦'}];
  function renderShapes() {
    const holder=$('elementsGrid');holder.replaceChildren();
    shapeEntries.forEach(shape=>{
      const button=document.createElement('button');button.type='button';button.title='Add '+shape.label;
      button.innerHTML='<span></span><small></small>';button.querySelector('span').textContent=shape.symbol;
      button.querySelector('small').textContent=shape.label;
      button.onclick=()=>{addLayer('shape',{name:shape.label,symbol:shape.symbol,color:$('demoTextColor').value});showToast(shape.label+' added on the shirt preview.');};
      holder.append(button);
    });
  }
  function updateDesignSummary() {
    const count=state.layers.front.length+state.layers.back.length;
    const front=state.layers.front.length,back=state.layers.back.length;
    $('designText').textContent=count ? 'Front '+front+' layer'+(front!==1?'s':'')+' · Back '+back+' layer'+(back!==1?'s':'') : 'No design elements yet';
    $('layerCount').textContent=String(activeList().length);
  }
  function renderLayers() {
    const root=$('shirtPrintLayers'),list=$('layerList');root.replaceChildren();list.replaceChildren();
    const arr=activeList();
    arr.forEach((layer,index)=>{
      if(!layer.hidden){
        const item=document.createElement('button');item.type='button';item.className='art-layer'+(layer.id===state.selectedId?' is-selected':'');
        item.style.left=layer.x+'%';item.style.top=layer.y+'%';item.style.transform='translate(-50%, -50%) rotate('+layer.rotate+'deg) scale('+(layer.scale/100)+')';item.style.opacity=layer.opacity/100;
        item.dataset.layerId=String(layer.id);item.title='Drag '+layer.name+' to move it on shirt preview';
        if(layer.kind==='image'){
          const img=document.createElement('img');img.src=artImages.get(layer.id)||'';img.alt=layer.name;item.append(img);
        } else {
          const el=document.createElement('span');el.textContent=layer.kind==='text'?layer.text:layer.symbol;
          el.style.color=layer.color||'#17191b';el.style.fontFamily=layer.font||'Arial';
          if(layer.kind==='shape')el.className='mini-shape';item.append(el);
        }
        item.addEventListener('click',()=>selectLayer(layer.id));
        item.addEventListener('pointerdown',event=>{
          if(event.button!==0)return;
          state.selectedId=layer.id;
          document.querySelectorAll('.art-layer').forEach(el=>el.classList.toggle('is-selected',Number(el.dataset.layerId)===layer.id));
          const area=$('shirtPrintRegion').getBoundingClientRect();
          dragging={id:layer.id,startX:event.clientX,startY:event.clientY,x:layer.x,y:layer.y,width:area.width,height:area.height,moved:false};
          item.setPointerCapture(event.pointerId);
        });
        item.addEventListener('pointermove',event=>{
          if(!dragging||dragging.id!==layer.id)return;
          const dx=(event.clientX-dragging.startX)/dragging.width*100;
          const dy=(event.clientY-dragging.startY)/dragging.height*100;
          if(Math.abs(dx)+Math.abs(dy)>0.4)dragging.moved=true;
          layer.x=Math.max(8,Math.min(92,dragging.x+dx));
          layer.y=Math.max(9,Math.min(91,dragging.y+dy));
          item.style.left=layer.x+'%';item.style.top=layer.y+'%';
        });
        const end=()=>{
          if(!dragging||dragging.id!==layer.id)return;
          if(dragging.moved){
            const snapshot=JSON.parse(JSON.stringify(state.layers));
            const idx=snapshot[layer.side].findIndex(l=>l.id===layer.id);
            if(idx>=0){snapshot[layer.side][idx].x=dragging.x;snapshot[layer.side][idx].y=dragging.y;}
            undoStack.push(JSON.stringify(snapshot));if(undoStack.length>35)undoStack.shift();redoStack.length=0;
          }
          const clicked=!dragging.moved;
          dragging=null;
          if(clicked)setDockOpen(true);
          renderLayers();
        };
        item.addEventListener('pointerup',end);item.addEventListener('pointercancel',end);
        root.append(item);
      }
      const wrap=document.createElement('div');wrap.className='layer-row-wrap'+(layer.hidden?' layer-hidden':'');
      const row=document.createElement('button');row.type='button';row.className='layer-row'+(layer.id===state.selectedId?' active':'');
      const kind=document.createElement('span');kind.className='layer-kind';kind.textContent=layer.kind==='text'?'T':layer.kind==='shape'?'✦':'▧';
      const name=document.createElement('span');name.className='layer-name';name.textContent=layer.name;
      const pos=document.createElement('small');pos.textContent='#'+(index+1);
      row.append(kind,name,pos);
      row.onclick=()=>{if(layer.hidden){captureHistory();layer.hidden=false;}selectLayer(layer.id);};
      const toggle=document.createElement('button');toggle.type='button';toggle.className='layer-toggle';toggle.textContent=layer.hidden?'◌':'◉';toggle.title=layer.hidden?'Show '+layer.name:'Hide '+layer.name;toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-pressed',String(!layer.hidden));
      toggle.onclick=()=>{captureHistory();layer.hidden=!layer.hidden;if(layer.hidden && layer.id===state.selectedId)state.selectedId=null;renderLayers();showToast(layer.hidden?'Layer hidden. Restore it from Layers.':'Layer visible again.');};
      wrap.append(row,toggle);list.append(wrap);
    });
    if(!arr.length){const p=document.createElement('p');p.className='empty-layers';p.textContent='No '+activeSide()+' elements yet. Add Text or an Element.';list.append(p);}
    const selected=findSelected();$('elementProperties').hidden=!selected;
    $('dockEmptySelection').hidden=Boolean(selected);
    if(selected){
      $('selectedLayerName').textContent=selected.name;
      for(const [id,value,label] of [['elementSize',selected.scale,selected.scale+'%'],['elementRotation',selected.rotate,selected.rotate+'°'],['elementOpacity',selected.opacity,selected.opacity+'%']]){
        $(id).value=value;$(id+'Label').textContent=label;
      }
      if(selected.kind==='text'){$('demoText').value=selected.text;$('demoFont').value=selected.font;$('demoTextColor').value=selected.color;}
    }
    updateDesignSummary();updateUndoButtons();
    emit3D('layers',null);
  }
  function changeProperty(prop,value) {
    const selected=findSelected();if(!selected)return;
    selected[prop]=value;
    const dom=document.querySelector('.art-layer[data-layer-id="'+selected.id+'"]');
    if(!dom)return;
    dom.style.transform='translate(-50%, -50%) rotate('+selected.rotate+'deg) scale('+(selected.scale/100)+')';
    dom.style.opacity=selected.opacity/100;
    $('elementSizeLabel').textContent=selected.scale+'%';
    $('elementRotationLabel').textContent=selected.rotate+'°';
    $('elementOpacityLabel').textContent=selected.opacity+'%';
    emit3D('layers',null);
  }
  function reorder(direction) {
    const arr=activeList(),i=arr.findIndex(l=>l.id===state.selectedId);if(i<0)return;
    const target=i+direction;if(target<0||target>=arr.length)return;
    captureHistory();[arr[i],arr[target]]=[arr[target],arr[i]];renderLayers();
  }
  function undo() {
    if(!undoStack.length)return;
    redoStack.push(JSON.stringify(state.layers));state.layers=JSON.parse(undoStack.pop());state.selectedId=null;renderLayers();
  }
  function redo() {
    if(!redoStack.length)return;
    undoStack.push(JSON.stringify(state.layers));state.layers=JSON.parse(redoStack.pop());state.selectedId=null;renderLayers();
  }
  function renderFitMethod() {
    document.querySelectorAll('[data-fit-method]').forEach(b=>{const active=b.dataset.fitMethod===state.fitMethod;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
    $('autoFitSettings').hidden=state.fitMethod!=='auto';$('manualFitSettings').hidden=state.fitMethod!=='manual';
    $('manualStageFlag').hidden=state.fitMethod!=='manual';
    $('cameraStage').classList.toggle('manual-mode',state.fitMethod==='manual');
  }
  function saveManual(event) {
    event.preventDefault();
    const fields=[['height','fitHeight'],['chest','fitChest'],['waist','fitWaist'],['hip','fitHip'],['shoulder','fitShoulder']];
    const measure={};
    for(const [name,id] of fields){const element=$(id);if(element.value && !element.checkValidity()){element.reportValidity();return;}measure[name]=element.value ? Number(element.value) : null;}
    if(!Object.values(measure).some(v=>v!=null)){$('manualStatus').textContent='Enter at least one measurement first.';return;}
    state.manual=measure;state.fitPreference=$('fitPreference').value;
    $('manualStatus').textContent='✓ Manual measurements saved in this UI preview. No automatic size has been calculated.';
    showToast('Manual values recorded in this preview. No camera or server used.');
  }
  function cleanLayersForSave() {
    const filtered={front:[],back:[]};
    for(const side of ['front','back'])filtered[side]=state.layers[side].filter(l=>l.kind!=='image');
    return filtered;
  }
  function saveDraft() {
    try {
      const payload={...state,layers:cleanLayersForSave(),imageInfo:'Uploaded image previews are not saved in Phase 1.3 refined.',savedAt:Date.now()};
      localStorage.setItem(draftKey,JSON.stringify(payload));
      showToast('Phase 2 Step 2 draft saved locally. Artwork files must be reselected after reload.');
    } catch(error){showDialog('Draft not saved','Browser storage is unavailable. '+error.message);}
  }
  function restoreDraft() {
    let saved;try{saved=JSON.parse(localStorage.getItem(draftKey)||'null');}catch{saved=null;}
    if(!saved){showDialog('My Drafts','No Phase 1.3 refined draft yet. Save your UI preview to test restore. Production designs are unchanged.');return;}
    for(const key of ['step','category','product','size','color','placement','angle','qty','fitMethod','fitPreference','manual','nextId']){
      if(Object.hasOwn(saved,key))state[key]=saved[key];
    }
    state.layers=saved.layers&&Array.isArray(saved.layers.front)&&Array.isArray(saved.layers.back)?saved.layers:{front:[],back:[]};
    const all=state.layers.front.concat(state.layers.back);state.nextId=Math.max(state.nextId||1,...all.map(l=>l.id+1),1);state.selectedId=null;
    renderCategories();selectProduct(products.some(p=>p.id===state.product)?state.product:products[0]?.id);renderPlacement();setView(state.angle,false);setQty(state.qty);
    for(const [name,id] of [['height','fitHeight'],['chest','fitChest'],['waist','fitWaist'],['hip','fitHip'],['shoulder','fitShoulder']])$(id).value=state.manual?.[name]??'';
    $('fitPreference').value=state.fitPreference;
    $('manualStatus').textContent=Object.values(state.manual||{}).some(v=>v!=null)?'✓ Manual values restored from this browser (UI only).':'Not saved yet.';
    selectStep(state.step);showToast('Phase 2 Step 2 draft restored. Uploaded images are not retained.');
  }
  // -- Bind UI interactions --
  document.querySelectorAll('.step-card').forEach(b=>b.onclick=()=>selectStep(b.dataset.step));
  document.querySelectorAll('.placement').forEach(b=>b.onclick=()=>setPlacement(b.dataset.placement));
  document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  document.querySelectorAll('[data-fit-method]').forEach(b=>b.onclick=()=>{state.fitMethod=b.dataset.fitMethod;renderFitMethod();});
  $('catalogSearch').addEventListener('input',renderCatalog);
  $('shirtSize').onchange=e=>{state.size=e.target.value;setQty(state.qty);syncStock();emit3D('selection',window.JCNStudio3DBridge.selection());};
  $('shirtColor').onchange=e=>{state.color=e.target.value;updateOrder();emit3D('selection',window.JCNStudio3DBridge.selection());};
  $('increaseQty').onclick=()=>setQty(state.qty+1);
  $('decreaseQty').onclick=()=>setQty(state.qty-1);
  $('orderQty').onchange=e=>setQty(e.target.value);
  $('addDesign').onclick=addText;
  $('insertText').onclick=addText;
  $('demoText').addEventListener('input',e=>{
    const layer=findSelected();if(layer?.kind==='text'){layer.text=e.target.value;layer.name=e.target.value.slice(0,22)||'Text';renderLayers();}
  });
  $('demoFont').onchange=e=>{const layer=findSelected();if(layer?.kind==='text'){captureHistory();layer.font=e.target.value;renderLayers();}};
  $('demoTextColor').oninput=e=>{const layer=findSelected();if(layer){layer.color=e.target.value;renderLayers();}};
  $('demoArtwork').onchange=e=>{
    const file=e.target.files?.[0];if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>3_000_000){showDialog('Artwork file too large','This preview accepts PNG, JPG, or WebP under 3 MB. Nothing has been uploaded.');e.target.value='';return;}
    const blob=URL.createObjectURL(file);const layer=addLayer('image',{name:file.name.slice(0,24)});artImages.set(layer.id,blob);renderLayers();
    showToast('Local image preview added to '+layer.side+'. It is not uploaded or saved in the draft.');
  };
  for(const [id,prop] of [['elementSize','scale'],['elementRotation','rotate'],['elementOpacity','opacity']]){
    $(id).addEventListener('input',e=>changeProperty(prop,Number(e.target.value)));
    $(id).addEventListener('change',()=>{ /* current values remain in local preview; undo for slider moves is future work */ });
  }
  $('raiseLayer').onclick=()=>reorder(1);$('lowerLayer').onclick=()=>reorder(-1);
  $('duplicateLayer').onclick=()=>{const a=findSelected();if(!a)return;const clone={...a,x:Math.min(88,a.x+7),y:Math.min(88,a.y+7),name:a.name+' copy'};const newLayer=addLayer(a.kind,clone);if(a.kind==='image'&&artImages.has(a.id))artImages.set(newLayer.id,artImages.get(a.id));renderLayers();};

  $('undoLayer').onclick=undo;$('redoLayer').onclick=redo;
  $('manualFitForm').onsubmit=saveManual;
  // On desktop the compact navigation expands on mouse hover OR keyboard focus.
  // Unlike the old overlay, the workspace moves to accommodate it, so the shirt
  // and design controls aren't hidden behind the navigation.
  const navigation = $('appNav');
  const navPinKey = 'jcnExactStudioPhase13RefinedNavPinned';
  let navPinned = localStorage.getItem(navPinKey) === '1';
  const canHoverNav = () => matchMedia('(min-width:721px) and (hover:hover)').matches;
  function syncNavigation() {
    document.body.classList.toggle('nav-collapsed',!navPinned);
    document.body.classList.toggle('nav-pinned',navPinned);
    if(navPinned)document.body.classList.remove('nav-hover-expanded');
    $('navToggle').textContent = navPinned ? '«' : '»';
    $('navToggle').setAttribute('aria-label',navPinned?'Collapse sidebar':'Pin sidebar open');
    $('navToggle').setAttribute('aria-pressed',String(navPinned));
    $('navToggle').title = navPinned?'Collapse main menu':'Pin main menu open';
  }
  navigation.addEventListener('pointerenter',event=>{
    if(event.pointerType==='mouse' && !navPinned && canHoverNav())
      document.body.classList.add('nav-hover-expanded');
  });
  navigation.addEventListener('pointerleave',event=>{
    if(event.pointerType==='mouse' && !navPinned && !navigation.contains(document.activeElement))
      document.body.classList.remove('nav-hover-expanded');
  });
  navigation.addEventListener('focusin',()=>{
    if(!navPinned && matchMedia('(min-width:721px)').matches)
      document.body.classList.add('nav-hover-expanded');
  });
  navigation.addEventListener('focusout',event=>{
    if(!navPinned && !navigation.contains(event.relatedTarget) && !navigation.matches(':hover'))
      document.body.classList.remove('nav-hover-expanded');
  });
  navigation.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !navPinned) {
      document.body.classList.remove('nav-hover-expanded');
      document.activeElement?.blur?.();
    }
  });
  $('navToggle').onclick=()=>{
    navPinned=!navPinned;
    localStorage.setItem(navPinKey,navPinned?'1':'0');
    syncNavigation();
  };
  syncNavigation();
  // Shortcuts use the already working Phase 1.1 editing functions.
  $('nextToDesign').onclick=()=>selectStep('design');
  $('nextToBodyfit').onclick=()=>selectStep('bodyfit');
  $('quickAddText').onclick=()=>{addText();showDockSection('textAccordion');};
  $('quickUpload').onclick=()=>{showDockSection('artworkAccordion');$('demoArtwork').click();};
  $('quickElements').onclick=()=>showDockSection('elementsAccordion');
  $('quickLayers').onclick=()=>showDockSection('layersAccordion');
  $('openInspectorFromTools').onclick=()=>setDockOpen(true);
  $('closeDesignDock').onclick=()=>setDockOpen(false);
  $('hideSelectedLayer').onclick=()=>{
    const layer=findSelected();if(!layer)return;
    captureHistory();layer.hidden=true;state.selectedId=null;renderLayers();
    showToast('Selected element hidden. Restore it in Layers → eye icon.');
  };
  $('deselectLayer').onclick=()=>{state.selectedId=null;renderLayers();showToast('Selection cleared. Artwork remains visible.');};
  $('showAllLayers').onclick=()=>{if(!activeList().some(l=>l.hidden))return;captureHistory();activeList().forEach(l=>l.hidden=false);renderLayers();showToast('All hidden elements restored on this side.');};
  // Design Tools launcher stays in the top header and never blocks the avatar.
  $('reopenDesignDock').addEventListener('click',()=>setDockOpen(!dockOpen));
  $('dockCollapseFooter').onclick=()=>setDockOpen(false);

  // Hiding the adjustments is separate from hiding or deleting artwork.
  let inspectorExpanded=true;
  function setInspectorExpanded(open) {
    inspectorExpanded=Boolean(open);
    $('inspectorBody').hidden=!inspectorExpanded;
    const toggle=$('toggleAdjustments');
    toggle.setAttribute('aria-expanded',String(inspectorExpanded));
    toggle.innerHTML=inspectorExpanded?'Hide adjustments <span aria-hidden="true">⌃</span>':'Show adjustments <span aria-hidden="true">⌄</span>';
  }
  $('toggleAdjustments').addEventListener('click',()=>setInspectorExpanded(!inspectorExpanded));
  setInspectorExpanded(true);
  const deleteSelected=()=>{
    const current=findSelected();
    if(!current){showToast('Select an element to delete first.');return;}
    captureHistory();
    const side=activeSide();
    state.layers[side]=state.layers[side].filter(layer=>layer.id!==current.id);
    state.selectedId=null;
    renderLayers();
    showToast('Element deleted. Use Undo to restore it.');
  };
  $('deleteSelectedNow').onclick=deleteSelected;
  document.addEventListener('keydown',event=>{
    if(event.key!=='Delete' && event.key!=='Backspace')return;
    if(event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
    if(state.step!=='design' || !findSelected() || $('demoDialog')?.open)return;
    event.preventDefault();deleteSelected();
  });
  $('deleteLayer').onclick=deleteSelected;

  document.querySelectorAll('[data-dock-section]').forEach(button=>button.addEventListener('click',()=>showDockSection(button.dataset.dockSection)));
  ['textAccordion','artworkAccordion','elementsAccordion','layersAccordion'].forEach(id=>$(id).addEventListener('toggle',()=>{
    if(!$(id).open)return;
    document.querySelectorAll('[data-dock-section]').forEach(button=>button.classList.toggle('active',button.dataset.dockSection===id));
  }));
  setDockOpen(false);
  $('focusButton').onclick=()=>{const on=document.body.classList.toggle('focus-stage');$('focusButton').lastChild.textContent=on?' Normal View':' Focus View';};
  $('draftButton').onclick=restoreDraft;$('saveDraftButton').onclick=saveDraft;
  $('reviewButton').onclick=()=>showDialog('Review & Add to Cart — UI prototype','Apparel selection, base prices and size-level stock now come from the live JCN catalog. Designs, 3D mapping and checkout are NOT integrated yet. No order or payment has been created.');
  $('exportButton').onclick=()=>showDialog('Export Design — UI prototype','We will connect export to the actual editable 3D design data after UI approval. This mockup does not generate a print-ready file.');
  $('logoutPreview').onclick=()=>showDialog('Logout — UI prototype','This standalone design page is not connected to customer authentication. Your working live logout behavior remains unchanged.');
  for(const id of ['zoomPlus','zoomMinus','rotatePreview','movePreview','addView']) $(id).onclick=()=>{
    const commands={zoomPlus:'zoomIn',zoomMinus:'zoomOut',rotatePreview:'autoRotate',movePreview:'move',addView:'addView'};
    if(window.JCNStudio3D?.command) window.JCNStudio3D.command(commands[id]);
    else showToast('3D controls are initializing.');
  };
  $('resetPreview').onclick=()=>{
    if(window.JCNStudio3D?.command)window.JCNStudio3D.command('reset');
    else setView('back');
  };
  for(const id of ['startCamera','captureFront','captureSide','retake'])$(id).onclick=()=>showDialog('BodyFit Camera — UI prototype','This is the approved large-camera visual layout, not a live camera. The existing MediaPipe scanner will be integrated after the UI is approved. No photo was taken.');
  $('continueAvatar').onclick=()=>{selectStep('design');showToast('Returned to design preview. Live scan-to-avatar is not connected in this shell.');};
  // Initial state
  renderCategories();renderShapes();resetProductUI();renderCatalog();setPlacement('back');setView('back',false);setQty(1);renderFitMethod();selectStep('shirt');loadCatalog();
})();
