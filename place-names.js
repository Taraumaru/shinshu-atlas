/* Shinshu Atlas detailed place labels from OSM Overpass.
 * OpenStreetMap place nodes and named historic tags only; incomplete coverage.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const DBKEY='shinshu-place-labels-v1';
const endpoints=['https://overpass.kumi.systems/api/interpreter','https://overpass-api.de/api/interpreter','https://overpass.nchc.org.tw/api/interpreter'];
const points=new Map(),loaded=new Set();
let layer2d=null,map3d=null,fetching=false,pending=false,timer=null,enabled=true;
const names={town:'市街地',village:'集落',suburb:'地域',quarter:'大字・地区',neighbourhood:'町・字',hamlet:'集落',locality:'小地名',isolated_dwelling:'小地名'};
const minZoom={town:8,village:9,suburb:10,quarter:11,neighbourhood:12,hamlet:11,locality:13,isolated_dwelling:13};
function save(){
 try{let a=Array.from(points.values());if(a.length>25000)a=a.slice(-25000);localStorage.setItem(DBKEY,JSON.stringify(a));}catch{}
}
function restore(){
 try{for(const p of JSON.parse(localStorage.getItem(DBKEY)||'[]'))if(Number.isFinite(p.lat)&&Number.isFinite(p.lng)&&p.name)points.set(p.key,p);}catch{}
}
function escapeHTML(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function bounds(){
 const m=window.shinshuTerrain?.isActive()&&map3d?map3d:store?.map;
 if(!m)return null;
 const b=m.getBounds();return {s:Math.max(35.15,b.getSouth()),n:Math.min(37.07,b.getNorth()),w:Math.max(137.24,b.getWest()),e:Math.min(138.94,b.getEast()),zoom:m.getZoom()};
}
function queryBounds(b){
 const area=(b.n-b.s)*(b.e-b.w);
 if(b.s>=b.n||b.w>=b.e||b.zoom<9||area>0.5)return null;
 const f=v=>Number(v).toFixed(4);
 const bb=[f(b.s),f(b.w),f(b.n),f(b.e)].join(',');
 return {key:[Math.floor(b.s*10),Math.floor(b.w*10),Math.ceil(b.n*10),Math.ceil(b.e*10)].join('/'),bbox:bb};
}
async function request(ql){
 let err;
 for(const endpoint of endpoints){
  try{
   const ctrl=new AbortController();const t=setTimeout(()=>ctrl.abort(),18000);
   try{
    const res=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:ql}),signal:ctrl.signal});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const json=await res.json();return json.elements||[];
   }finally{clearTimeout(t);}
  }catch(e){err=e;}
 }
 throw err;
}
function schedule(){
 if(!enabled)return;
 clearTimeout(timer);timer=setTimeout(load,900);
}
async function load(){
 if(!enabled)return;
 if(fetching){pending=true;return;}
 const b=bounds(),q=b&&queryBounds(b);
 if(!q||loaded.has(q.key))return;
 fetching=true;
 const notice=$('place-status');if(notice)notice.textContent='地名データを取得中…';
 try{
  const place='town|village|suburb|quarter|neighbourhood|hamlet|locality|isolated_dwelling';
  const data=await request('[out:json][timeout:22];(node["place"~"^('+place+')$"]["name"]('+q.bbox+');node["old_name"]["name"]('+q.bbox+'););out body 9000;');
  let count=0;
  for(const e of data){
   if(e.type!=='node'||!Number.isFinite(e.lat)||!Number.isFinite(e.lon))continue;
   const t=e.tags||{},name=t['name:ja']||t.name;
   if(!name)continue;
   const place=names[t.place]?t.place:'locality';
   const p={key:e.type+'/'+e.id,lat:e.lat,lng:e.lon,name,place,oldName:t.old_name||'',isOld:false};
   // An old_name tag is an earlier designation, not proof of a former municipality.
   points.set(p.key,p);count++;
  }
  loaded.add(q.key);
  save();render();
  if(notice)notice.textContent=count+'件取得（OSM登録地名。旧市町村の網羅データではありません）';
 }catch(e){
  if(notice)notice.textContent='地名の取得に失敗しました。移動後に再試行できます。';
  console.warn('[place labels]',e);
 }finally{fetching=false;if(pending){pending=false;schedule();}}
}
function shouldShow(p,z){
 if(!enabled)return false;
 const old=$('place-old')?.checked;
 const detailed=$('place-detail')?.checked;
 if(old===false&&detailed===false)return false;
 return detailed&&z>=minZoom[p.place];
}
function render2D(){
 if(!layer2d||!store?.map)return;
 layer2d.clearLayers();
 if(window.shinshuTerrain?.isActive())return;
 const z=store.map.getZoom(),b=store.map.getBounds();
 const list=[...points.values()].filter(p=>shouldShow(p,z)&&b.contains([p.lat,p.lng]));
 list.sort((a,b)=>minZoom[a.place]-minZoom[b.place]);
 const cap=z<11?160:z<13?320:500;
 for(const p of list.slice(0,cap)){
  const high=['town','village','suburb'].includes(p.place);
  const label=escapeHTML(p.name);
  const content='<span class="place-label '+(high?'place-large':'')+'">'+label+'</span>';
  L.marker([p.lat,p.lng],{interactive:true,icon:L.divIcon({className:'place-marker',html:content,iconSize:[0,0],iconAnchor:[0,0]})})
   .bindPopup('<b>'+label+'</b><br>'+escapeHTML(names[p.place])+(p.oldName?'<br>旧称：'+escapeHTML(p.oldName):''))
   .addTo(layer2d);
 }
}
function geojson(){
 const z=map3d?.getZoom()||10;
 const b=map3d?.getBounds();
 const features=[];
 for(const p of points.values()){
  if(features.length>5000)break;
  if(!shouldShow(p,z)||!b?.contains([p.lng,p.lat]))continue;
  features.push({type:'Feature',properties:{name:p.name,level:minZoom[p.place],kind:p.place},geometry:{type:'Point',coordinates:[p.lng,p.lat]}});
 }
 return {type:'FeatureCollection',features};
}
function setup3D(map){
 map3d=map;
 if(!map3d.getSource('atlas-places'))map3d.addSource('atlas-places',{type:'geojson',data:geojson()});
 if(!map3d.getLayer('atlas-place-labels'))map3d.addLayer({
  id:'atlas-place-labels',type:'symbol',source:'atlas-places',
  layout:{'text-field':['get','name'],'text-font':['Noto Sans CJK JP Regular'],'text-size':['interpolate',['linear'],['zoom'],9,11,14,14],'text-allow-overlap':false,'text-padding':8,'text-anchor':'center','text-optional':true},
  paint:{'text-color':'#153a42','text-halo-color':'#fff','text-halo-width':2.3}
 });
 update3D();
}
function update3D(){const s=map3d?.getSource('atlas-places');if(s)s.setData(geojson());}
function render(){render2D();update3D();}
function setup(){
 restore();
 if(typeof store==='undefined'||!store.map)return;
 layer2d=L.layerGroup().addTo(store.map);
 store.map.on('moveend',()=>{render2D();schedule();});
 store.map.on('zoomend',()=>render2D());
 $('place-detail')?.addEventListener('change',()=>{render();schedule();});
 $('place-old')?.addEventListener('change',render);
 document.addEventListener('shinshu-terrain-ready',e=>{
  if(!e.detail?.map)return;
  const m=e.detail.map;
  if(map3d!==m){
   map3d=m;
   map3d.on('moveend',()=>{update3D();schedule();});
   map3d.on('zoomend',update3D);
  }
  setup3D(m);schedule();
 });
 document.addEventListener('shinshu-terrain-activated',()=>{render();schedule();});
 document.addEventListener('shinshu-terrain-deactivated',()=>{render();schedule();});
 schedule();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
