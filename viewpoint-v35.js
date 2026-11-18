/* Shinshu Atlas: select a location in 2D, then view terrain from that spot. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
let selecting=false,point=null,marker=null,observer=false,terrainMap=null,revision=0,previousExaggeration=null,hiddenLayers=new Map(),dragging=false,dragX=0,dragY=0,lastMove=0;
const LIMIT={south:35.15,north:37.07,west:137.24,east:138.94};
function message(s){const el=$('observer-status');if(el)el.textContent=s;}
function selectMode(active){
 selecting=active;
 const btn=$('observer-pick');
 if(btn){btn.textContent=active?'地点の指定を中止':'地図上で地点を指定';btn.setAttribute('aria-pressed',String(active));}
 const map=typeof store!=='undefined'&&store.map;
 if(map)map.getContainer().style.cursor=active?'crosshair':'';
 if(active)message('2D地図で眺めたい地点をクリックしてください。');
}
function saveMarker(ll){
 point={lat:ll.lat,lng:ll.lng};
 if(marker)marker.setLatLng(ll);
 else marker=L.circleMarker(ll,{radius:9,color:'#b04d21',fillColor:'#ffd4a6',fillOpacity:1,weight:3}).addTo(store.map);
 $('observer-location').textContent='選択地点: '+point.lat.toFixed(5)+', '+point.lng.toFixed(5);
 $('observer-start').disabled=false;
}
function pick(ll){
 if(!selecting)return;
 if(ll.lat<LIMIT.south||ll.lat>LIMIT.north||ll.lng<LIMIT.west||ll.lng>LIMIT.east){
  message('長野県付近の地点を指定してください。');return;
 }
 saveMarker(ll);
 selectMode(false);
 store.map.closePopup();
 message('地点を選択しました。「この地点から眺める」を押してください。');
}
function heading(){return Number($('observer-direction').value);}
function height(){return Number($('observer-height').value);}
function setHeading(v){$('observer-direction').value=String(((Math.round(v)%360)+360)%360);showHeading();}
function setPitch(v){$('observer-pitch').value=String(Math.max(60,Math.min(120,Math.round(v))));showPitch();}
function moveObserver(forward,side){
 if(!observer||!point)return;
 const speed=Number($('observer-speed')?.value||20);
 const b=heading()*Math.PI/180;
 const north=(forward*Math.cos(b)-side*Math.sin(b))*speed;
 const east=(forward*Math.sin(b)+side*Math.cos(b))*speed;
 const lat=point.lat+north/111320;
 const lng=point.lng+east/(111320*Math.max(0.2,Math.cos(point.lat*Math.PI/180)));
 if(lat<LIMIT.south||lat>LIMIT.north||lng<LIMIT.west||lng>LIMIT.east)return;
 point={lat,lng};
 $('observer-location').textContent='選択地点: '+lat.toFixed(5)+', '+lng.toFixed(5);
 $('observer-ground').dataset.elevation='';
 applyView(true);
}
function bindStreetControls(map){
 const canvas=map.getCanvas();
 canvas.addEventListener('pointerdown',e=>{
  if(!observer||e.button!==0)return;
  dragging=true;dragX=e.clientX;dragY=e.clientY;
  canvas.setPointerCapture(e.pointerId);
  e.preventDefault();
 });
 canvas.addEventListener('pointermove',e=>{
  if(!dragging||!observer)return;
  const dx=e.clientX-dragX,dy=e.clientY-dragY;
  dragX=e.clientX;dragY=e.clientY;
  setHeading(heading()+dx*0.35);
  setPitch(pitch()-dy*0.15);
  if(performance.now()-lastMove>40){lastMove=performance.now();applyView(false);}
  e.preventDefault();
 });
 const end=()=>{if(dragging&&observer)applyView(false);dragging=false;};
 canvas.addEventListener('pointerup',end);
 canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('lostpointercapture',end);
}
function pitch(){return Number($('observer-pitch')?.value||78);}
function showPitch(){const x=$('observer-pitch-value');if(x){const angle=90-pitch();x.textContent=angle===0?'水平 0°':angle>0?'下向き '+angle+'°':'上向き '+(-angle)+'°';}}
function hideMapLabels(map){
 hiddenLayers.clear();
 for(const id of ['old-municipal-labels','old-municipal-lines','old-municipal-fill','atlas-place-labels','atlas-poi-labels','atlas-poi-points']){
  if(!map.getLayer(id))continue;
  const old=map.getLayoutProperty(id,'visibility')||'visible';
  hiddenLayers.set(id,old);
  map.setLayoutProperty(id,'visibility','none');
 }
}
function restoreMapLabels(map){
 for(const [id,visibility] of hiddenLayers)if(map?.getLayer(id))map.setLayoutProperty(id,'visibility',visibility);
 hiddenLayers.clear();
}
function showHeading(){
 const dir=Math.round(heading());
 const name=['北','北東','東','南東','南','南西','西','北西'][Math.round(dir/45)%8];
 $('observer-heading-value').textContent=name+' '+dir+'°';
}
function isVisible(){return window.shinshuTerrain?.isActive?.()&&!!terrainMap;}
async function sampleHeight(map,ll,token){
 // Move close enough for DEM tiles to load before asking for ground height.
 map.jumpTo({center:[ll.lng,ll.lat],zoom:14,pitch:45,bearing:heading()});
 const terrain=map.getTerrain?.();
 if(!terrain)throw Error('地形データの準備ができていません');
 for(let i=0;i<24;i++){
  if(token!==revision)throw Error('視点切り替えを中断しました');
  let elevation=null;
  try{elevation=map.queryTerrainElevation([ll.lng,ll.lat]);}catch{}
  if(Number.isFinite(elevation))return elevation;
  await new Promise(resolve=>setTimeout(resolve,350));
 }
 throw Error('標高が取得できません。インターネット接続を確認してください');
}
async function applyView(resample=false){
 if(!point||!isVisible())return;
 const token=++revision,map=terrainMap;
 message('選択地点の標高と周辺地形を読み込んでいます…');
 try{
  let ground=parseFloat($('observer-ground').dataset.elevation);
  if(resample||!Number.isFinite(ground))ground=await sampleHeight(map,point,token);
  if(token!==revision)return;
  $('observer-ground').dataset.elevation=String(ground);
  $('observer-ground').textContent='地表標高: 約'+Math.round(ground)+'m';
  const cameraHeight=ground+height();
  // MapLibre GL JS v5 uses camera calculators, not Mapbox free-camera methods.
  if(typeof map.calculateCameraOptionsFromCameraLngLatAltRotation!=='function')
   throw Error('このMapLibre版は地点指定カメラに対応していません');
  if(typeof map.setCenterClampedToGround==='function')map.setCenterClampedToGround(false);
  const options=map.calculateCameraOptionsFromCameraLngLatAltRotation(
   [point.lng,point.lat],cameraHeight,heading(),pitch(),0);
  map.jumpTo(options);
  observer=true;
  if(terrainMap.dragPan)terrainMap.dragPan.disable();
  if(terrainMap.dragRotate)terrainMap.dragRotate.disable();
  document.body.classList.add('observer-active');
  $('observer-panel').hidden=false;
  $('observer-exit').disabled=false;
  message('方角と見下ろす角度を変更できます。地形のみの表示です。');
 }catch(error){
  if(token!==revision)return;
  observer=false;
  document.body.classList.remove('observer-active');
  restoreMapLabels(terrainMap);
  message('地上視点を表示できません: '+(error?.message||String(error)));
  console.error('[Shinshu Atlas viewpoint]',error);
 }
}
async function startView(){
 if(!point){selectMode(true);return;}
 $('observer-start').disabled=true;
 const mapToggle=$('terrain-toggle');
 try{
  if(!window.shinshuTerrain?.isActive?.()){
   if(!mapToggle)throw Error('3D地図のボタンが見つかりません');
   const wait=new Promise((resolve,reject)=>{
    let done=false;
    const handler=()=>{if(done)return;done=true;clearTimeout(timeout);resolve();};
    const timeout=setTimeout(()=>{if(done)return;done=true;document.removeEventListener('shinshu-terrain-activated',handler);reject(Error('3D地図が起動しませんでした'));},15000);
    document.addEventListener('shinshu-terrain-activated',handler,{once:true});
   });
   mapToggle.click();await wait;
  }
  terrainMap=window.shinshuTerrain?.getMap?.();
  if(terrainMap&&!terrainMap.__atlasStreetControls){bindStreetControls(terrainMap);terrainMap.__atlasStreetControls=true;}
  if(!terrainMap)throw Error('3D地図を取得できません');
  hideMapLabels(terrainMap);
  $('observer-panel').hidden=false;
  $('observer-direction').value=String(heading());
  showHeading();
  if(previousExaggeration===null)previousExaggeration=$('terrain-exaggeration')?.value||'1';
  // Terrain heights and camera altitude should use a 1:1 terrain scale.
  const factor=$('terrain-exaggeration');
  if(factor&&factor.value!=='1'){
   factor.value='1';factor.dispatchEvent(new Event('input',{bubbles:true}));
  }
  $('observer-ground').dataset.elevation='';
  await applyView(true);
 }catch(error){message('開始できません: '+(error?.message||String(error)));}
 finally{$('observer-start').disabled=false;}
}
function endView(){
 ++revision;
 observer=false;
 dragging=false;
 if(terrainMap?.dragPan)terrainMap.dragPan.enable();
 if(terrainMap?.dragRotate)terrainMap.dragRotate.enable();
 document.body.classList.remove('observer-active');
 restoreMapLabels(terrainMap);
 $('observer-panel').hidden=true;
 $('observer-ground').dataset.elevation='';
 if(terrainMap&&point&&window.shinshuTerrain?.isActive?.()){
  if(typeof terrainMap.setCenterClampedToGround==='function')terrainMap.setCenterClampedToGround(true);
  terrainMap.jumpTo({center:[point.lng,point.lat],zoom:13,pitch:62,bearing:heading()});
 }
 if(previousExaggeration!==null){
  const factor=$('terrain-exaggeration');
  if(factor){factor.value=previousExaggeration;factor.dispatchEvent(new Event('input',{bubbles:true}));}
  previousExaggeration=null;
 }
 message('俯瞰表示に戻りました。');
}
function setup(){
 if(typeof store==='undefined'||!store.map)return;
 $('observer-pick')?.addEventListener('click',()=>{
  if(window.shinshuTerrain?.isActive?.()){$('terrain-toggle')?.click();}
  selectMode(!selecting);
 });
 $('observer-start')?.addEventListener('click',startView);
 $('observer-exit')?.addEventListener('click',endView);
 $('observer-direction')?.addEventListener('input',()=>{
  showHeading();if(observer)applyView(false);
 });
 $('observer-height')?.addEventListener('change',()=>{if(observer)applyView(false);});
 $('observer-pitch')?.addEventListener('input',()=>{showPitch();if(observer)applyView(false);});
 $('observer-north')?.addEventListener('click',()=>{setHeading(0);if(observer)applyView(false);});
 document.querySelectorAll('[data-observer-move]').forEach(btn=>btn.addEventListener('click',()=>{const d=btn.dataset.observerMove;moveObserver(d==='forward'?1:d==='back'?-1:0,d==='right'?1:d==='left'?-1:0);}));
 store.map.on('click',e=>pick(e.latlng));
 document.addEventListener('shinshu-terrain-deactivated',()=>{if(observer)endView();terrainMap=null;});
 document.addEventListener('keydown',e=>{
  if(!observer||!isVisible()||e.altKey||e.ctrlKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||''))return;
  const key=e.key.toLowerCase();
  if(key==='arrowleft'||key==='arrowright'){
   e.preventDefault();setHeading(heading()+(key==='arrowright'?15:-15));applyView(false);
  }else if(key==='arrowup'||key==='arrowdown'){
   e.preventDefault();setPitch(pitch()+(key==='arrowup'?3:-3));applyView(false);
  }else if(['w','a','s','d'].includes(key)){
   e.preventDefault();
   moveObserver(key==='w'?1:key==='s'?-1:0,key==='d'?1:key==='a'?-1:0);
  }
 });
 showHeading();showPitch();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
