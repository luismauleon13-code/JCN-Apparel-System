// JCN Personal Fit Studio: layout tabs, live quote, front/back designs and BodyFit bridge.
// Does not replace the Three.js renderer or run camera capture itself.
(() => {
  const $ = id => document.getElementById(id);
  const PRICES = window.JCN_STUDIO_PRICES || { garmentUnit: null, printUnits: {none:0}, sampleRates: true };
  const sizeChart = {
    XS:{length:27,width:21,sleeve:9}, S:{length:28,width:22,sleeve:9.25},
    M:{length:29,width:23,sleeve:9.5}, L:{length:30,width:24,sleeve:10.25},
    XL:{length:31,width:25,sleeve:10.5}, '2XL':{length:32,width:26,sleeve:11},
    '3XL':{length:33,width:27,sleeve:11.5}
  }; // Starter JCN size chart; replace with selected Supabase product dimensions.
  const colors = {'#161616':'Black','#E5DDC8':'Cream','#F5F5F2':'White','#24374C':'Navy Blue'};
  let frontImage = null;
  let backImage = null;
  let lastRecommended = null;
  const money = value => Number.isFinite(value) ? new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:0}).format(value) : 'To be quoted';
  const sanitizeQuantity = () => Math.min(100,Math.max(1,Math.floor(Number($('quantity').value) || 1)));
  const getPrintSize = side => $(side === 'front' ? 'frontPrintSize' : 'backPrintSize').value;
  const artworkPresent = side => Boolean((side==='front' ? frontImage : backImage) || $(side==='front'?'printText':'backPrintText').value.trim());
  const stored = () => ({
    shirtColor: $('shirtColor').value, size: $('selectedSize').value,
    quantity: sanitizeQuantity(),
    frontText:$('printText').value.trim(),backText:$('backPrintText').value.trim(),
    frontPrintSize:getPrintSize('front'),backPrintSize:getPrintSize('back'),
    heightCm:Number($('heightCm').value),fit:$('fit').value,
    chestCm:Number($('manualChest').value)||null,
    frontArtworkAttached:Boolean(frontImage),backArtworkAttached:Boolean(backImage),
    recommendation:lastRecommended
  });
  const syncBridge = () => {
    const bridge=window.JCNBodyFitStudio;
    if(!bridge) return;
    bridge.setGarmentDesign?.({
      color:$('shirtColor').value,
      frontText:$('printText').value,
      backText:$('backPrintText').value,
      frontImage,backImage,
      frontSize:getPrintSize('front'),backSize:getPrintSize('back')
    });
    bridge.applyBodyPreview?.();
  };
  const updateQuote = () => {
    const qty=sanitizeQuantity();
    const size=$('selectedSize').value;
    const chart=sizeChart[size]||sizeChart.M;
    $('shirtLength').textContent=chart.length+'″';
    $('shirtWidth').textContent=chart.width+'″';
    $('shirtSleeve').textContent=chart.sleeve+'″';
    const normalized=$('shirtColor').value.toUpperCase();
    const label=Object.entries(colors).find(([hex])=>hex.toUpperCase()===normalized)?.[1]||normalized;
    $('colorName').textContent=label;
    $('summaryVariant').textContent=`${label} / ${size} / 260 GSM`;
    $('summaryQty').textContent=qty;
    const frontSize=artworkPresent('front')?getPrintSize('front'):'none';
    const backSize=artworkPresent('back')?getPrintSize('back'):'none';
    $('frontPrintLabel').textContent=frontSize==='none'?'No print selected':`Artwork / ${frontSize}`;
    $('backPrintLabel').textContent=backSize==='none'?'No print selected':`Artwork / ${backSize}`;
    const front=Number(PRICES.printUnits?.[frontSize]);
    const back=Number(PRICES.printUnits?.[backSize]);
    const garment=PRICES.garmentUnit==null ? NaN : Number(PRICES.garmentUnit);
    $('shirtUnitCost').textContent=money(garment);
    $('printUnitCost').textContent=money(front+back);
    $('estimatedTotal').textContent=money((garment+front+back)*qty);
    $('quoteLabel').textContent='Estimated total';
    if(PRICES.sampleRates){$('pricingDisclosure').textContent='SAMPLE PRICE ESTIMATE — update jcn-studio-prices.js with actual JCN rates before customer checkout. Delivery and discounts excluded.';}
    else{$('pricingDisclosure').textContent='Price estimate only; final quotation should be validated by the server. Delivery and discounts excluded.';}
    const chest=Number($('manualChest').value);
    const circumference=chart.width*2*2.54;
    const ease=(Number.isFinite(chest)&&chest>=50)?circumference-chest:null;
    const scanLabel=lastRecommended?.size ? `BodyFit suggests ${lastRecommended.size} (${lastRecommended.confidence}). ` : 'Use Body Scan for a suggested size. ';
    const easeLabel=ease!=null?`Size ${size}: estimated garment circumference ${circumference.toFixed(1)} cm, ${ease.toFixed(1)} cm of ease compared with the manually entered chest.`:`Size ${size}: garment circumference ≈ ${circumference.toFixed(1)} cm (flat width × 2).`;
    $('fitGlance').textContent=scanLabel+easeLabel;
    $('sizeButtons').querySelectorAll('button').forEach(b=>b.classList.toggle('active',b.dataset.size===size));
    $('colorSwatches').querySelectorAll('.swatch').forEach(b=>b.classList.toggle('active',b.dataset.color.toUpperCase()===normalized));
  };
  const updateEverything = () => {updateQuote();syncBridge();};
  function setStep(step){
    document.querySelectorAll('.step').forEach(b=>{const on=b.dataset.step===step;b.classList.toggle('active',on);b.setAttribute('aria-selected',String(on));});
    ['shirt','design','you'].forEach(key=>{$('step-'+key).hidden=key!==step;});
  }
  function setView(view){
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('viewLabel').textContent=view.toUpperCase()+' VIEW';
    window.JCNBodyFitStudio?.setView?.(view);
  }
  async function loadArt(file,side){
    if(!file)return;
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5_000_000){alert('Use PNG, JPG or WEBP artwork under 5 MB.');return;}
    const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Artwork could not be read'));reader.readAsDataURL(file);});
    if(side==='front'){frontImage=data;$('artPreview').src=data;$('artPreview').hidden=false;}
    else{backImage=data;$('backArtPreview').src=data;$('backArtPreview').hidden=false;}
    // A logo without a selected print size uses A5 estimate by default.
    const select=$(side==='front'?'frontPrintSize':'backPrintSize');
    if(select.value==='none')select.value='A5';
    updateEverything();
  }
  const downloadSummary = () => {
    const s=stored();
    const front=artworkPresent('front')?s.frontPrintSize:'none';
    const back=artworkPresent('back')?s.backPrintSize:'none';
    const pFront=Number(PRICES.printUnits[front]??0),pBack=Number(PRICES.printUnits[back]??0);
    const base=PRICES.garmentUnit==null?NaN:Number(PRICES.garmentUnit);
    const content=[
      'JCN APPAREL — PERSONAL FIT STUDIO','PRINT SUMMARY (ESTIMATE — NOT AN ORDER)',
      '',`Garment: ${PRICES.garmentName||'Oversized Tee'}`,`Color: ${s.shirtColor}`,`Size: ${s.size}`,`Quantity: ${s.quantity}`,
      `Front design: ${s.frontText||'(no text)'} / ${front} / artwork attached: ${s.frontArtworkAttached}`,
      `Back design: ${s.backText||'(no text)'} / ${back} / artwork attached: ${s.backArtworkAttached}`,
      `BodyFit suggestion: ${s.recommendation?.size||'Not measured'}`,
      `Blank shirt: ${money(base)} each`, `Prints: ${money(pFront+pBack)} each`,
      `Estimated total: ${money((base+pFront+pBack)*s.quantity)}`,
      'NOTE: Example pricing. Configure confirmed JCN rates before checkout. Delivery excluded.',
      'NOTE: Photos and artwork files are NOT embedded in this text summary.',
      'NOTE: Scan is not an accurate 3D body reconstruction.'
    ].join('\n');
    const blob=new Blob([content],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');link.href=url;link.download='JCN-Print-Summary.txt';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
  };
  function init(){
    ['XS','S','M','L','XL','2XL','3XL'].forEach(size=>{
      const b=document.createElement('button');b.type='button';b.dataset.size=size;b.textContent=size;
      b.addEventListener('click',()=>{$('selectedSize').value=size;$('selectedSize').dispatchEvent(new Event('change',{bubbles:true}));updateEverything();});
      $('sizeButtons').append(b);
    });
    document.querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>setStep(b.dataset.step)));
    document.querySelectorAll('[data-design-side]').forEach(b=>b.addEventListener('click',()=>{
      const side=b.dataset.designSide;
      document.querySelectorAll('[data-design-side]').forEach(x=>x.classList.toggle('active',x===b));
      document.querySelectorAll('[data-for-side]').forEach(x=>x.hidden=x.dataset.forSide!==side);
      setView(side==='front'?'front':'back');
    }));
    document.querySelectorAll('.swatch').forEach(b=>b.addEventListener('click',()=>{
      $('shirtColor').value=b.dataset.color;
      $('shirtColor').dispatchEvent(new Event('input',{bubbles:true}));updateEverything();
    }));
    // Auto-select an estimated print size when a customer begins entering text.
    // Otherwise a design could be visible in inputs yet have a ₱0 print cost.
    [['printText','frontPrintSize'],['backPrintText','backPrintSize']].forEach(([textId,sizeId])=>{
      $(textId).addEventListener('input',()=>{
        if($(textId).value.trim() && $(sizeId).value==='none')$(sizeId).value='A5';
      });
    });
    ['shirtColor','printText','backPrintText','frontPrintSize','backPrintSize','selectedSize','quantity','heightCm','manualChest','manualWidth','fit'].forEach(id=>{
      $(id)?.addEventListener('input',updateEverything);$(id)?.addEventListener('change',updateEverything);
    });
    $('logo').addEventListener('change',e=>loadArt(e.target.files?.[0],'front').catch(err=>alert(err.message)));
    $('backLogo').addEventListener('change',e=>loadArt(e.target.files?.[0],'back').catch(err=>alert(err.message)));
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
    $('autoRotate').onclick=()=>{const value=window.JCNBodyFitStudio?.toggleAutoRotate?.();$('autoRotate').classList.toggle('active',!!value);};
    $('zoomIn').onclick=()=>window.JCNBodyFitStudio?.zoom?.(.82);
    $('zoomOut').onclick=()=>window.JCNBodyFitStudio?.zoom?.(1.22);
    $('downloadPrintSummary').onclick=downloadSummary;
    $('exportSummary').onclick=downloadSummary;
    const modal=$('logoutDialog');
    $('customerLogoutBtn').onclick=()=>modal.showModal();
    $('confirmLogout').addEventListener('click',()=>{
      localStorage.removeItem('customerToken');
      localStorage.removeItem('customerUser');
      localStorage.removeItem('customer');
      window.location.href='user-login.html';
    });
    window.addEventListener('jcn:avatar-ready',()=>{syncBridge();setView('front');});
    window.addEventListener('jcn:size-recommended',e=>{lastRecommended=e.detail||null;updateEverything();});
    updateQuote();
    setStep('shirt');
    // User may activate the 3D module after this script; polling unnecessary.
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
