/* Shinshu Atlas 3D terrain extension. 2D Leaflet is preserved. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
let map3d=null, active=false, ready=false, initPromise=null, markersReady=false;
const terrainUrl='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const backgrounds={
  gsi:{url:'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',maxzoom:18,credit:'国土地理院'},
  pale:{url:'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',maxzoom:18,credit:'国土地理院'},
  photo:{url:'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',maxzoom:18,credit:'国土地理院'},
  osm:{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',maxzoom:19,credit:'© OpenStreetMap contributors'}
};
function status(message){const x=$('terrain-status');if(x)x.textContent=message;}
function backgroundName(){return $('terrain-background')?.value||'gsi';}
function makeStyle(){
 const b=backgrounds[backgroundName()];
 return {version:8,sources:{
  basemap:{type:'raster',tiles:[b.url],tileSize:256,maxzoom:b.maxzoom,attribution:b.credit},
  elevation:{type:'raster-dem',tiles:[terrainUrl],encoding:'terrarium',tileSize:256,maxzoom:15,attribution:'Terrain: AWS Open Data / Mapzen (source-specific credits apply)'}
 },layers:[{id:'basemap',type:'raster',source:'basemap'}]};
}
function sync2Dto3D(){
 if(!map3d||!store?.map)return;
 const c=store.map.getCenter();
 map3d.jumpTo({center:[c.lng,c.lat],zoom:Math.max(5,store.map.getZoom()-0.2),pitch:62,bearing:0});
}
function sync3Dto2D(){
 if(!map3d||!store?.map)return;
 const c=map3d.getCenter();
 store.map.setView([c.lat,c.lng],Math.max(4,Math.min(19,map3d.getZoom())),{animate:false});
}
function poisGeoJSON(){
 if(typeof store==='undefined')return {type:'FeatureCollection',features:[]};
 const features=[];
 for(const p of store.points.values()){
  if(features.length>=18000)break;
  if(!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||!p.categoryIds?.some(k=>store.selected.has(k)))continue;
  features.push({type:'Feature',properties:{name:p.tags?.['name:ja']||p.tags?.name||'名称未登録',type:p.categoryIds[0]||''},geometry:{type:'Point',coordinates:[p.lng,p.lat]}});
 }
 return {type:'FeatureCollection',features};
}
function refreshPOIs(){
 if(!map3d||!ready)return;
 const src=map3d.getSource('atlas-pois');if(src)src.setData(poisGeoJSON());
}
function addLayers(){
 if(!map3d.getSource('atlas-pois'))map3d.addSource('atlas-pois',{type:'geojson',data:poisGeoJSON()});
 if(!map3d.getLayer('atlas-poi-points'))map3d.addLayer({id:'atlas-poi-points',type:'circle',source:'atlas-pois',minzoom:9,paint:{'circle-radius':['interpolate',['linear'],['zoom'],9,2.5,14,5.5],'circle-color':'#187b69','circle-stroke-color':'#fff','circle-stroke-width':1.2}});
 if(!map3d.getLayer('atlas-poi-labels'))map3d.addLayer({id:'atlas-poi-labels',type:'symbol',source:'atlas-pois',minzoom:12,layout:{'text-field':['get','name'],'text-size':11,'text-offset':[0,1.2],'text-anchor':'top','text-optional':true},paint:{'text-color':'#173b39','text-halo-color':'#fff','text-halo-width':1.6}});
}
function configureTerrain(){
 if(!map3d.getSource('elevation'))return;
 const exaggeration=Number($('terrain-exaggeration').value);
 map3d.setTerrain({source:'elevation',exaggeration});
 const v=$('terrain-exaggeration-value');if(v)v.textContent=exaggeration.toFixed(1)+'×';
}
function onStyleReady(){
 ready=true;
 configureTerrain();
 addLayers();
 status('標高タイルを読み込み中。ドラッグで回転・傾斜できます。');
}
function bindPopup(){
 map3d.on('click','atlas-poi-points',e=>{
  const f=e.features?.[0];if(!f)return;
  const node=document.createElement('div');
  node.style.cssText='font:13px sans-serif;max-width:230px';
  const title=document.createElement('strong');title.textContent=f.properties.name||'施設';node.append(title);
  const coords=document.createElement('div');coords.textContent=e.lngLat.lat.toFixed(5)+', '+e.lngLat.lng.toFixed(5);node.append(coords);
  new maplibregl.Popup({closeButton:true}).setLngLat(f.geometry.coordinates).setDOMContent(node).addTo(map3d);
 });
 map3d.on('mouseenter','atlas-poi-points',()=>map3d.getCanvas().style.cursor='pointer');
 map3d.on('mouseleave','atlas-poi-points',()=>map3d.getCanvas().style.cursor='');
}
function initialize(){
 if(initPromise)return initPromise;
 initPromise=new Promise((resolve,reject)=>{
  if(typeof maplibregl==='undefined'){reject(new Error('3D地図ライブラリの読み込みに失敗しました'));return;}
  if(!maplibregl.supported()){reject(new Error('ブラウザでWebGLが利用できません。ハードウェアアクセラレーションを確認してください'));return;}
  const c=store.map.getCenter();
  try{
   map3d=new maplibregl.Map({container:'terrain-map',style:makeStyle(),center:[c.lng,c.lat],zoom:Math.max(5,store.map.getZoom()-0.2),pitch:62,bearing:0,maxPitch:85,antialias:true,attributionControl:true});
   map3d.addControl(new maplibregl.NavigationControl({visualizePitch:true}),'bottom-left');
   map3d.on('load',()=>{onStyleReady();bindPopup();resolve();});
   map3d.on('error',e=>{console.warn('[3D terrain]',e.error||e);if(!ready)status('一部の地形タイルが取得できません。通信環境を確認してください。');});
  }catch(error){reject(error);}
 });
 return initPromise;
}
async function activate(){
 if(active)return;
 active=true;
 document.body.classList.add('terrain-active');
 $('terrain-toggle').textContent='2D地図に戻る';
 $('terrain-toggle').setAttribute('aria-pressed','true');
 $('terrain-controls').hidden=false;
 status('3D地形を初期化しています…');
 try{
  await initialize();
  map3d.resize();sync2Dto3D();refreshPOIs();
  status('3D地形を表示中。地形は実測標高由来、建物の3Dモデルは含みません。');
 }catch(e){
  console.error('[信州アトラス3D]',e);
  status('3Dを表示できません: '+(e.message||String(e)));
  deactivate();
  if(typeof notify==='function')notify('3D地形を表示できません: '+(e.message||String(e)),8000);
  initPromise=null;
 }
}
function deactivate(){
 if(!active)return;
 if(map3d&&ready)sync3Dto2D();
 active=false;document.body.classList.remove('terrain-active');
 $('terrain-toggle').textContent='3D地形を表示';
 $('terrain-toggle').setAttribute('aria-pressed','false');
 $('terrain-controls').hidden=true;
 setTimeout(()=>store.map?.invalidateSize(),0);
}
function fitNagano(){
 if(!map3d)return;
 map3d.fitBounds([[137.24,35.15],[138.94,37.07]],{padding:65,pitch:58,bearing:0,duration:850});
}
function setup(){
 $('terrain-toggle')?.addEventListener('click',()=>active?deactivate():activate());
 $('terrain-exaggeration')?.addEventListener('input',()=>{if(ready)configureTerrain();});
 $('terrain-background')?.addEventListener('change',()=>{
  if(!map3d||!ready)return;
  ready=false;status('背景地図を切り替えています…');
  map3d.once('style.load',onStyleReady);
  map3d.setStyle(makeStyle());
 });
 $('terrain-reset')?.addEventListener('click',fitNagano);
 $('fit-nagano')?.addEventListener('click',()=>{if(active)fitNagano();});
 // 2D controls can still modify downloaded data in the sidebar.
 $('category-groups')?.addEventListener('change',()=>setTimeout(refreshPOIs,100));
 window.addEventListener('resize',()=>{if(active&&map3d)map3d.resize();});
 window.shinshuTerrain={isActive:()=>active,refresh:refreshPOIs};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
