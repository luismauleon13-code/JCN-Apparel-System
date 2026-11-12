// JCN Custom cart display: annotate only confirmed custom_design_request_id items.
// Include on customer-cart.html AFTER the existing customer-cart.js script.
(() => {
  if(window.__jcnCartDetailsLoaded)return;window.__jcnCartDetailsLoaded=true;
  const $=id=>document.getElementById(id);
  function render(){
    const holder=$('cartItems');if(!holder)return;
    let cart=[];try{const user=JSON.parse(localStorage.getItem('customerUser')||'{}');if(!user.id)return;cart=JSON.parse(localStorage.getItem(`customerCart_${user.id}`)||'[]');}catch{return;}
    if(!Array.isArray(cart))return;
    const nodes=[...holder.querySelectorAll('.cart-item')];
    nodes.forEach((node,i)=>{
      const item=cart[i];
      if(!item?.is_customized||!item?.custom_design_request_id)return;
      // Extra guard against a stale row-index mismatch from another cart implementation.
      const shownTitle=node.querySelector('.item-info h3')?.textContent?.trim();
      if(shownTitle && shownTitle!==String(item.title||'').trim())return;
      const info=node.querySelector('.item-info');if(!info||info.querySelector('.jcn-custom-cart-detail'))return;
      const panel=document.createElement('div');panel.className='jcn-custom-cart-detail';
      const title=document.createElement('strong');title.textContent='✦ PERSONALIZED JCN DESIGN';panel.append(title);
      const details=[
        'Product: '+(item.title||'Custom T-shirt').replace(/ — Custom Design$/,''),
        'Front print: '+(item.custom_front_print_size||'none'),
        'Back print: '+(item.custom_back_print_size||'none')
      ];
      if(item.custom_front_text)details.push('Front text: '+item.custom_front_text);
      if(item.custom_back_text)details.push('Back text: '+item.custom_back_text);
      details.push('Design ref: '+String(item.custom_design_request_id).slice(0,8).toUpperCase());
      details.forEach(text=>{const p=document.createElement('p');p.textContent=text;panel.append(p);});
      const hint=document.createElement('small');hint.textContent='Artwork and design reference are submitted for Graphic Designer review. Image shown is the base T-shirt product.';panel.append(hint);
      info.append(panel);
    });
  }
  const style=document.createElement('style');style.textContent='.jcn-custom-cart-detail{padding:12px 14px;margin-top:10px;background:#21261d;border:1px solid #b89a47;border-radius:10px;color:#eee5d1;max-width:420px}.jcn-custom-cart-detail strong{color:#f1c965;font-size:11px;letter-spacing:1.1px}.jcn-custom-cart-detail p{margin:5px 0;font-size:11px;line-height:1.5;color:#e9e7dd}.jcn-custom-cart-detail small{display:block;margin-top:8px;color:#b9bead;font-size:10px;line-height:1.4}';document.head.append(style);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();const h=$('cartItems');if(h){const obs=new MutationObserver(()=>render());obs.observe(h,{childList:true,subtree:false});}});
  else{render();const h=$('cartItems');if(h){const obs=new MutationObserver(()=>render());obs.observe(h,{childList:true,subtree:false});}}
})();
