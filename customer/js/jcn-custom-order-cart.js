// Add-on: integrates existing JCN Personal Fit Studio with server-priced cart.
// Does not change the Three.js loader, BodyFit camera, or visual size fitting.
(() => {
  if (window.__jcnCustomCartInitialized) return;
  window.__jcnCustomCartInitialized = true;
  const $ = id => document.getElementById(id);
  const API = '';
  const colorNames={'#161616':'Black','#E5DDC8':'Cream','#F5F5F2':'White','#24374C':'Navy Blue'};
  const place = $('saveStatus')?.parentElement || $('downloadPrintSummary')?.parentElement;
  if (!place) return;
  const button=document.createElement('button');button.type='button';button.id='jcnCustomAddCart';
  button.textContent='Choose a T-shirt first';button.disabled=true;
  button.style.cssText='display:block;width:100%;margin:12px 0;padding:13px;border:1px solid #e5bd55;background:#e5bd55;color:#17130b;font-weight:700;border-radius:7px;cursor:pointer';
  const info=document.createElement('p');info.id='jcnCustomCartStatus';info.setAttribute('role','status');info.style.cssText='font-size:12px;line-height:1.6;color:#e5bd55';
  if(!document.getElementById('jcnCustomAddCart')) place.append(button,info);
  window.addEventListener('jcn:product-selected', e=>{button.disabled=false;button.textContent='Add '+e.detail.title+' to cart';info.textContent='Selected: '+e.detail.title+' — '+e.detail.id;});
  window.addEventListener('jcn:product-unselected',()=>{button.disabled=true;button.textContent='Choose a T-shirt first';});
  async function api(endpoint,body){
    const token=localStorage.getItem('customerToken');
    if(!token)throw new Error('Please login as a customer first.');
    const response=await fetch(API+endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok||!data.success)throw new Error(data.message||'Request failed ('+response.status+').');
    return data;
  }
  const fileData=file=>new Promise((resolve,reject)=>{
    if(!file)return resolve(null);
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>5*1024*1024)return reject(new Error('Artwork must be PNG/JPG/WEBP under 5MB.'));
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Unable to read artwork.'));reader.readAsDataURL(file);
  });
  function input(){
    const color=$('shirtColor').value;
    const front=Boolean($('printText').value.trim()||$('logo').files?.[0]);
    const back=Boolean($('backPrintText').value.trim()||$('backLogo').files?.[0]);
    return {
      product_id:window.JCNCustomProduct?.getSelected?.()?.id || null,
      size:$('selectedSize').value,
      color:window.JCNCustomProduct?.getSelectedColor?.() || colorNames[color] || color,
      quantity:Math.floor(Number($('quantity').value)),
      front_text:$('printText').value.trim(),back_text:$('backPrintText').value.trim(),
      front_print_size:front?$('frontPrintSize').value:'none',
      back_print_size:back?$('backPrintSize').value:'none',
      front_artwork_present:Boolean($('logo').files?.[0]),back_artwork_present:Boolean($('backLogo').files?.[0]),
      recommendation:window.JCNBodyFitStudio?.getEstimate?.()||null
    };
  }
  button.addEventListener('click',async()=>{
    button.disabled=true;info.textContent='Validating product, stock and printing price…';
    try{
      const body=input();
      if(!body.product_id)throw new Error('Choose a customizable T-shirt product first.');
      if(!Number.isInteger(body.quantity)||body.quantity<1||body.quantity>30)throw new Error('Quantity must be 1–30.');
      if((body.front_text||body.front_artwork_present)&&body.front_print_size==='none')throw new Error('Select a front print size.');
      if((body.back_text||body.back_artwork_present)&&body.back_print_size==='none')throw new Error('Select a back print size.');
      // Quote first to avoid uploading customer artwork when an item is out of stock.
      const quote=await api('/api/customer/customization/quote',body);
      const current=window.JCNCustomProduct?.getSelected?.();
      if(!current||current.id!==quote.product_id) throw new Error('Selected product changed. Please review again.');
      const peso=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(quote.subtotal);
      if(!window.confirm(`Product: ${quote.product_title}\nSize: ${quote.size} | Color: ${quote.color}\nQuantity: ${body.quantity}\nServer-confirmed subtotal: ${peso}, excluding delivery.\n\nAdd this customized T-shirt to cart?`)){
        info.textContent='Cancelled. No design was submitted.';return;
      }
      info.textContent='Uploading artwork and saving design…';
      body.front_artwork=await fileData($('logo').files?.[0]);
      body.back_artwork=await fileData($('backLogo').files?.[0]);
      const result=await api('/api/customer/customization/submit',body);
      const cart=JSON.parse(localStorage.getItem('customerCart')||'[]');
      if(!Array.isArray(cart))throw new Error('Customer cart is not valid.');
      cart.push(result.cart_item);
      localStorage.setItem('customerCart',JSON.stringify(cart));
      info.textContent='Custom T-shirt added with design reference '+result.request_id+'. Opening cart…';
      window.location.href='customer-cart.html';
    }catch(e){console.error('JCN customized cart:',e);info.textContent='Could not add to cart: '+e.message;}
    finally{button.disabled=false;}
  });
})();
