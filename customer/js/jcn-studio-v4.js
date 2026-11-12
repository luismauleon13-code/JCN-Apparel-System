// JCN Studio V4: visual upgrade only. Keep working avatar, BodyFit and saved draft logic.
(() => {
  if (window.__jcnStudioV4) return;
  window.__jcnStudioV4 = true;
  const $ = id => document.getElementById(id);
  const make = (tag,cls,txt) => {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(txt)e.textContent=txt;
    return e;
  };
  const navLinks=[
    ['fa-house','Home','customer-home.html'],
    ['fa-shirt','Shop Products','customer-shop.html'],
    ['fa-palette','Customization','customer-customize.html'],
    ['fa-bell','Notifications','customer-notifications.html'],
    ['fa-cart-shopping','Cart','customer-cart.html'],
    ['fa-bag-shopping','Orders','customer-orders.html'],
    ['fa-user','Profile','customer-settings.html']
  ];
  const sidebar=make('aside','jcn-v4-sidebar');
  sidebar.id='jcnV4Nav';sidebar.setAttribute('aria-label','Customer navigation');
  const brand=make('div','jcn-v4-brand');
  brand.innerHTML='<span class="jcn-v4-brand-circle">J</span><span class="jcn-v4-name"><b>JCN</b><small>Apparel Printing</small></span>';
  sidebar.append(brand);
  const nav=make('nav','jcn-v4-links');
  navLinks.forEach(([icon,label,href]) => {
    const a=make('a','jcn-v4-link');a.href=href;
    a.innerHTML='<i class="fa-solid '+icon+'" aria-hidden="true"></i><span></span>';
    a.querySelector('span').textContent=label;
    a.title=label;
    if(label==='Customization'){a.classList.add('is-active');a.setAttribute('aria-current','page');}
    nav.append(a);
  });
  sidebar.append(nav);
  const footer=make('div','jcn-v4-foot');
  const logout=make('button','jcn-v4-link jcn-v4-logout');
  logout.type='button';logout.title='Logout';logout.innerHTML='<i class="fa-solid fa-right-from-bracket" aria-hidden="true"></i><span>Logout</span>';
  logout.addEventListener('click',()=>{$('customerLogoutBtn')?.click();});
  footer.append(logout);sidebar.append(footer);
  document.body.insertBefore(sidebar,document.body.firstChild);
  // Preserve prototype controls: never default to auto-collapsing the Shirt/Design/BodyFit and order columns.
  document.body.classList.remove('jcn-focus-mode');
  localStorage.setItem('jcn-focus-preference','off');
  const mode=$('jcnFocusToggle');
  if(mode)mode.textContent='⛶ Focus View';
  // Add a clearer step navigator while retaining the original step event handlers.
  const steps=document.querySelector('.steps');
  if(steps){
    const descriptions={shirt:'Choose your real T-shirt',design:'Artwork & print placement',you:'Camera sizing & fit'};
    steps.querySelectorAll('[data-step]').forEach(button=>{
      const kind=button.dataset.step;
      button.title=descriptions[kind]||kind;
      button.setAttribute('aria-label',button.textContent.trim()+'. '+(descriptions[kind]||''));
    });
  }
  // Central model is the original Three.js canvas; DO NOT replace its DOM or rewrite viewer loader.
  const model=document.querySelector('.model-panel');
  if(model){
    const tag=make('span','jcn-v4-preview-tag','3D LIVE PREVIEW');
    model.append(tag);
  }
  const cameraModal=$('jcnCameraWorkspace');
  if(cameraModal){
    const title=cameraModal.querySelector('h2');
    if(title)title.textContent='Live BodyFit Camera';
    const desc=cameraModal.querySelector('header p');
    if(desc)desc.textContent='Keep your body clearly in the large frame. Scan front, then side. Use the result as size guidance, not an exact measurement.';
    const status=make('div','jcn-v4-camera-tip');
    status.innerHTML='<i class="fa-solid fa-person" aria-hidden="true"></i><div><strong>BODY SCAN IN PROGRESS</strong><small>Move back until your shoulders and hips are visible. Stand upright and keep the camera steady.</small></div>';
    cameraModal.querySelector('header')?.append(status);
    const result=make('div','jcn-v4-camera-result');
    result.innerHTML='<b>SIZE RECOMMENDATION</b><strong id="jcnV4ScanSize">Awaiting scan</strong><small>Complete front and side captures for a suggested JCN size.</small>';
    cameraModal.querySelector('#jcnCameraPortal')?.append(result);
    const update=()=>{
      const v=$('sizeValue')?.textContent?.trim();
      const out=$('jcnV4ScanSize');
      if(out && v && v!=='—')out.textContent=v;
    };
    if($('sizeValue'))new MutationObserver(update).observe($('sizeValue'),{characterData:true,childList:true,subtree:true});
    update();
    const returnBtn=$('jcnReturn3D');
    if(returnBtn)returnBtn.textContent='Continue to 3D Avatar →';
  }
  // Show short contextual next-step guidance rather than burying actions in the side panels.
  const summary=document.querySelector('.studio-summary');
  if(summary){
    const tip=make('p','jcn-v4-summary-hint','Review the real T-shirt, print selection, size and server-confirmed price before adding to cart.');
    const saveArea=summary.querySelector('.save-area');
    if(saveArea)saveArea.insertBefore(tip,saveArea.firstChild);
  }
})();
