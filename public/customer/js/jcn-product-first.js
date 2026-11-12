// Product-first chooser for JCN Personal Fit Studio.
// Does not alter the working Blender, BodyFit, print or checkout engines.
(() => {
  if (window.__jcnProductFirstLoaded) return;
  window.__jcnProductFirstLoaded = true;
  const $ = id => document.getElementById(id);
  const API = 'http://127.0.0.1:5000';
  const HEX = {
    black:'#161616',white:'#F5F5F2',cream:'#E5DDC8',navy:'#24374C',
    'navy blue':'#24374C',blue:'#245DA1',red:'#AE2B34',maroon:'#672C3A',
    gray:'#888888',grey:'#888888',pink:'#DB8BA8','army green':'#516340',
    green:'#416F51',brown:'#694830',mustard:'#C6A33F',taupe:'#A98D76',
    rust:'#B65E3C',mint:'#91C8B7',peach:'#EDB79F','dark green':'#264D38',
    'deep royal':'#264EAD','rose':'#D78B93',fatigue:'#5B6242'
  };
  let products = [];
  let current = null;
  let color = null;
  const money = n => new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',maximumFractionDigits:2}).format(n);
  const price = p => {
    const onSale = p.sale_percent > 0 && (!p.sale_end || new Date(p.sale_end+'T23:59:59') >= new Date());
    return p.price * (onSale ? 1 - p.sale_percent/100 : 1);
  };
  const dispatch = () => window.dispatchEvent(new CustomEvent('jcn:product-selected', {detail:{id:current.id,title:current.title,color}}));
  const safeText = v => String(v == null ? '' : v);

  window.JCNCustomProduct = {
    getSelected: () => current ? {id:current.id,title:current.title,price:price(current)} : null,
    getSelectedColor: () => color
  };

  async function load() {
    const token = localStorage.getItem('customerToken');
    if (!token) { $('jcnCatalogFeedback').textContent='Log in to see customizable products.'; return; }
    const resp = await fetch(API+'/api/customer/customization/products', {
      headers:{Authorization:'Bearer '+token},cache:'no-store'
    });
    const data=await resp.json();
    if(!resp.ok || !data.success) throw new Error(data.message||'Catalog unavailable.');
    products=data.products||[];
    const holder=$('jcnProductCards');
    holder.replaceChildren();
    if (!products.length) {
      $('jcnCatalogFeedback').textContent='No customizable blank T-shirts configured yet. Ask the shop administrator to add one.';
      return;
    }
    $('jcnCatalogFeedback').textContent='Choose an actual JCN product before customizing. Each card shows its real catalog photo and base price.';
    for (const p of products) {
      const btn=document.createElement('button');btn.type='button';btn.className='jcn-product-choice';
      const img=document.createElement('img');img.alt=p.title;img.loading='lazy';
      if(/^https:\/\//.test(p.image||'')) img.src=p.image;
      const text=document.createElement('span');text.className='jcn-product-choice-copy';
      const name=document.createElement('strong');name.textContent=p.title;
      const meta=document.createElement('small');meta.textContent=money(price(p))+' base • '+p.sizes.filter(s=>s.qty>0).map(s=>s.size).join(', ');
      text.append(name,meta);btn.append(img,text);
      btn.addEventListener('click',()=>choose(p));holder.append(btn);
    }
  }
  function choose(p) {
    const available=p.sizes.filter(s=>s.qty>0);
    if(!available.length || !p.colors.length) {
      $('jcnCatalogFeedback').textContent='This T-shirt has no selectable stock or color.';return;
    }
    current=p;
    $('jcnProductCards').querySelectorAll('.jcn-product-choice').forEach((b,i)=>b.classList.toggle('selected',products[i].id===p.id));
    const selectedSize=$('selectedSize');
    if(!available.some(s=>s.size===selectedSize.value)) selectedSize.value=available[0].size;
    $('sizeButtons').querySelectorAll('button').forEach(b=>{
      const item=p.sizes.find(s=>s.size===b.dataset.size);
      b.disabled=!item || item.qty<1;
      b.title=b.disabled?'Unavailable for this product':`${item.qty} available`;
    });
    selectedSize.dispatchEvent(new Event('change',{bubbles:true}));
    const colorSelect=$('jcnProductColor');
    colorSelect.replaceChildren();
    p.colors.forEach(c=>{
      const opt=document.createElement('option');opt.value=c;opt.textContent=c;colorSelect.append(opt);
    });
    colorSelect.disabled=false;
    colorSelect.value=p.colors[0];
    chooseColor(colorSelect.value);
    $('jcnSelectedProductName').textContent=p.title;
    $('jcnSelectedProductPrice').textContent=money(price(p))+' base each · printing extra';
    $('jcnSelectedProductImage').src=/^https:\/\//.test(p.image||'')?p.image:'';
    $('jcnSelectedProductImage').alt=p.title;
    $('jcnSelectedProduct').hidden=false;
    // Replace the old hardcoded sample name and sample base price for the visible quote.
    const sample=document.querySelector('#step-shirt .mini-row b');
    if(sample)sample.textContent=p.title;
    const code=document.querySelector('#step-shirt .mini-row small');if(code)code.textContent='SELECTED PRODUCT';
    const desc=document.querySelector('#step-shirt .mini-row + .muted');
    if(desc)desc.textContent=p.description || 'Customize this JCN T-shirt.';
    const rates=window.JCN_STUDIO_PRICES;
    if(rates) {rates.garmentName=p.title;rates.garmentUnit=price(p);rates.sampleRates=true;}
    const qty=$('quantity');qty.max=String(p.sizes.find(x=>x.size===selectedSize.value)?.qty||1);
    if(Number(qty.value)>Number(qty.max))qty.value=qty.max;
    qty.dispatchEvent(new Event('input',{bubbles:true}));
    dispatch();
  }
  function chooseColor(value) {
    color=value;
    const hex=HEX[String(value).toLowerCase()] || (String(value).match(/^#[0-9a-f]{6}$/i)?value:null);
    if(hex) {
      $('shirtColor').value=hex;
      $('shirtColor').dispatchEvent(new Event('input',{bubbles:true}));
    } else {
      $('jcnCatalogFeedback').textContent=`${value}: no 3D display color mapped yet; order selection uses the actual product color.`;
    }
    const name=$('colorName');if(name)name.textContent=value;
    dispatch();
  }
  function init() {
    const panel=$('step-shirt');
    if(!panel || $('jcnProductCatalog'))return;
    const catalog=document.createElement('section');catalog.id='jcnProductCatalog';
    const heading=document.createElement('h2');heading.textContent='Choose your T-shirt';
    const helper=document.createElement('p');helper.id='jcnCatalogFeedback';helper.textContent='Loading available products…';
    const cards=document.createElement('div');cards.id='jcnProductCards';
    const colorLabel=document.createElement('label');colorLabel.textContent='AVAILABLE PRODUCT COLOR';colorLabel.htmlFor='jcnProductColor';
    const colorSelect=document.createElement('select');colorSelect.id='jcnProductColor';colorSelect.disabled=true;
    colorLabel.append(colorSelect);
    catalog.append(heading,helper,cards,colorLabel);
    panel.prepend(catalog);
    const summary=document.createElement('div');summary.id='jcnSelectedProduct';summary.hidden=true;
    const image=document.createElement('img');image.id='jcnSelectedProductImage';
    const copy=document.createElement('div');
    const title=document.createElement('strong');title.id='jcnSelectedProductName';
    const cost=document.createElement('p');cost.id='jcnSelectedProductPrice';
    copy.append(title,cost);summary.append(image,copy);
    const right=$('downloadPrintSummary')?.parentElement;
    if(right)right.prepend(summary);
    colorSelect.addEventListener('change',()=>chooseColor(colorSelect.value));
    // Custom color is no longer a product-selection control. Product color comes from the catalog.
    const customColor=document.querySelector('.custom-color');if(customColor)customColor.hidden=true;
    const swatches=$('colorSwatches');if(swatches)swatches.hidden=true;
    $('selectedSize').addEventListener('change',()=>{
      if(!current)return;
      const stock=current.sizes.find(x=>x.size===$('selectedSize').value)?.qty||0;
      $('quantity').max=String(stock||1);
      if(Number($('quantity').value)>stock)$('quantity').value=String(Math.max(stock,1));
      $('quantity').dispatchEvent(new Event('input',{bubbles:true}));
    });
    load().catch(e=>{$('jcnCatalogFeedback').textContent='Unable to load products: '+e.message;});
  }
  const css=document.createElement('style');css.textContent=`
    #jcnProductCatalog{padding:14px 0;border-bottom:1px solid #54451e;margin-bottom:16px}
    #jcnProductCatalog h2{font-size:18px;color:#ebc266;margin:0 0 10px}
    #jcnCatalogFeedback{font-size:12px;color:#ccc1a5;line-height:1.5}
    #jcnProductCards{display:grid;gap:9px;margin:12px 0}
    .jcn-product-choice{display:flex;gap:10px;text-align:left;align-items:center;padding:8px;background:#181b17;color:#f4ebd8;border:1px solid #5b502e;border-radius:9px;cursor:pointer;width:100%}
    .jcn-product-choice:hover,.jcn-product-choice.selected{border-color:#e5bd55;background:#282719}
    .jcn-product-choice img{width:60px;height:70px;object-fit:cover;border-radius:5px;background:#333}
    .jcn-product-choice-copy{display:grid;gap:6px;font-size:13px}
    .jcn-product-choice-copy small{color:#e5bd55;font-size:11px}
    #jcnProductCatalog label{display:grid;gap:7px;color:#e5bd55;font-size:11px;font-weight:700}
    #jcnProductColor{background:#141714;color:white;border:1px solid #67592d;padding:10px;border-radius:7px;width:100%}
    #jcnSelectedProduct{display:flex;gap:10px;margin:10px 0;padding:10px;border:1px solid #786332;border-radius:8px;background:#202117;color:#fff;font-size:12px}
    #jcnSelectedProduct[hidden]{display:none}#jcnSelectedProduct img{width:64px;height:68px;object-fit:cover}
    #jcnSelectedProduct p{color:#e5bd55;margin:6px 0 0;font-size:11px}
    #sizeButtons button:disabled{opacity:.25;cursor:not-allowed}
  `;document.head.append(css);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
