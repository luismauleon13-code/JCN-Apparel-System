// JCN Studio 2.0 — focused shell regression tests (no browser or API).
// Run: node --test tests/jcn-studio-v2-focus-layout.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

class Node {
  constructor(tag='div',id='') {
    this.tag=tag;this.id=id;this.parent=null;this.children=[];this.listeners={};
    this.dataset={};this.attrs={};this.textContent='';this.style={};this.hidden=false;
    const classes=new Set();
    this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)};
  }
  detach(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
  append(...nodes){for(const x of nodes){x.detach();x.parent=this;this.children.push(x)}}
  prepend(...nodes){for(const x of nodes.reverse()){x.detach();x.parent=this;this.children.unshift(x)}}
  insertBefore(x,ref){x.detach();x.parent=this;const n=this.children.indexOf(ref);this.children.splice(n<0?this.children.length:n,0,x)}
  after(x){if(this.parent)this.parent.insertBefore(x,this.parent.children[this.parent.children.indexOf(this)+1])}
  querySelector(q){return this.special?.[q]||null}
  setAttribute(key,value){this.attrs[key]=value}
  addEventListener(name,handler){(this.listeners[name]??=[]).push(handler)}
  click(){for(const cb of this.listeners.click||[])cb({target:this,preventDefault(){},stopImmediatePropagation(){}})}
  focus(){}
  scrollIntoView(){}
  scrollTo(options){this.scrollTop=options.top}
  set innerHTML(html){
    this.html=html;
    for(const m of html.matchAll(/id="([^"]+)"/g))this.owner?.set(m[1],new Node('div',m[1]));
  }
}

function fixture(){
  const owner=new Map();
  const el=(id,tag='div')=>{const x=new Node(tag,id);x.owner=owner;owner.set(id,x);return x};
  const body=el('body'),editor=el('editorPanel'),center=el('center'),
    header=el('header'),guidance=el('bottomGuidance'),summary=el('summary'),
    actions=el('actions'),steps=el('steps'),intro=el('intro'),sectionHead=el('head'),
    selected=el('activeTab');
  selected.dataset.step='shirt';selected.classList.add('active');
  for(const id of ['shirtPanel','bodyfitPanel','designPanel','reviewPanel','designStage',
    'cameraStage','reviewButton','basePrice','jcnV2Browse','catalogSearch','jcnV2Status','jcnV2Add'])el(id);
  owner.get('shirtPanel').special={'.section-title-row':sectionHead};
  owner.get('shirtPanel').append(sectionHead);
  editor.special={'.steps-list':steps,'.editor-intro':intro};
  header.special={'.header-actions':actions};
  editor.append(intro,steps,...['shirtPanel','bodyfitPanel','designPanel','reviewPanel'].map(id=>owner.get(id)));
  center.append(owner.get('designStage'),owner.get('cameraStage'),guidance);
  header.append(actions);body.append(header,editor,center,summary);
  const listeners={};
  const document={
    body,createElement:tag=>{const x=new Node(tag);x.owner=owner;return x},
    getElementById:id=>owner.get(id),
    querySelector:q=>({
      '.center-panel':center,'.site-header':header,'.order-panel':summary,
      '.step-card.active':selected,'.step-card[data-step="shirt"]':selected
    })[q]||null,
    addEventListener(name,handler){(listeners[name]??=[]).push(handler)}
  };
  let validated=false;
  const window={
    events:{},JCNStudio3DBridge:{selection:()=>({name:'JCN Shirt',category:'T-Shirt',size:'M',color:'Black'})},
    JCNStudioPhase1State:{canContinue:()=>validated},
    addEventListener(name,handler){(this.events[name]??=[]).push(handler)},
    emit(name,detail){for(const fn of this.events[name]||[])fn({detail})}
  };
  const script=fs.readFileSync(path.join(__dirname,'../customer/js/jcn-studio-v2-focus-layout.js'),'utf8');
  vm.runInNewContext(script,{document,window,console:{warn(){}},Object,Boolean,String}, {filename:'jcn-studio-v2-focus-layout.js'});
  const focus=center.children.find(x=>x.id==='jcnFocusMain');
  return {owner,body,editor,center,focus,window,listeners,actions,sectionHead,steps,setValidated:v=>validated=v};
}
test('focused shell preserves stage IDs and isolates the workflow',()=>{
  const f=fixture();
  assert.ok(f.focus);
  assert.equal(f.editor.children.some(x=>x.id==='shirtPanel'),false);
  assert.deepEqual(f.focus.children[0].children.map(x=>x.id),['shirtPanel','bodyfitPanel','designPanel','reviewPanel']);
  assert.ok(f.focus.children[1].children.some(x=>x.id==='designStage'));
  assert.ok(f.focus.children[1].children.some(x=>x.id==='cameraStage'));
  assert.ok(f.sectionHead.parent.children.some(x=>x.id==='jcnFocusProductHero'));
  assert.equal(f.body.dataset.jcnFocusStep,'shirt');
  f.window.emit('jcn:studio3d-step',{step:'bodyfit'});
  assert.equal(f.body.dataset.jcnFocusStep,'bodyfit');
  assert.equal(f.owner.get('jcnFocusStepTitle').textContent,'Find your fit');
});
test('order summary can open and close without changing workflow',()=>{
  const f=fixture();
  const btn=f.actions.children.find(x=>x.id==='jcnFocusSummaryToggle');
  assert.ok(btn);
  btn.click();
  assert.equal(f.body.classList.contains('jcn-focus-show-summary'),true);
  btn.click();
  assert.equal(f.body.classList.contains('jcn-focus-show-summary'),false);
});
test('clicking steps cannot bypass missing apparel validation',()=>{
  const f=fixture();
  const e={target:{closest(){return{dataset:{step:'review'}}}},preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};
  for(const callback of f.listeners.click||[])callback(e);
  assert.equal(e.prevented,true);
  assert.equal(e.stopped,true);
  f.setValidated(true);
  const allowed={target:e.target,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};
  for(const callback of f.listeners.click||[])callback(allowed);
  assert.notEqual(allowed.prevented,true);
});
