// JCN Personal Fit Studio UX V3 — local draft, focus layout and expanded camera.
// Add AFTER current studio, catalog and cart scripts. Existing 3D/BodyFit files remain untouched.
(() => {
  if(window.__jcnUXv3)return;window.__jcnUXv3=true;
  const $=id=>document.getElementById(id);
  const user=(()=>{try{return JSON.parse(localStorage.getItem('customerUser')||'{}').id||'guest';}catch{return 'guest';}})();
  const draftKey='jcn-studio-draft-v3-'+user;
  const imageDb='JCNStudioDraftFiles';
  let resumePending=false, suppressSave=false, savedTimer=null, cameraOpen=false;
  const fields=['selectedSize','shirtColor','quantity','printText','backPrintText','frontPrintSize','backPrintSize','heightCm','fit','manualChest','manualWidth'];
  const defaults={selectedSize:'M',shirtColor:'#161616',quantity:'1',printText:'',backPrintText:'',frontPrintSize:'none',backPrintSize:'none',heightCm:'165',fit:'regular',manualChest:'',manualWidth:''};
  function db(){return new Promise((resolve,reject)=>{const request=indexedDB.open(imageDb,1);request.onupgradeneeded=()=>{request.result.createObjectStore('files');};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
  async function writeArtwork(key,file){try{const conn=await db();await new Promise((resolve,reject)=>{const tx=conn.transaction('files','readwrite');tx.objectStore('files').put(file||null,user+':'+key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});conn.close();}catch(error){console.warn('JCN artwork draft save:',error);}}
  async function readArtwork(key){try{const conn=await db();const result=await new Promise((resolve,reject)=>{const tx=conn.transaction('files','readonly');const r=tx.objectStore('files').get(user+':'+key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});conn.close();return result;}catch(error){console.warn('JCN artwork draft restore:',error);return null;}}
  function snapshot(){
    const data={savedAt:Date.now(),productId:window.JCNCustomProduct?.getSelected?.()?.id||null,color:window.JCNCustomProduct?.getSelectedColor?.()||null,step:document.querySelector('.step.active')?.dataset.step||'shirt',designSide:document.querySelector('[data-design-side].active')?.dataset.designSide||'front',values:{}};
    for(const id of fields)data.values[id]=$(id)?.value??defaults[id];
    return data;
  }
  function save(){if(suppressSave)return;try{const d=snapshot();localStorage.setItem(draftKey,JSON.stringify(d));const p=$('jcnDraftState');if(p)p.textContent='Draft saved locally · '+new Date(d.savedAt).toLocaleTimeString();}catch(error){const p=$('jcnDraftState');if(p)p.textContent='Draft storage unavailable';console.warn(error);}}
  function queue(){if(suppressSave)return;clearTimeout(savedTimer);savedTimer=setTimeout(save,450);}
  async function restoreFiles(){for(const [id,key] of [['logo','front'],['backLogo','back']]){const file=await readArtwork(key);if(!file)continue;try{const dt=new DataTransfer();dt.items.add(file);$(id).files=dt.files;$(id).dispatchEvent(new Event('change',{bubbles:true}));}catch(error){console.warn('Cannot restore '+id,error);}}}
  async function restore(d){
    suppressSave=true;
    if(d.productId){
      let ready=window.JCNCustomProduct?.chooseById?.(d.productId);
      if(!ready){
        await new Promise(resolve=>{window.addEventListener('jcn:catalog-ready',resolve,{once:true});setTimeout(resolve,2000);});
        ready=window.JCNCustomProduct?.chooseById?.(d.productId);
      }
      if(!ready){const text=$('jcnDraftState');if(text)text.textContent='Saved T-shirt no longer available; please choose a new product.';}
    }
    for(const [id,v] of Object.entries(d.values||{})){
      if(!$(id))continue;
      if(id==='selectedSize' && $(id).querySelector('[value="'+String(v).replace(/[^A-Za-z0-9]/g,'')+'"]')===null){ /* options may be text-only */ }
      $(id).value=v;
      $(id).dispatchEvent(new Event('change',{bubbles:true}));
      $(id).dispatchEvent(new Event('input',{bubbles:true}));
    }
    if(d.color && $('jcnProductColor')){$('jcnProductColor').value=d.color;$('jcnProductColor').dispatchEvent(new Event('change',{bubbles:true}));}
    await restoreFiles();
    document.querySelector('[data-step="'+(d.step||'shirt')+'"]')?.click();
    document.querySelector('[data-design-side="'+(d.designSide||'front')+'"]')?.click();
    suppressSave=false;save();
  }
  async function clearDraft(){localStorage.removeItem(draftKey);await Promise.all([writeArtwork('front',null),writeArtwork('back',null)]);}
  async function newDesign(){
    suppressSave=true;
    await clearDraft();
    // Reload to clear the in-memory 3D print planes, images and studio JS state as well.
    window.location.reload();
  }
  function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;}
  function toast(message){const old=$('jcnUXToast');old?.remove();const n=el('div','jcn-ux-toast',message);n.id='jcnUXToast';document.body.append(n);setTimeout(()=>n.remove(),3600);}
  const prompt=document.createElement('dialog');prompt.id='jcnDraftDialog';prompt.className='jcn-ux-dialog';
  prompt.innerHTML='<div class="jcn-ux-eyebrow">JCN · YOUR CREATIVE SPACE</div><div class="jcn-ux-logo">J</div><h2>Welcome back to your design.</h2><p>Your previous T-shirt customization is saved on this browser. Continue editing, or start with a fresh canvas.</p><div class="jcn-ux-dialog-actions"><button type="button" id="jcnResumeDesign" class="jcn-gold-btn">Continue my design</button><button type="button" id="jcnNewDesign" class="jcn-outline-btn">Start a new design</button><button type="button" id="jcnCancelDraft" class="jcn-text-btn">Cancel</button></div><small>Drafts remain on this device until you choose New design. Uploaded images are stored locally, not uploaded merely by saving a draft.</small>';
  document.body.append(prompt);
  function readDraft(){try{const d=JSON.parse(localStorage.getItem(draftKey)||'null');return d&&d.values?d:null;}catch{return null;}}
  async function resume(){const d=readDraft();prompt.close();resumePending=false;if(d){await restore(d);toast('Your design is ready to edit.');}}
  $('jcnResumeDesign').onclick=resume;
  $('jcnNewDesign').onclick=async()=>{prompt.close();resumePending=false;await newDesign();toast('A new design is ready.');};
  $('jcnCancelDraft').onclick=()=>{prompt.close();resumePending=false;toast('Draft kept. Choose Continue design any time.');};
  function openDraftPrompt(){if(prompt.open)return;const d=readDraft();if(!d)return;resumePending=true;prompt.showModal();}
  const nav=document.querySelector('.studio-nav');
  if(nav){
    const toggle=el('button','jcn-mode-switch','◧ Focus view');toggle.type='button';toggle.id='jcnFocusToggle';toggle.title='Expand the 3D model and reveal side panels on hover';
    const continueBtn=el('button','jcn-draft-link','↺ My draft');continueBtn.type='button';continueBtn.onclick=()=>{if(readDraft())openDraftPrompt();else toast('No draft saved yet.');};
    nav.prepend(continueBtn,toggle);
    toggle.onclick=()=>{const on=document.body.classList.toggle('jcn-focus-mode');toggle.textContent=on?'◨ Show panels':'◧ Focus view';localStorage.setItem('jcn-focus-preference',on?'on':'off');window.dispatchEvent(new Event('resize'));};
    const focused=localStorage.getItem('jcn-focus-preference');
    if(focused==='on' || (!focused && window.innerWidth>=1200)){document.body.classList.add('jcn-focus-mode');toggle.textContent='◨ Show panels';}
  }
  const state=el('p','jcn-draft-state','Changes saved automatically on this device');state.id='jcnDraftState';
  document.querySelector('.studio-summary .save-area')?.prepend(state);
  const railA=el('div','jcn-panel-hint jcn-hint-left','CUSTOMIZE');
  const railB=el('div','jcn-panel-hint jcn-hint-right','YOUR ORDER');
  document.querySelector('.studio-editor')?.append(railA);
  document.querySelector('.studio-summary')?.append(railB);
  // Full-screen camera workspace: move actual camera elements, never clone video/canvas.
  const cameraModal=el('div','jcn-camera-workspace');cameraModal.id='jcnCameraWorkspace';cameraModal.hidden=true;
  cameraModal.innerHTML='<header><div><span class="jcn-ux-eyebrow">JCN BODYFIT</span><h2>See your fit, clearly.</h2><p>Stand with shoulders and hips in frame. Capture front, then turn sideways. Size is an approximation.</p></div><button type="button" id="jcnCloseCamera" aria-label="Close camera">× Close camera</button></header><div id="jcnCameraPortal"></div><footer><span>🔒 Camera analysis runs in this browser. Photos are not uploaded by this view.</span><button type="button" id="jcnReturn3D" class="jcn-gold-btn">Return to 3D preview</button></footer>';
  document.body.append(cameraModal);
  const portal=$('jcnCameraPortal');
  let savedNodes=[];
  function openCamera(){
    if(cameraOpen)return;
    cameraOpen=true;savedNodes=[];
    for(const selector of ['.body-scan-panel .camera','.body-scan-panel .camera-actions','#autoScanPanel','.body-scan-panel .scan-results']){
      const node=document.querySelector(selector);if(!node)continue;
      const anchor=document.createComment('JCN camera original position');node.parentNode.insertBefore(anchor,node);savedNodes.push({node,anchor});portal.append(node);
    }
    cameraModal.hidden=false;document.body.classList.add('jcn-camera-active');
  }
  function closeCamera(){
    if(!cameraOpen)return;
    if($('camera')?.srcObject)$('stopCamera')?.click();
    for(const {node,anchor} of savedNodes){anchor.parentNode?.insertBefore(node,anchor);anchor.remove();}
    savedNodes=[];cameraModal.hidden=true;document.body.classList.remove('jcn-camera-active');cameraOpen=false;
    window.JCNBodyFitStudio?.frame?.();
  }
  $('jcnCloseCamera').onclick=closeCamera;
  $('jcnReturn3D').onclick=closeCamera;
  document.addEventListener('click',event=>{if(event.target.closest('#startCamera')&&!cameraOpen)openCamera();},true);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&cameraOpen)closeCamera();});
  // Autosave without sending body images to backend.
  for(const id of fields)$(id)?.addEventListener('input',queue);
  document.addEventListener('click',event=>{if(event.target.closest('[data-step],[data-design-side],.jcn-product-choice,.size-buttons button'))queue();});
  window.addEventListener('jcn:product-selected',queue);
  for(const [id,key] of [['logo','front'],['backLogo','back']])$(id)?.addEventListener('change',event=>{writeArtwork(key,event.target.files?.[0]||null);queue();});
  window.addEventListener('pagehide',save);
  window.addEventListener('pageshow',e=>{if(e.persisted && readDraft())openDraftPrompt();});
  window.addEventListener('jcn:design-added-to-cart',save);
  // Wait for catalog before asking to restore a selected product.
  if(readDraft()){
    let launched=false;
    function launch(){if(launched)return;launched=true;setTimeout(openDraftPrompt,250);}
    if(window.JCNCustomProduct?.getProducts?.().length)launch();
    else {window.addEventListener('jcn:catalog-ready',launch,{once:true});setTimeout(launch,2600);}
  }
})();
