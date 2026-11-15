// JCN Realistic 3D Apparel Viewer — Phase 2 Step 2
// The approved Phase 1.3 UI and Supabase product catalog stay in charge of state.
// T-Shirt model: JCN verified static GLB. Other categories require their own model.
// Print layers are illustrative floating planes, not accurate UV/DTF placement.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const stage = $('designStage');
const host = $('jcnGLBViewer');
const status = $('jcnModelStatus');
const fallback = $('jcnModelFallback');
const fallbackImage = $('jcnModelFallbackImage');
const fallbackTitle = $('jcnModelFallbackTitle');
const realButton = $('jcnViewReal3D');
const placeButton = $('jcnEditPlacement');
const bridge = window.JCNStudio3DBridge;

if (!stage || !host || !bridge) {
  console.warn('JCN Studio 3D: missing view container or product state bridge.');
} else {
  const MODEL_PATHS = {
    'T-Shirt': ['../assets/models/avatar/jcn-avatar.glb', '../assets/models/phase2/jcn-reference-avatar.glb'],
    'Hoodie': ['../assets/models/studio/jcn-hoodie-look.glb'],
    'Polo Shirt': ['../assets/models/studio/jcn-polo-look.glb'],
    'Sweatshirt': ['../assets/models/studio/jcn-sweatshirt-look.glb']
  };
  const COLOR_HEX = {
    'black':'#161616', 'white':'#f4f4ee', 'navy blue':'#24374c',
    'blue':'#2770a9', 'red':'#a92430', 'maroon':'#6d2638',
    'gray':'#888888','grey':'#888888','cream':'#e9e1cf','mustard':'#d4ac3b',
    'army green':'#516340','dark green':'#264d38','deep royal':'#264ead',
    'pink':'#e3a9b4','brown':'#8d5b38','rust':'#b65e3c',
    'mint':'#91c8b7','taupe':'#a98d76'
  };
  const tint = new THREE.Color('#161616');
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#dadbd3');
  const camera = new THREE.PerspectiveCamera(40, 1, 0.01, 140);
  camera.position.set(0, .8, 6.8);
  const renderer = new THREE.WebGLRenderer({antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.domElement.setAttribute('aria-label', 'Rotatable realistic JCN 3D apparel avatar');
  host.append(renderer.domElement);
  const light1 = new THREE.HemisphereLight(0xffffff, 0x777b85, 2.3);
  scene.add(light1);
  const light2 = new THREE.DirectionalLight(0xffffff, 3.2);
  light2.position.set(4,6,5);
  scene.add(light2);
  const fill = new THREE.DirectionalLight(0xffffff, 1.4);
  fill.position.set(-3,3,-5);
  scene.add(fill);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.enablePan = false;
  orbit.minDistance = 1.4;
  orbit.maxDistance = 16;
  orbit.target.set(0, .55, 0);
  orbit.maxPolarAngle = Math.PI * .95;
  orbit.update();
  const loader = new GLTFLoader();
  let garmentRoot = null;
  let rawScene = null;
  let currentCategory = null;
  let modelState = 'empty';
  let mode = '3d';
  let autoRotate = false;
  let loadId = 0;
  let activeModelLabel = '';
  let bodySizeFactor = 1;
  let paintDebounce = 0;
  const failedPaths = new Set();
  const renderTextures = {front:null,back:null};
  const imageCache = new Map();
  const needPrintTexture = category => category === 'T-Shirt';
  const product = () => bridge.selection();
  const setStatus = message => {status.textContent=message;};
  const angles = {front:0, right:Math.PI/2, back:Math.PI, left:-Math.PI/2};

  function disposeCurrent() {
    if (!garmentRoot) return;
    scene.remove(garmentRoot);
    garmentRoot.traverse(object => {
      if (!object.isMesh) return;
      object.geometry?.dispose();
      const materials=Array.isArray(object.material)?object.material:[object.material];
      materials.forEach(m => {
        if (!m) return;
        for (const key of ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap']) {
          // glTF texture objects may be shared; release when old avatar is removed.
          m[key]?.dispose?.();
        }
        m.dispose?.();
      });
    });
    garmentRoot = null;
    rawScene = null;
    renderTextures.front = null;
    renderTextures.back = null;
  }

  function syncSize() {
    if (!garmentRoot) return;
    const sizes=['XS','S','M','L','XL','2XL','3XL'];
    const index=sizes.indexOf(product()?.size || 'M');
    bodySizeFactor = index<0?1:1+(index-2)*.015;
    // Illustrative scaling ONLY, not true graded pattern geometry.
    garmentRoot.scale.set(bodySizeFactor, 1, bodySizeFactor);
  }

  function setShirtTint(color) {
    const normalized = String(color || '').trim().toLowerCase();
    const hex = COLOR_HEX[normalized] || (/^#[0-9a-f]{6}$/i.test(normalized)?normalized:null);
    if (hex) tint.set(hex);
    else setStatus('Color '+color+' is listed but has no verified 3D color mapping. Order color remains '+color+'.');
  }

  function prepareClothingMaterials(sceneRoot) {
    sceneRoot.traverse(object=>{
      if (!object.isMesh) return;
      const name = (String(object.name||'')+' '+String(object.material?.name||'')).toLowerCase();
      if(!/casualsuit|shirt|clothing|garment/.test(name)) return;
      // Preserve the original MakeHuman material image and tint only its upper shirt section.
      // The model has one outfit mesh covering both T-shirt and jeans.
      const materials=Array.isArray(object.material)?object.material:[object.material];
      const patched=materials.map(base=>{
        const material=base.clone();
        const prior=material.onBeforeCompile;
        material.onBeforeCompile = shader=>{
          if (typeof prior==='function') prior(shader);
          shader.uniforms.jcnShirtTint = {value:tint};
          shader.vertexShader=shader.vertexShader
            .replace('#include <common>','#include <common>\nvarying float vJcnShirtHeight;')
            .replace('#include <begin_vertex>','#include <begin_vertex>\nvJcnShirtHeight=position.y;');
          shader.fragmentShader=shader.fragmentShader
            .replace('#include <common>','#include <common>\nvarying float vJcnShirtHeight;\nuniform vec3 jcnShirtTint;')
            .replace('#include <color_fragment>','#include <color_fragment>\nfloat jcnMask=smoothstep(0.82,0.94,vJcnShirtHeight);\ndiffuseColor.rgb=mix(diffuseColor.rgb,jcnShirtTint,jcnMask*0.96);');
        };
        material.customProgramCacheKey=()=> 'JCN_Shirt_Tint_Phase2_Step2';
        material.needsUpdate=true;
        return material;
      });
      object.material=Array.isArray(object.material)?patched:patched[0];
    });
  }

  function createPrintPlane(side) {
    const canvas=document.createElement('canvas');
    canvas.width=512;
    canvas.height=512;
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    const material=new THREE.MeshBasicMaterial({
      map:texture,transparent:true,opacity:1,depthTest:true,depthWrite:false,
      side:THREE.FrontSide,polygonOffset:true,polygonOffsetFactor:-2
    });
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.28,.30),material);
    mesh.position.set(0,1.18,side==='front'?.195:-.139);
    if(side==='back')mesh.rotation.y=Math.PI;
    mesh.renderOrder=15;
    mesh.visible=false;
    rawScene.add(mesh);
    renderTextures[side]={canvas,texture,mesh};
  }

  async function getImage(url) {
    if (!url) return null;
    if (imageCache.has(url)) return imageCache.get(url);
    const load = new Promise(resolve=>{
      const img=new Image();
      img.onload=()=>resolve(img);
      img.onerror=()=>resolve(null);
      img.src=url;
    });
    imageCache.set(url,load);
    return load;
  }

  async function paintPrints() {
    if (!garmentRoot || currentCategory!=='T-Shirt') return;
    const lists=bridge.layers();
    for (const side of ['front','back']) {
      const surface=renderTextures[side];
      if (!surface) continue;
      const {canvas,texture,mesh}=surface;
      const ctx=canvas.getContext('2d');
      ctx.clearRect(0,0,512,512);
      const layers=(lists[side]||[]).filter(layer=>!layer.hidden);
      for (const layer of layers) {
        ctx.save();
        const x=layer.x/100*512;
        const y=layer.y/100*512;
        ctx.translate(x,y);
        ctx.rotate((Number(layer.rotate)||0)*Math.PI/180);
        ctx.globalAlpha=Math.max(0,Math.min(1,(Number(layer.opacity)||100)/100));
        const scale=Math.max(.2,Math.min(3,(Number(layer.scale)||100)/100));
        ctx.scale(scale,scale);
        if(layer.kind==='image') {
          const url=bridge.imageUrl(layer.id);
          const img=await getImage(url);
          if(img){const ratio=Math.min(148/img.width,148/img.height);ctx.drawImage(img,-img.width*ratio/2,-img.height*ratio/2,img.width*ratio,img.height*ratio);}
        } else {
          ctx.textAlign='center';ctx.textBaseline='middle';
          ctx.fillStyle=layer.color||'#151718';
          ctx.strokeStyle='rgba(255,255,255,.8)';ctx.lineWidth=1.5;
          ctx.font=layer.kind==='shape'?'bold 105px Arial':'bold 42px '+(layer.font||'Arial');
          const content=String(layer.kind==='shape'?layer.symbol:layer.text||'').slice(0,38);
          ctx.strokeText(content,0,0,460);
          ctx.fillText(content,0,0,460);
        }
        ctx.restore();
      }
      mesh.visible=layers.length>0;
      texture.needsUpdate=true;
    }
  }

  function schedulePaint() {
    clearTimeout(paintDebounce);
    paintDebounce=setTimeout(()=>paintPrints().catch(err=>console.warn('3D print preview:',err)),85);
  }

  function fitLoadedAvatar(modelScene) {
    const bbox=new THREE.Box3().setFromObject(modelScene);
    const size=bbox.getSize(new THREE.Vector3());
    const center=bbox.getCenter(new THREE.Vector3());
    const span=Math.max(size.x,size.y,size.z);
    if (!Number.isFinite(span) || span<.0001) throw new Error('GLB has no readable geometry.');
    const fitted=new THREE.Group();
    modelScene.position.sub(center);
    modelScene.scale.setScalar(3.5/span);
    fitted.add(modelScene);
    fitted.position.y=.6;
    return fitted;
  }

  function frame() {
    if(!garmentRoot)return;
    const bbox=new THREE.Box3().setFromObject(garmentRoot);
    const size=bbox.getSize(new THREE.Vector3());
    const center=bbox.getCenter(new THREE.Vector3());
    const w=host.clientWidth||600;
    const h=host.clientHeight||700;
    camera.aspect=w/h;
    camera.updateProjectionMatrix();
    const vertical=THREE.MathUtils.degToRad(camera.fov);
    const horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
    const dist=Math.max((size.y/2)/Math.tan(vertical/2),(size.x/2)/Math.tan(horizontal/2),1.5)*1.28+size.z/2;
    orbit.target.copy(center);
    const direction=camera.position.clone().sub(orbit.target);
    const radius=direction.length()>.1?direction.normalize():new THREE.Vector3(0,0,1);
    camera.position.copy(center).addScaledVector(radius,dist);
    orbit.minDistance=Math.max(1,dist*.26);
    orbit.maxDistance=Math.max(12,dist*2.6);
    orbit.update();
  }

  function view(angle) {
    if (!garmentRoot)return;
    const theta=angles[angle];
    if (theta===undefined) {
      if(angle==='360') {autoRotate=true;orbit.autoRotate=true;orbit.autoRotateSpeed=1.5;}
      return;
    }
    autoRotate=false;orbit.autoRotate=false;
    const dist=Math.max(2.7,camera.position.distanceTo(orbit.target));
    camera.position.set(orbit.target.x+Math.sin(theta)*dist,orbit.target.y,orbit.target.z+Math.cos(theta)*dist);
    orbit.update();
  }

  function syncViewButtons() {
    realButton.classList.toggle('active',mode==='3d');
    placeButton.classList.toggle('active',mode==='placement');
    realButton.setAttribute('aria-pressed',String(mode==='3d'));
    placeButton.setAttribute('aria-pressed',String(mode==='placement'));
  }

  function showPhoto(selected,message) {
    host.hidden=true;fallback.hidden=false;
    fallbackImage.src=selected?.image||'../assets/phase1/white-shirt.svg';
    fallbackImage.alt=selected?.name||'Selected apparel';
    fallbackTitle.textContent=selected?.name||'No customizable apparel selected';
    modelState='photo';
    stage.classList.remove('jcn-3d-mode','jcn-place-mode');
    stage.classList.add('jcn-photo-mode');
    setStatus(message);
    syncViewButtons();
  }

  function showModel() {
    if(!garmentRoot)return;
    modelState='ready';
    host.hidden=false;fallback.hidden=true;
    mode='3d';
    stage.classList.remove('jcn-place-mode','jcn-photo-mode');
    stage.classList.add('jcn-3d-mode');
    syncViewButtons();
    window.JCNStudio3DReady=true;
    syncSize();
    setShirtTint(product()?.color);
    frame();view(bridge.view()==='back'?'back':'front');
    schedulePaint();
    setStatus('Real Blender avatar · '+(product()?.color||'')+' / '+(product()?.size||'')+' · drag to rotate · approximate fit.');
  }

  async function loadCategory(category,selected,token) {
    const paths=MODEL_PATHS[category]||[];
    if(!paths.length){showPhoto(selected,'No matching 3D garment model yet. Showing the actual catalog image.');return;}
    for(const path of paths){
      if (failedPaths.has(path)) continue;
      try {
        setStatus('Loading '+category+' 3D model…');
        const gltf=await loader.loadAsync(new URL(path,import.meta.url).href);
        if (token!==loadId) {
          // A newer product selection superseded this load.
          return;
        }
        disposeCurrent();
        rawScene=gltf.scene;
        if (category==='T-Shirt')prepareClothingMaterials(rawScene);
        const fitted=fitLoadedAvatar(rawScene);
        if(category==='T-Shirt'){
          createPrintPlane('front');
          createPrintPlane('back');
        }
        garmentRoot=fitted;
        scene.add(garmentRoot);
        activeModelLabel=path;
        currentCategory=category;
        showModel();
        return;
      } catch(error){
        console.warn('JCN model not available:',path,error);
        failedPaths.add(path);
      }
    }
    if(token===loadId)showPhoto(selected,'3D '+category+' GLB not installed or unreadable. Showing actual product image; no false 3D preview.');
  }

  async function selectionChanged(){
    const selected=product();
    if(!selected){loadId++;showPhoto(null,'Choose a customizable apparel in 01 Shirt to begin.');return;}
    if (selected.category === currentCategory && garmentRoot){
      setShirtTint(selected.color);
      syncSize();
      if(modelState!=='ready' && mode!=='placement')showModel();
      if(mode==='3d')setStatus('Real '+selected.category+' model · '+selected.color+' / '+selected.size+' · visual fit only.');
      return;
    }
    loadId++;
    const token=loadId;
    if(currentCategory!==selected.category) {
      disposeCurrent();
      currentCategory=null;
    }
    if (selected.category!=='T-Shirt')showPhoto(selected,'Checking whether a real '+selected.category+' GLB is available…');
    else setStatus('Loading realistic JCN Blender T-shirt avatar…');
    await loadCategory(selected.category,selected,token);
  }

  function setMode(next) {
    if(next==='placement') {
      if(!product() || product().category!=='T-Shirt') {
        setStatus('This apparel needs its own garment GLB before accurate print placement is possible.');
        return;
      }
      mode='placement';
      stage.classList.remove('jcn-3d-mode','jcn-photo-mode');
      stage.classList.add('jcn-place-mode');
      host.hidden=true;fallback.hidden=true;
      setStatus('Edit Placement: drag elements on the shirt reference, then click Real 3D Preview to check an approximate 3D print.');
    } else {
      mode='3d';
      if(garmentRoot && currentCategory===product()?.category)showModel();
      else showPhoto(product(),'No matching 3D garment yet; product photo is displayed.');
    }
    syncViewButtons();
  }

  function command(action) {
    if(mode==='placement')setMode('3d');
    if(!garmentRoot || modelState==='photo') {
      setStatus('3D controls require an installed matching garment GLB.');
      return;
    }
    const dist=camera.position.clone().sub(orbit.target);
    if(action==='zoomIn'||action==='zoomOut') {
      const scale=action==='zoomIn'?.82:1.22;
      camera.position.copy(orbit.target).add(dist.multiplyScalar(scale));
      orbit.update();
    } else if(action==='autoRotate') {
      autoRotate=!autoRotate;orbit.autoRotate=autoRotate;orbit.autoRotateSpeed=1.5;
    } else if(action==='reset') {
      autoRotate=false;orbit.autoRotate=false;frame();view('front');
    } else if(action==='move') {
      setStatus('Drag on the model to rotate. Scroll or use +/− for zoom.');
    } else if(action==='addView') {
      setStatus('Use Front, Back, Left, Right or 360° to inspect the garment.');
    }
  }

  function resize() {
    const width=host.clientWidth||1,height=host.clientHeight||1;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;
    camera.updateProjectionMatrix();
  }

  function animate() {
    requestAnimationFrame(animate);
    if(document.hidden || stage.hidden || mode!=='3d'||!garmentRoot) return;
    resizeIfNeeded();
    orbit.update();
    renderer.render(scene,camera);
  }
  let lastW=0,lastH=0;
  function resizeIfNeeded() {
    const w=host.clientWidth,h=host.clientHeight;
    if(w && h && (w!==lastW||h!==lastH)) {
      lastW=w;lastH=h;resize();
    }
  }
  const observer=new ResizeObserver(resizeIfNeeded);
  observer.observe(stage);
  realButton.onclick=()=>setMode('3d');
  placeButton.onclick=()=>setMode('placement');
  window.addEventListener('jcn:studio3d-selection',selectionChanged);
  window.addEventListener('jcn:studio3d-layers',schedulePaint);
  window.addEventListener('jcn:studio3d-view',event=>{
    if (mode==='placement')setMode('3d');
    view(event.detail?.view);
  });
  window.addEventListener('jcn:studio3d-step',event=>{
    if(event.detail?.step !== 'bodyfit')setTimeout(resizeIfNeeded,80);
  });
  window.JCNStudio3D={setMode,command,repaint:schedulePaint};
  window.JCNStudio3DReady=false;
  setMode('3d');
  selectionChanged();
  resize();
  animate();
}
