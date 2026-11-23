// JCN Personal Fit Studio 2.0 — isolated UI regression test.
// Usage: node --test tests/jcn-studio-v2-phase1-ui.test.js
// Simulates DOM events and API responses; not a substitute for Playwright/browser E2E.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Element {
  constructor(registry, tag='div', id='') {
    this.registry=registry; this.tag=tag; this.id=id; this.children=[];
    this.listeners={}; this.value=''; this.textContent=''; this.style={};
    this.dataset={}; this.className=''; this.disabled=false; this.readOnly=false;
    this.title=''; this.open=false; this.classList={add(){},remove(){},toggle(){}};
    if(id)registry.set(id,this);
  }
  set innerHTML(value) {
    this.raw=value;
    for(const match of value.matchAll(/id="([^"]+)"/g)) {
      if(!this.registry.has(match[1]))new Element(this.registry,'div',match[1]);
    }
  }
  get innerHTML(){return this.raw||''}
  append(...children){this.children.push(...children)}
  appendChild(element){this.append(element);return element}
  replaceChildren(...children){this.children=[...children]}
  before(){} after(){} insertBefore(element){this.children.unshift(element)}
  setAttribute(name,value){this[name]=value}
  addEventListener(name,callback){(this.listeners[name]??=[]).push(callback)}
  dispatchEvent(event){
    const handlers=[...(this.listeners[event.type]||[]),...(this['on'+event.type]?[this['on'+event.type]]:[])];
    return Promise.all(handlers.map(fn=>fn({type:event.type,target:this})));
  }
  fire(type){return this.dispatchEvent({type})}
  createTHead(){return{insertRow:()=>new Element(this.registry,'tr')}}
  createTBody(){return{insertRow:()=>new Row(this.registry,'tr')}}
}
class Row extends Element{
  insertCell(){const c=new Element(this.registry,'td');this.append(c);return c}
}

function setup() {
  const registry=new Map();
  const initial=[
    'shirtPanel','jcnStockHint','apparelCategoryFilter','demoProductList',
    'categoryResultCount','catalogSearch','productEmptyState',
    'summarySize','summaryColor','qtySummary','orderQty','garmentSubtotal',
    'itemPrice','increaseQty','decreaseQty','totalPrice',
    'jcnV2ReviewDetails','jcnV2RightVariants','nextToDesign',
    'shirtSize','shirtColor','reviewButton','selectedProductName'
  ];
  for(const id of initial)new Element(registry,'div',id);
  const get=id=>registry.get(id);
  get('shirtSize').value='S'; get('shirtColor').value='Black';
  const doc={
    getElementById:get,
    createElement:tag=>new Element(registry,tag),
    querySelector:selector=>selector==='.catalog-filter-row'?new Element(registry):null,
    addEventListener(){},querySelectorAll:()=>[]
  };
  const item1={id:'11111111-1111-4111-8111-111111111111',title:'Test Shirt',
    category:'T-Shirt',base_price:299,description:'Cotton test material',
    sizes:[{size:'S',qty:3,length:66,width:47,sleeve:20},{size:'M',qty:4,length:70,width:50,sleeve:22}],
    colors:['Black','White']};
  const item2={id:'22222222-2222-4222-8222-222222222222',title:'Alternative Shirt',
    category:'T-Shirt',base_price:399,description:'Polyester test material',
    sizes:[{size:'L',qty:9,length:72,width:54,sleeve:24}],colors:['Blue']};
  let productId=item1.id;
  const win={events:{},JCNStudio3DBridge:{selection:()=>({id:productId})},
    addEventListener(name,fn){(this.events[name]??=[]).push(fn)},
    emit(name){for(const fn of (this.events[name]||[]))fn({detail:null})}
  };
  const fetchMock=async (url,opts={})=>{
    if(url.endsWith('/catalog'))return{ok:true,json:async()=>({success:true,products:[item1,item2]})};
    assert.ok(url.endsWith('/selection-preview'));
    const body=JSON.parse(opts.body);
    const pieces=body.variants.reduce((sum,v)=>sum+v.quantity,0);
    const unit=body.product_id===item1.id?299:399;
    return{ok:true,json:async()=>({valid:true,total_quantity:pieces,garment_subtotal:pieces*unit})};
  };
  const entry=path.resolve(__dirname,'../customer/js/jcn-studio-v2-phase1.js');
  const source=fs.readFileSync(entry,'utf8');
  vm.runInNewContext(source,{
    document:doc,window:win,location:{hostname:'127.0.0.1',port:'5500'},
    fetch:fetchMock,setTimeout(fn){fn()},
    Event:class Event{constructor(type){this.type=type}},
    Intl,Number,String,Math,Set,Map,Promise
  },{filename:entry});
  return {get,win,changeProduct(id){productId=id;win.emit('jcn:studio3d-selection')},
    async loaded(){await new Promise(resolve=>setImmediate(resolve))}};
}

test('multi-size apparel matrix, stock checks, and synchronized review',async()=>{
  const app=setup(),$=app.get;
  await app.loaded();
  assert.equal($('jcnV2Info').textContent,'Cotton test material');
  assert.equal($('jcnV2SizeChoices').children.length,2);
  assert.equal($('jcnV2ColorChoices').children.length,2);
  assert.equal($('nextToDesign').disabled,true);

  $('jcnV2AddQty').value='2';
  await $('jcnV2Add').fire('click');
  assert.equal($('jcnV2Count').textContent,'2 pcs');
  assert.equal($('qtySummary').textContent,'×2');
  assert.match($('garmentSubtotal').textContent,/598/);
  assert.equal($('jcnV2RightVariants').children.length,2);
  assert.equal($('nextToDesign').disabled,true);

  await $('jcnV2Check').fire('click');
  assert.equal($('nextToDesign').disabled,false);

  $('jcnV2AddQty').value='1';
  await $('jcnV2Add').fire('click');
  assert.equal($('jcnV2Variants').children.length,1);
  assert.equal($('jcnV2Count').textContent,'3 pcs');
  assert.equal($('nextToDesign').disabled,true);

  await $('jcnV2Add').fire('click'); // would exceed size S stock=3
  assert.equal($('jcnV2Count').textContent,'3 pcs');
  assert.equal($('jcnV2Status').dataset.type,'error');

  $('shirtSize').value='M';$('shirtColor').value='White';
  await $('shirtSize').fire('change');await $('shirtColor').fire('change');
  app.win.emit('jcn:studio3d-selection');
  $('jcnV2AddQty').value='2';
  await $('jcnV2Add').fire('click');
  assert.equal($('jcnV2Count').textContent,'5 pcs');
  assert.match($('jcnV2Sum').textContent,/1,495/);
  assert.match($('garmentSubtotal').textContent,/1,495/);

  await $('jcnV2Check').fire('click');
  assert.equal($('nextToDesign').disabled,false);
  app.changeProduct('22222222-2222-4222-8222-222222222222');
  assert.equal($('jcnV2Count').textContent,'0 pcs');
  assert.equal($('nextToDesign').disabled,true);
  assert.equal($('summarySize').textContent,'Not selected');
  assert.match($('itemPrice').textContent,/399/);
  assert.equal($('reviewButton').disabled,true);
});
