/* Historical municipalities overlay for existing Leaflet 2D map.
 * Keeps Leaflet POIs and controls intact; MapLibre is a noninteractive, transparent overlay.
 * Data: 地図地理Sandbox https://hanishina.net/maps/historydata.html
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const BASE='https://hanishina.net/maps/tiles/';
let overlay=null,installed=false,raf=0,labelTimer=0,lastKey='',protocolReady=false;
function isOn(){return !!$('historical-2d-enabled')?.checked;}
function date(){return $('historical-2d-date')?.value||'2000-10-01';}
function state(s){if($('historical-2d-status'))$('historical-2d-status').textContent=s;}
function empty(){return {type:'FeatureCollection',features:[]};}
function historicalFilter(kind){
 const f=['all',['<=','START',date()],['>','END',date()]];
 if(kind==='polygon')f.push(['==','KEN','長野県'],['!=','TYPE','湖']);
 else f.push(['any',['==','KEN','20'],['==','KEN','20-20']]);
 return f;
}
function ensureProtocol(){
 if(protocolReady)return;
 if(!window.pmtiles||!window.maplibregl)throw Error('PMTilesまたはMapLibreが読み込めませんでした');
 const protocol=new pmtiles.Protocol();
 maplibregl.addProtocol('pmtiles',protocol.tile);
 protocolReady=true;
}
function style(){
 return {version:8,glyphs:'https://glyphs.geolonia.com/{fontstack}/{range}.pbf',
 sources:{
  polygons:{type:'vector',url:'pmtiles://'+BASE+'polygon.pmtiles',attribution:'地図地理Sandbox'},
  lines:{type:'vector',url:'pmtiles://'+BASE+'line.pmtiles'},
  labels:{type:'geojson',data:empty()}
 },layers:[
  {id:'history-2d-area',type:'fill',source:'polygons','source-layer':'polygon',filter:historicalFilter('polygon'),paint:{'fill-opacity':0}},
  {id:'history-2d-boundaries',type:'line',source:'lines','source-layer':'line',filter:historicalFilter('line'),paint:{'line-color':'#a15c25','line-width':['interpolate',['linear'],['zoom'],6,1.2,12,2],'line-dasharray':[3,2],'line-opacity':0.85}},
  {id:'history-2d-labels',type:'symbol',source:'labels',minzoom:7,layout:{'text-field':['get','name'],'text-font':['Noto Sans CJK JP Bold'],'text-size':['interpolate',['linear'],['zoom'],7,11,11,14],'text-padding':8,'text-allow-overlap':false},paint:{'text-color':'#7c3f10','text-halo-color':'#fff','text-halo-width':2.7}}
 ]};
}
function ringCandidate(geom){
 const polygons=geom?.type==='Polygon'?[geom.coordinates]:geom?.type==='MultiPolygon'?geom.coordinates:[];
 let best=null;
 for(const poly of polygons){
  const r=poly?.[0];if(!r||r.length<3)continue;
  let twice=0,cx=0,cy=0;
  for(let i=0,j=r.length-1;i<r.length;j=i++){
   const a=r[j][0]*r[i][1]-r[i][0]*r[j][1];
   twice+=a;cx+=(r[j][0]+r[i][0])*a;cy+=(r[j][1]+r[i][1])*a;
  }
  const area=Math.abs(twice);
  if(area===0)continue;
  if(!best||area>best.area)best={area,coordinates:[cx/(3*twice),cy/(3*twice)]};
 }
 return best;
}
function refreshLabels(){
 if(!overlay||!overlay.isStyleLoaded()||!isOn())return;
 let features=[];
 try{features=overlay.querySourceFeatures('polygons',{sourceLayer:'polygon'});}catch{return;}
 const d=date(),names=new Map();
 for(const f of features){
  const p=f.properties||{};
  if(p.KEN!=='長野県'||p.TYPE==='湖'||!p.NAME||String(p.START)>d||String(p.END)<=d)continue;
  const candidate=ringCandidate(f.geometry);if(!candidate)continue;
  const key=[p.NAME,p.GUN||''].join('|');
  if(!names.has(key)||names.get(key).area<candidate.area)names.set(key,{...candidate,name:p.NAME});
 }
 const result=[...names.values()].map(p=>({type:'Feature',properties:{name:p.name},geometry:{type:'Point',coordinates:p.coordinates}}));
 const signature=JSON.stringify(result.map(f=>[f.properties.name,...f.geometry.coordinates.map(n=>Math.round(n*1e4))]));
 if(lastKey===signature)return;
 lastKey=signature;
 overlay.getSource('labels')?.setData({type:'FeatureCollection',features:result});
 state('旧市町村境界・名称を表示中（'+result.length+'名称）');
}
function scheduleLabels(){clearTimeout(labelTimer);labelTimer=setTimeout(refreshLabels,350);}
function sync(){
 if(!overlay||typeof store==='undefined'||!store.map)return;
 const c=store.map.getCenter();
 overlay.jumpTo({center:[c.lng,c.lat],zoom:store.map.getZoom()-1,bearing:0,pitch:0});
 overlay.resize();scheduleLabels();
}
function scheduleSync(){
 if(raf)cancelAnimationFrame(raf);
 raf=requestAnimationFrame(()=>{raf=0;sync();});
}
function update(){
 if(!overlay)return;
 const on=isOn();
 $('historical-2d-map').style.display=on?'block':'none';
 if(!on)return;
 if(overlay.getLayer('history-2d-boundaries'))overlay.setFilter('history-2d-boundaries',historicalFilter('line'));
 if(overlay.getLayer('history-2d-area'))overlay.setFilter('history-2d-area',historicalFilter('polygon'));
 lastKey='';overlay.getSource('labels')?.setData(empty());
 sync();scheduleLabels();
}
function init(){
 if(!window.maplibregl||!window.pmtiles||typeof store==='undefined'||!store.map){state('旧境界ライブラリを初期化できませんでした');return;}
 try{
  ensureProtocol();
  const c=store.map.getCenter();
  overlay=new maplibregl.Map({container:'historical-2d-map',style:style(),center:[c.lng,c.lat],zoom:store.map.getZoom()-1,interactive:false,attributionControl:false,renderWorldCopies:false,fadeDuration:0});
  overlay.on('load',()=>{installed=true;update();state('旧市町村境界・名称の読み込みを開始しました');});
  overlay.on('sourcedata',e=>{if(e.sourceId==='polygons'&&e.isSourceLoaded)scheduleLabels();});
  overlay.on('moveend',scheduleLabels);
  overlay.on('error',e=>console.warn('[historical 2D]',e.error||e));
  store.map.on('move',scheduleSync);
  store.map.on('zoom',scheduleSync);
  store.map.on('resize',scheduleSync);
  window.addEventListener('resize',scheduleSync);
  $('historical-2d-enabled')?.addEventListener('change',()=>{
   update();
   const other=$('old-municipality-enabled');if(other){other.checked=isOn();other.dispatchEvent(new Event('change'));}
  });
  $('historical-2d-date')?.addEventListener('change',()=>{
   update();
   const other=$('old-municipality-date');if(other){other.value=date();other.dispatchEvent(new Event('change'));}
  });
  $('old-municipality-enabled')?.addEventListener('change',()=>{
   const box=$('historical-2d-enabled');if(box){box.checked=$('old-municipality-enabled').checked;update();}
  });
  $('old-municipality-date')?.addEventListener('change',()=>{
   const s=$('historical-2d-date');if(s){s.value=$('old-municipality-date').value;update();}
  });
 }catch(e){console.error(e);state('旧市町村2Dの起動に失敗: '+(e.message||e));}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
