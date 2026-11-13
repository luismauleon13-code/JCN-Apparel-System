// JCN Real Customizable Apparel Catalog (read-only)
// Separate from current T-shirt-only order /quote and /submit routes.
// Register before any /api 404 handler: require('./backend/routes/jcn-studio-catalog')({app,supabase});
module.exports = function registerJCNStudioCatalog({app,supabase}) {
  const CATEGORIES = new Map([
    ['t shirt','T-Shirt'],['tshirt','T-Shirt'],['tee','T-Shirt'],
    ['hoodie','Hoodie'],['polo shirt','Polo Shirt'],['polo','Polo Shirt'],
    ['sweatshirt','Sweatshirt'],['crewneck','Sweatshirt']
  ]);
  const canonical = value => CATEGORIES.get(String(value || '').toLowerCase().trim().replace(/[-_]+/g,' '));
  const validId = v => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v || ''));
  const allowlistedIds = () => String(process.env.JCN_CUSTOM_PRODUCT_IDS || process.env.JCN_CUSTOM_TSHIRT_PRODUCT_ID || '')
    .split(',').map(x=>x.trim()).filter(validId);
  const arr = value => {
    if(Array.isArray(value))return value;
    try {const x=JSON.parse(value || '[]');return Array.isArray(x)?x:[];}catch{return [];}
  };
  app.get('/api/customer/studio/catalog', async (req,res)=>{
    try {
      // Catalog is public shop information; sensitive Supabase keys remain server-side.
      const {data,error} = await supabase.from('products').select('*').limit(500);
      if(error)throw error;
      const rows = data || [];
      const hasFlag = rows.some(row=>Object.prototype.hasOwnProperty.call(row,'is_customizable'));
      const idSet = new Set(allowlistedIds());
      // Until opt-in flag is added, only allowlisted blank products are selectable.
      // Once is_customizable column exists, it becomes the ONLY selection rule.
      const allowed = rows.filter(row=>hasFlag ? row.is_customizable===true : idSet.has(row.id));
      const products = allowed.map(row=>{
        const category=canonical(row.category);
        if(!category)return null;
        const sizes=arr(row.sizes).map(s=>({
          size:String(s?.size||''),qty:Math.max(0,Math.floor(Number(s?.qty)||0)),
          length:Number(s?.length)||null,width:Number(s?.width)||null,sleeve:Number(s?.sleeve)||null
        })).filter(s=>s.size);
        const colors=arr(row.colors).map(x=>String(x).trim()).filter(Boolean);
        const stock=sizes.reduce((total,s)=>total+s.qty,0);
        const base=Number(row.price);
        if(!sizes.some(s=>s.qty>0)||!colors.length||stock<=0||!Number.isFinite(base)||base<0)return null;
        const end=row.sale_end ? Date.parse(String(row.sale_end).endsWith('Z') ? String(row.sale_end) : String(row.sale_end).replace(' ','T')+'Z') : null;
        const discount=Number(row.sale_percent);
        const saleActive=discount>0&&discount<100&&(!end || (Number.isFinite(end)&&end>Date.now()));
        return {
          id:row.id,title:String(row.title||''),description:String(row.description||''),category,
          image:row.product_image||'',base_price:Math.round(base*(saleActive?1-discount/100:1)*100)/100,
          price:base,colors,sizes,quantity:stock
        };
      }).filter(Boolean);
      return res.json({success:true,mode:hasFlag?'admin_flag':'existing_allowlist',products});
    } catch(error) {
      console.error('JCN STUDIO CATALOG:',error);
      return res.status(500).json({success:false,message:'Unable to retrieve customizable apparel.'});
    }
  });
};
