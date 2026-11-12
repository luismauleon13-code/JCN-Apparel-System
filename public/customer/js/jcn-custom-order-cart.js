// JCN Studio — reviewed, server-priced custom cart flow. No strict-mode directive.
(() => {
  if (window.__jcnCustomCartInitialized) return;
  window.__jcnCustomCartInitialized = true;
  const $ = id => document.getElementById(id);
  const API = (location.hostname === '127.0.0.1' || location.hostname === 'localhost') && location.port === '5500' ? 'http://127.0.0.1:5000' : ''; // Same-origin API on Vercel; Vercel must route /api to Express.
  const place = $('saveStatus')?.parentElement || $('downloadPrintSummary')?.parentElement;
  if (!place) return;
  const button = document.createElement('button');
  button.type = 'button';button.id = 'jcnCustomAddCart';button.className = 'jcn-cart-primary';
  button.textContent = 'Select a T-shirt first';button.disabled = true;
  const info = document.createElement('p');info.id = 'jcnCustomCartStatus';info.setAttribute('role','status');
  place.append(button,info);
  let selected = null, busy = false, added = false;
  window.addEventListener('jcn:product-selected',e=>{
    selected=e.detail;
    if(!busy){button.disabled=false;button.textContent='Review & add '+selected.title;}
  });
  window.addEventListener('jcn:product-unselected',()=>{
    selected=null;button.disabled=true;button.textContent='Select a T-shirt first';
  });
  const fmt = n => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(n)||0);
  const readFile = file => new Promise((resolve,reject)=>{
    if(!file) return resolve(null);
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5_000_000) return reject(new Error('Artwork must be PNG, JPG or WEBP under 5 MB.'));
    const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Cannot read selected artwork.'));r.readAsDataURL(file);
  });
  function choice(){
    const color=window.JCNCustomProduct?.getSelectedColor?.();
    const front=!!($('printText').value.trim() || $('logo').files?.length);
    const back=!!($('backPrintText').value.trim() || $('backLogo').files?.length);
    return {
      product_id:window.JCNCustomProduct?.getSelected?.()?.id,
      size:$('selectedSize').value,color,quantity:Number($('quantity').value),
      front_text:$('printText').value.trim(),back_text:$('backPrintText').value.trim(),
      front_print_size:front?$('frontPrintSize').value:'none',
      back_print_size:back?$('backPrintSize').value:'none',
      front_artwork_present:!!$('logo').files?.length,
      back_artwork_present:!!$('backLogo').files?.length,
      recommendation:window.JCNBodyFitStudio?.getEstimate?.()||null
    };
  }
  async function post(path,body){
    const token=localStorage.getItem('customerToken');
    if(!token)throw new Error('Customer login required. Sign in and try again.');
    const response=await fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success)throw new Error((data.message||'Server request failed')+' (HTTP '+response.status+')');
    return data;
  }
  const modal=document.createElement('dialog');modal.className='jcn-checkout-dialog';modal.id='jcnCartReview';
  modal.innerHTML=`<div class="jcn-dialog-head"><span class="jcn-dialog-kicker">JCN · YOUR CUSTOM DESIGN</span><button type="button" data-dismiss aria-label="Close review">×</button></div><div class="jcn-dialog-content"><div class="jcn-dialog-emblem">✦</div><h2 id="jcnReviewTitle">Review your creation</h2><p id="jcnReviewSubtitle">Confirm your order details before adding it to cart.</p><div id="jcnReviewDetails" class="jcn-review-details"></div><p class="jcn-dialog-note">This adds your design to the cart. It does not place or pay for an order.</p><p id="jcnReviewError" class="jcn-review-error" role="alert" hidden></p></div><div class="jcn-dialog-actions"><button type="button" data-dismiss class="jcn-secondary-btn">Keep editing</button><button type="button" id="jcnConfirmCustomCart" class="jcn-gold-btn">Add to my cart</button></div>`;
  document.body.append(modal);
  const closeModal=()=>{if(modal.open)modal.close();};
  modal.querySelectorAll('[data-dismiss]').forEach(b=>b.addEventListener('click',closeModal));
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal();});
  function openReview(data,body){
    added=false;
    $('jcnConfirmCustomCart').onclick=null;
    $('jcnConfirmCustomCart').textContent='Add to my cart';
    modal.querySelectorAll('[data-dismiss]').forEach(b=>b.hidden=false);
    modal.querySelector('.jcn-dialog-note').textContent='This adds your design to the cart. It does not place or pay for an order.';
    $('jcnReviewTitle').textContent=data.product_title || 'Your customized T-shirt';
    const details=$('jcnReviewDetails');details.replaceChildren();
    const rows=[['T-shirt',data.product_title],['Size / color',data.size+' / '+data.color],['Quantity',body.quantity],['Front print',data.front_print_size==='none'?'None':data.front_print_size],['Back print',data.back_print_size==='none'?'None':data.back_print_size],['Unit price',fmt(data.unit_price)],['Subtotal',fmt(data.subtotal)]];
    rows.forEach(([name,value],i)=>{let r=document.createElement('div');if(i===rows.length-1)r.className='jcn-review-total';let a=document.createElement('span');a.textContent=name;let b=document.createElement('strong');b.textContent=String(value);r.append(a,b);details.append(r);});
    $('jcnReviewError').hidden=true;
    modal.showModal();
  }
  button.addEventListener('click',async()=>{
    if(busy)return;
    const body=choice();
    try {
      if(!body.product_id)throw new Error('Please choose a customizable T-shirt first.');
      if(!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>30)throw new Error('Quantity must be between 1 and 30.');
      for(const side of ['front','back'])if((body[side+'_text']||body[side+'_artwork_present'])&&body[side+'_print_size']==='none')throw new Error('Choose a '+side+' print size.');
      busy=true;button.disabled=true;info.textContent='Checking actual price, stock and available color…';
      const quote=await post('/api/customer/customization/quote',body);
      if(quote.product_id!==body.product_id)throw new Error('Product changed. Refresh and choose again.');
      info.textContent='Server confirmed '+fmt(quote.subtotal)+'. Review before adding.';
      openReview(quote,body);
    }catch(error){console.error('JCN quote:',error);info.textContent='Cannot review design: '+error.message;}
    finally{busy=false;button.disabled=!selected;}
  });
  $('jcnConfirmCustomCart').addEventListener('click',async()=>{
    if(busy||added)return;
    const body=choice();
    const confirm=$('jcnConfirmCustomCart');
    busy=true;confirm.disabled=true;confirm.textContent='Saving your design…';
    $('jcnReviewError').hidden=true;
    let stage='Saving the artwork and design';
    try{
      body.front_artwork=await readFile($('logo').files?.[0]);
      body.back_artwork=await readFile($('backLogo').files?.[0]);
      // Revalidate on confirm, in case another browser tab changed product/stock.
      const q=await post('/api/customer/customization/quote',body);
      const displayed=$('jcnReviewDetails').lastElementChild?.querySelector('strong')?.textContent;
      if(fmt(q.subtotal)!==displayed)throw new Error('The price has changed. Close the review and check the updated quote.');
      const result=await post('/api/customer/customization/submit',body);
      stage='Saving the confirmed cart item';
      if(!result.cart_item?.custom_design_request_id)throw new Error('Server did not return a confirmed design reference.');
      result.cart_item.custom_front_text=body.front_text;
      result.cart_item.custom_back_text=body.back_text;
      const cart=JSON.parse(localStorage.getItem('customerCart')||'[]');
      if(!Array.isArray(cart))throw new Error('Cart storage contains invalid data.');
      if(!cart.some(i=>i.cartKey===result.cart_item.cartKey))cart.push(result.cart_item);
      localStorage.setItem('customerCart',JSON.stringify(cart));
      if(!JSON.parse(localStorage.getItem('customerCart')||'[]').some(i=>i.cartKey===result.cart_item.cartKey))throw new Error('Cart storage verification failed.');
      added=true;
      window.dispatchEvent(new CustomEvent('jcn:design-added-to-cart',{detail:{requestId:result.request_id}}));
      $('jcnReviewTitle').textContent='Your design is in the cart!';
      $('jcnReviewSubtitle').textContent='Your custom T-shirt was saved with design reference '+result.request_id+'.';
      confirm.textContent='View my cart';
      modal.querySelector('.jcn-dialog-note').textContent='Your draft is saved. You can return to the studio to continue editing.';
      modal.querySelectorAll('[data-dismiss]').forEach(b=>b.hidden=true);
      confirm.disabled=false;
      confirm.onclick=()=>{window.location.href='customer-cart.html';};
      info.textContent='Added! View your customized T-shirt in the cart.';
    }catch(error){
      console.error('JCN submit stage:',stage,error);
      $('jcnReviewError').textContent=stage+' failed: '+error.message+' Your draft remains saved; no cart item has been confirmed.';
      $('jcnReviewError').hidden=false;
      info.textContent='Not added to cart: '+error.message;
    }finally{busy=false;if(!confirm.onclick){confirm.disabled=false;confirm.textContent='Add to my cart';}}
  });
})();
