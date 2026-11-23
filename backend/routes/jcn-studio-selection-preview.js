// JCN Studio 2.0 / Phase 1: read-only multi-variant garment preview.
// Does not create carts, reserve stock, change products, or charge payments.
module.exports = function registerStudioSelectionPreview({app, supabase}) {
  const MAX_LINES = 20;
  const MAX_QUANTITY = 30; // Match the current legacy custom-order limit for the Phase 1 preview.
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const parseArray = value => {
    if (Array.isArray(value)) return value;
    try { const parsed = JSON.parse(value || '[]'); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  };
  const cents = amount => Math.round((Number(amount) + Number.EPSILON) * 100);

  function isCustomizable(product) {
    if (Object.prototype.hasOwnProperty.call(product, 'is_customizable')) {
      return product.is_customizable === true;
    }
    const ids = String(process.env.JCN_CUSTOM_PRODUCT_IDS || process.env.JCN_CUSTOM_TSHIRT_PRODUCT_ID || '')
      .split(',').map(id => id.trim()).filter(id => UUID.test(id));
    return ids.includes(String(product.id));
  }

  function currentBasePrice(product) {
    const regular = Number(product.price);
    if (!Number.isFinite(regular) || regular < 0) return null;
    const discount = Number(product.sale_percent) || 0;
    const endRaw = String(product.sale_end || '');
    const end = endRaw ? Date.parse(endRaw.endsWith('Z') ? endRaw : endRaw.replace(' ', 'T') + 'Z') : null;
    const activeSale = discount > 0 && discount < 100 && (!end || (Number.isFinite(end) && end > Date.now()));
    return cents(regular * (activeSale ? (1 - discount / 100) : 1));
  }

  app.post('/api/customer/studio/selection-preview', async (req, res) => {
    try {
      const productId = String(req.body?.product_id || '');
      const requested = req.body?.variants;
      if (!UUID.test(productId) || !Array.isArray(requested) ||
          !requested.length || requested.length > MAX_LINES) {
        return res.status(400).json({success:false, message:'Choose an apparel and 1–20 size/color entries.'});
      }

      const {data:product, error} = await supabase.from('products')
        .select('id,title,category,price,sizes,colors,sale_percent,sale_end,is_customizable')
        .eq('id', productId).maybeSingle();
      // Older JCN projects do not have an is_customizable column yet. Retry only if absent.
      let item = product;
      if (error && String(error.code) === '42703') {
        const retry = await supabase.from('products').select('*').eq('id', productId).maybeSingle();
        if (retry.error) throw retry.error;
        item = retry.data;
      } else if (error) throw error;

      if (!item || !isCustomizable(item)) {
        return res.status(404).json({success:false, message:'Customizable apparel is not available.'});
      }

      const sizes = new Map(parseArray(item.sizes).map(v => [
        String(v?.size || '').trim(),
        Math.max(0, Math.floor(Number(v?.qty) || 0))
      ]));
      const colors = new Set(parseArray(item.colors).map(v => String(v).trim().toLowerCase()));
      const baseCents = currentBasePrice(item);
      if (baseCents === null || !colors.size || !sizes.size) {
        return res.status(409).json({success:false, message:'This apparel has incomplete pricing or inventory details.'});
      }

      const seen = new Set(), totalsBySize = new Map();
      let totalQuantity = 0;
      const variants = [];
      for (const input of requested) {
        const size = String(input?.size || '').trim();
        const color = String(input?.color || '').trim();
        const qty = Number(input?.quantity);
        const key = size + '|' + color.toLowerCase();
        if (!sizes.has(size) || !colors.has(color.toLowerCase()) ||
            !Number.isInteger(qty) || qty < 1 || seen.has(key)) {
          return res.status(400).json({success:false, message:'Invalid or duplicate size/color selection.'});
        }
        seen.add(key);
        totalQuantity += qty;
        totalsBySize.set(size, (totalsBySize.get(size) || 0) + qty);
        variants.push({size, color, quantity:qty, garment_unit_price:baseCents/100, garment_subtotal:(baseCents*qty)/100});
      }
      if (totalQuantity > MAX_QUANTITY) {
        return res.status(409).json({success:false, message:'Phase 1 preview supports up to 30 garments per design. Bulk order limits will be configurable in a later phase.'});
      }
      for (const [size, quantity] of totalsBySize) {
        if (quantity > sizes.get(size)) {
          return res.status(409).json({success:false, message:'Only ' + sizes.get(size) + ' garments remain in size ' + size + ' (shared across colors).'});
        }
      }
      res.set('Cache-Control', 'no-store');
      return res.json({
        success:true, valid:true, product_id:item.id, name:item.title,
        variants, total_quantity:totalQuantity,
        garment_subtotal:(baseCents*totalQuantity)/100,
        pricing_scope:'garment_only', stock_basis:'size_shared_across_colors',
        stock_reserved:false, checkout_ready:false,
        note:'This preview does not reserve inventory. Printing fees and final checkout validation are not included.'
      });
    } catch (error) {
      console.error('JCN STUDIO SELECTION PREVIEW:', error);
      return res.status(500).json({success:false, message:'Unable to validate garment selection right now.'});
    }
  });
};
