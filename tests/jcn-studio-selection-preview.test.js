// Run with: node --test tests/jcn-studio-selection-preview.test.js
// Read-only unit checks: no Supabase credentials or network calls are required.
const test = require('node:test');
const assert = require('node:assert/strict');
const register = require('../backend/routes/jcn-studio-selection-preview');

const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT = {
  id: PRODUCT_ID, title: 'JCN Test Shirt', category: 'T-Shirt',
  price: 299, sale_percent: 0, sale_end: null,
  sizes: [{size:'S',qty:2},{size:'M',qty:3}],
  colors: ['Black','White']
};

function harness() {
  let action = null;
  let reads = 0;
  const app = {post(path, cb) {
    if(path === '/api/customer/studio/selection-preview') action = cb;
  }};
  const supabase = {from(table) {
    assert.equal(table, 'products');
    reads++;
    return {select() {
      return {eq(column, value) {
        assert.equal(column, 'id');
        assert.equal(value, PRODUCT_ID);
        return {maybeSingle: async () => ({data:PRODUCT,error:null})};
      }};
    }};
  }};
  register({app,supabase});
  assert.ok(action, 'Preview route was registered');
  return {
    calls: () => reads,
    async preview(body) {
      const reply = {statusCode:200, payload:null, headers:{}};
      const res = {
        status(code) {reply.statusCode=code;return this;},
        set(name,value) {reply.headers[name]=value;return this;},
        json(payload) {reply.payload=payload;return this;}
      };
      await action({body},res);
      return reply;
    }
  };
}

test('Phase 1 read-only selection preview validates stock and pricing', async t => {
  const old = process.env.JCN_CUSTOM_PRODUCT_IDS;
  process.env.JCN_CUSTOM_PRODUCT_IDS = PRODUCT_ID;
  try {
    const h = harness();

    await t.test('valid multi-size and multi-color selection', async () => {
      const r=await h.preview({product_id:PRODUCT_ID,variants:[
        {size:'S',color:'Black',quantity:2},
        {size:'M',color:'White',quantity:3}
      ]});
      assert.equal(r.statusCode,200);
      assert.equal(r.payload.valid,true);
      assert.equal(r.payload.total_quantity,5);
      assert.equal(r.payload.garment_subtotal,1495);
      assert.equal(r.payload.stock_reserved,false);
      assert.equal(r.payload.checkout_ready,false);
    });

    await t.test('size stock is shared across colors', async () => {
      const r=await h.preview({product_id:PRODUCT_ID,variants:[
        {size:'S',color:'Black',quantity:2},
        {size:'S',color:'White',quantity:1}
      ]});
      assert.equal(r.statusCode,409);
    });

    await t.test('duplicates and invalid colors are rejected', async () => {
      const dup=await h.preview({product_id:PRODUCT_ID,variants:[
        {size:'S',color:'Black',quantity:1},
        {size:'S',color:'Black',quantity:1}
      ]});
      assert.equal(dup.statusCode,400);
      const bad=await h.preview({product_id:PRODUCT_ID,variants:[
        {size:'S',color:'Red',quantity:1}
      ]});
      assert.equal(bad.statusCode,400);
    });

    await t.test('does not accept malformed product IDs', async () => {
      const r=await h.preview({product_id:'not-a-uuid',variants:[
        {size:'S',color:'Black',quantity:1}
      ]});
      assert.equal(r.statusCode,400);
    });

    assert.ok(h.calls()>0, 'Supabase mock was queried for current product data');
  } finally {
    if(old===undefined)delete process.env.JCN_CUSTOM_PRODUCT_IDS;
    else process.env.JCN_CUSTOM_PRODUCT_IDS=old;
  }
});
