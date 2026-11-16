/* Shinshu Atlas historical municipal boundaries (Nagano, 1947+).
 * Source: 地図地理Sandbox / はにしな, https://hanishina.net/maps/historydata.html
 * Historic geometries are approximate and can contain errors.
 */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const PMTILES='https://hanishina.net/maps/tiles/';
let m=null,initialized=false,checkTimer=null;
let previousMap=null;
function report(s){const el=$('old-municipality-status');if(el)el.textContent=s;}
function currentDate(){return $('old-municipality-date')?.value||'2000-10-01';}
function enabled(){return !!$('old-municipality-enabled')?.checked;}
function filter(type,date){
 const conditions=['all',['<=','START',date],['>','END',date]];
 if(type==='polygon')conditions.push(['==','KEN','長野県'],['!=','TYPE','湖']);
 if(type==='line')conditions.push(['any',['==','KEN','20'],['==','KEN','20-20']]);
 return conditions;
}
function initProtocol(){
 if(initialized)return true;
 if(typeof pmtiles==='undefined'||typeof maplibregl==='undefined'||typeof maplibregl.addProtocol!=='function'){
  report('旧市町村用ライブラリを読み込めませんでした');return false;
 }
 const proto=new pmtiles.Protocol();
 maplibregl.addProtocol('pmtiles',proto.tile);
 initialized=true;return true;
}
function install(map){
 if(!map||!map.isStyleLoaded()||!initProtocol())return;
 m=map;
 if(checkTimer){clearInterval(checkTimer);checkTimer=null;}
 try{
  if(!m.getSource('old-municipal-polygons'))m.addSource('old-municipal-polygons',{type:'vector',url:'pmtiles://'+PMTILES+'polygon.pmtiles',attribution:'旧市町村境界: <a href="https://hanishina.net/maps/historydata.html" target="_blank">地図地理Sandbox</a>'});
  if(!m.getSource('old-municipal-lines'))m.addSource('old-municipal-lines',{type:'vector',url:'pmtiles://'+PMTILES+'line.pmtiles'});
  if(!m.getLayer('old-municipal-fill'))m.addLayer({id:'old-municipal-fill',type:'fill',source:'old-municipal-polygons','source-layer':'polygon',paint:{'fill-color':'#ebae52','fill-opacity':0.075}});
  if(!m.getLayer('old-municipal-lines'))m.addLayer({id:'old-municipal-lines',type:'line',source:'old-municipal-lines','source-layer':'line',paint:{'line-color':'#9c5424','line-width':['interpolate',['linear'],['zoom'],6,1.1,11,2.1,15,3],'line-dasharray':[3,2],'line-opacity':0.85}});
  if(!m.getLayer('old-municipal-labels'))m.addLayer({id:'old-municipal-labels',type:'symbol',source:'old-municipal-polygons','source-layer':'polygon',minzoom:8,layout:{'text-field':['get','NAME'],'text-size':['interpolate',['linear'],['zoom'],8,11,12,14],'text-allow-overlap':false,'text-padding':12,'text-max-width':10},paint:{'text-color':'#763909','text-halo-color':'#fff9ef','text-halo-width':2.6}});
  if(!m.__atlasHistoricalBound){m.__atlasHistoricalBound=true;m.on('click','old-municipal-fill',e=>{
   if(!enabled())return;
   const p=e.features?.[0]?.properties;
   if(!p||p.KEN!=='長野県'||p.TYPE==='湖')return;
   const root=document.createElement('div'),name=document.createElement('strong'),details=document.createElement('div');
   name.textContent=p.NAME||'名称なし';details.textContent='基準日: '+currentDate()+' / '+(p.GUN||'')+' / '+(p.TYPE||'');
   root.append(name,details);
   new maplibregl.Popup().setLngLat(e.lngLat).setDOMContent(root).addTo(m);
  });}
  apply();report('旧市町村境界を読み込み中。表示されない場合はF12のConsoleを確認してください。');
 }catch(e){console.error('[historical municipalities]',e);report('旧市町村境界の読込に失敗: '+(e.message||e));}
}
function apply(){
 if(!m)return;
 const date=currentDate(),show=enabled();
 for(const [layer,kind] of [['old-municipal-fill','polygon'],['old-municipal-labels','polygon'],['old-municipal-lines','line']]){
  if(!m.getLayer(layer))continue;
  m.setFilter(layer,filter(kind,date));
  m.setLayoutProperty(layer,'visibility',show?'visible':'none');
 }
}
function setup(){
 $('old-municipality-enabled')?.addEventListener('change',apply);
 $('old-municipality-date')?.addEventListener('change',()=>{
  apply();report('表示基準日：'+currentDate()+'。当日の行政区域を表示します。');
 });
 document.addEventListener('shinshu-terrain-ready',e=>{
  const map=e.detail?.map;
  if(map)install(map);
 });
 // Handle initialization that completes before this extension receives its event.
 const sync=()=>{
   const map=window.shinshuTerrain?.getMap?.();
   if(map&&map.isStyleLoaded()&&(!map.getLayer('old-municipal-fill'))){install(map);}
 };
 document.addEventListener('shinshu-terrain-activated',sync);
 checkTimer=setInterval(sync,1200);
 sync();
 // The original 2D Leaflet view does not use PMTiles; the historic overlay is 3D-only.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();
