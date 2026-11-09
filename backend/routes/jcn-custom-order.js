// JCN Customization quotation, artwork storage and order binding.
// Register before the final /api 404 handler.
const crypto = require('crypto');
module.exports = function registerJCNCustomOrders({ app, supabase, verifyCustomerToken }) {
  const BUCKET = 'jcn-design-previews';
  const SIZES = new Set(['XS','S','M','L','XL','2XL','3XL']);
  const PRINTS = new Set(['none','A6','A5','A4','A3']);
  const uuid = v => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(String(v || ''));
  const fail = (res, status, message) => res.status(status).json({ success:false, message });
  const getUser = req => req.customer?.id || req.customer?.user_id || req.customer?.sub || req.user?.id || req.user?.user_id || req.user?.sub || req.auth?.id || req.auth?.sub;
  const rates = Object.fromEntries(['A6','A5','A4','A3'].map(k => [k, Number(process.env['JCN_PRINT_'+k+'_PESOS'])]));
  const productIds = () => String(process.env.JCN_CUSTOM_PRODUCT_IDS || process.env.JCN_CUSTOM_TSHIRT_PRODUCT_ID || '')
    .split(',').map(v => v.trim()).filter(uuid);
  const configOK = () => productIds().length > 0 && Object.values(rates).every(n => Number.isFinite(n) && n >= 0);
  const printCost = s => s === 'none' ? 0 : rates[s];
  const parseArr = a => { if (Array.isArray(a)) return a; try { return JSON.parse(a || '[]'); } catch { return []; } };
  const str = (v,n=100) => String(v||'').slice(0,n).trim();
  async function productFor(productId, size, color, qty) {
    if(!productIds().includes(String(productId || ''))) throw new Error('Please choose an available customizable T-shirt.');
    const {data:p,error} = await supabase.from('products').select('*').eq('id',productId).maybeSingle();
    if(error) throw error;
    if(!p) throw new Error('Selected customizable T-shirt no longer exists.');
    if(!/^(t-shirt|tshirt|tee)$/i.test(String(p.category || '').trim())) throw new Error('Selected product is not a T-shirt.');
    const sizes=parseArr(p.sizes), colors=parseArr(p.colors);
    const item=sizes.find(s => s.size===size);
    if(!item || Number(item.qty)<qty) throw new Error('Selected size is out of stock.');
    if(!colors.some(c=>String(c).toLowerCase()===String(color).toLowerCase())) throw new Error('Selected color is not offered for this product.');
    const saleActive=Number(p.sale_percent)>0 && (!p.sale_end || new Date(p.sale_end+'T23:59:59') >= new Date());
    const base=Number(p.price)*(saleActive ? 1-Number(p.sale_percent)/100 : 1);
    if(!Number.isFinite(base)||base<0)throw new Error('Product has an invalid price.');
    return {p, base:Math.round(base*100)/100};
  }
  function parseSelection(b) {
    const size=str(b.size,5), color=str(b.color,50), qty=Number(b.quantity);
    const front=str(b.front_print_size,4), back=str(b.back_print_size,4);
    if(!SIZES.has(size)||!color||!Number.isInteger(qty)||qty<1||qty>30||!PRINTS.has(front)||!PRINTS.has(back)) throw new Error('Invalid size, color, quantity or print size.');
    return {productId:str(b.product_id,60),size,color,qty,front,back,frontText:str(b.front_text,300),backText:str(b.back_text,300)};
  }
  const hasDesign = (t,art) => Boolean(t || art);
  function price(base,front,back,qty) {const unit=Math.round((base+printCost(front)+printCost(back))*100)/100;return {unit_price:unit,subtotal:Math.round(unit*qty*100)/100};}
  // Only products deliberately allowlisted for blank-shirt customization are shown.
  // Never offer already-printed products accidentally as blank garments.
  app.get('/api/customer/customization/products',verifyCustomerToken,async(req,res)=>{
    try {
      const ids=productIds();
      if(!ids.length) return res.json({success:true,products:[],message:'No customizable products have been configured.'});
      const {data,error}=await supabase.from('products')
        .select('id,title,description,category,price,product_image,sizes,colors,quantity,sale_percent,sale_end')
        .in('id',ids);
      if(error)throw error;
      const result=(data||[]).filter(p=>/^(t-shirt|tshirt|tee)$/i.test(String(p.category||'').trim()))
        .map(p=>({
          id:p.id,title:p.title,description:p.description||'',image:p.product_image||'',category:p.category,
          price:Number(p.price)||0,
          sizes:parseArr(p.sizes).map(s=>({size:s.size,qty:Math.max(0,Number(s.qty)||0)})),
          colors:parseArr(p.colors).map(String),
          sale_percent:Number(p.sale_percent)||0,sale_end:p.sale_end||null
        }));
      return res.json({success:true,products:result});
    } catch(e){console.error('CUSTOM PRODUCT CATALOG:',e);return fail(res,500,'Unable to retrieve customizable products.');}
  });
  app.post('/api/customer/customization/quote',verifyCustomerToken,async(req,res)=>{
    try {
      if(!configOK())return fail(res,503,'Configure JCN custom product IDs and print prices on the server before checkout.');
      const b=parseSelection(req.body),{p,base}=await productFor(b.productId,b.size,b.color,b.qty);
      const front=hasDesign(b.frontText,req.body.front_artwork_present)?b.front:'none';
      const back=hasDesign(b.backText,req.body.back_artwork_present)?b.back:'none';
      return res.json({success:true, product_id:p.id, product_title:p.title, product_image:p.product_image, size:b.size,color:b.color,quantity:b.qty,base_price:base,front_print_size:front,back_print_size:back,...price(base,front,back,b.qty), currency:'PHP'});
    } catch(e) {return fail(res,400,e.message);}
  });
  app.post('/api/customer/customization/submit',verifyCustomerToken,async(req,res)=>{
    let uploaded=[];
    try {
      if(!configOK())return fail(res,503,'Configure custom product ID and print prices first.');
      const userId=getUser(req);
      if(!uuid(userId))return fail(res,401,'Login required.');
      const b=parseSelection(req.body);
      const {p,base}=await productFor(b.productId,b.size,b.color,b.qty);
      const {data:user,error:ue}=await supabase.from('customer_users').select('full_name,email').eq('id',userId).maybeSingle();
      if(ue)throw ue;
      if(!user)return fail(res,401,'Customer account not found.');
      const requestId=crypto.randomUUID();
      const images={};
      for(const side of ['front','back']) {
        const value=req.body[side+'_artwork'];
        if(!value)continue;
        if(typeof value!=='string'||value.length>7_000_000)throw new Error('Artwork must be under 5 MB.');
        const m=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
        if(!m)throw new Error('Only PNG, JPG or WEBP artwork is accepted.');
        const buffer=Buffer.from(m[2],'base64');
        if(buffer.length===0||buffer.length>5*1024*1024)throw new Error('Artwork exceeds 5 MB.');
        const actualPng=buffer.subarray(0,8).toString('hex')==='89504e470d0a1a0a';
        const actualJpg=buffer.subarray(0,3).toString('hex')==='ffd8ff';
        const actualWebp=buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP';
        if(!((m[1]==='png'&&actualPng)||(m[1]==='jpeg'&&actualJpg)||(m[1]==='webp'&&actualWebp)))throw new Error('Invalid artwork file content.');
        const ext=m[1]==='jpeg'?'jpg':m[1];const path=`${requestId}/${side}-${crypto.randomUUID()}.${ext}`;
        const {error}=await supabase.storage.from(BUCKET).upload(path,buffer,{contentType:'image/'+m[1],upsert:false});
        if(error)throw error;uploaded.push(path);images[side]=path;
      }
      const front=hasDesign(b.frontText,images.front)?b.front:'none';
      const back=hasDesign(b.backText,images.back)?b.back:'none';
      if((front==='none'&&hasDesign(b.frontText,images.front))||(back==='none'&&hasDesign(b.backText,images.back)))throw new Error('Choose a print size for each artwork.');
      const amounts=price(base,front,back,b.qty);
      const design_data={source:'personal_fit_studio',product_id:p.id,product_title:p.title,quantity:b.qty,front_text:b.frontText,back_text:b.backText,front_print_size:front,back_print_size:back,front_artwork_path:images.front||null,back_artwork_path:images.back||null,server_unit_price:amounts.unit_price,bodyfit_recommendation:req.body.recommendation?.size||null,order_id:null,checkout_status:'In cart'};
      const {data:request,error}=await supabase.from('graphic_design_requests').insert({id:requestId,user_id:userId,customer_name:user.full_name||'Customer',customer_email:user.email,apparel_type:'T-Shirt',apparel_size:b.size,apparel_color:b.color,design_text:[b.frontText,b.backText].filter(Boolean).join(' | '),design_notes:'Custom T-shirt awaiting checkout',design_data,status:'Submitted'}).select('id').single();
      if(error)throw error;
      const cartItem={cartKey:`custom-${request.id}`,product_id:p.id,title:p.title+' — Custom Design',image:p.product_image,price:amounts.unit_price,size:b.size,color:b.color,quantity:b.qty,custom_design_request_id:request.id,is_customized:true,custom_front_print_size:front,custom_back_print_size:back};
      return res.status(201).json({success:true,cart_item:cartItem,request_id:request.id,subtotal:amounts.subtotal});
    }catch(e){if(uploaded.length)await supabase.storage.from(BUCKET).remove(uploaded);console.error('CUSTOM DESIGN SUBMIT:',e);return fail(res,400,e.message);}
  });
  app.post('/api/customer/customization/link-order',verifyCustomerToken,async(req,res)=>{
    try{
      const userId=getUser(req), orderId=req.body.order_id;
      if(!uuid(userId)||!uuid(orderId))return fail(res,400,'Invalid customer or order.');
      const {data:order,error:oe}=await supabase.from('orders').select('id,user_id,inventory_items,payment_method,payment_status,status').eq('id',orderId).eq('user_id',userId).maybeSingle();
      if(oe)throw oe;
      if(!order)return fail(res,404,'Order not found for logged-in customer.');
      const ids=[...new Set((req.body.request_ids||[]).filter(uuid))].slice(0,30);
      if(!ids.length)return fail(res,400,'No custom design references given.');
      const {data:requests,error:re}=await supabase.from('graphic_design_requests').select('*').eq('user_id',userId).in('id',ids);
      if(re)throw re;
      if(requests.length!==ids.length)return fail(res,403,'Some design requests do not belong to this customer.');
      // Require the order snapshot to contain each custom request ID.
      const items=Array.isArray(order.inventory_items)?order.inventory_items:[];
      for(const request of requests){
        if(request.design_data?.order_id && request.design_data.order_id!==orderId)return fail(res,409,'Design already bound to another order.');
        if(!items.some(item=>item.custom_design_request_id===request.id))return fail(res,409,'Order does not contain this design reference. Verify order RPC preserves custom item metadata.');
      }
      for(const request of requests){
        const design_data={...request.design_data,order_id:orderId,checkout_status:order.payment_method==='PayPal'&&order.payment_status!=='Paid'?'Awaiting PayPal':'Order placed'};
        const {error}=await supabase.from('graphic_design_requests').update({design_data,design_notes:`Order ${orderId} — ${design_data.checkout_status}`}).eq('id',request.id).eq('user_id',userId);
        if(error)throw error;
      }
      return res.json({success:true,linked:requests.length});
    }catch(e){console.error('CUSTOM ORDER LINK:',e);return fail(res,500,'Unable to link design request to order.');}
  });
};
