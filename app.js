/* 信州アトラス / SHINSHU ATLAS
 * Static frontend: © OpenStreetMap contributors (POIs), MLIT / Regional Transport Data Lab (polygons)
 * All network access is in the user's browser. No personal data is uploaded by this application.
 */
'use strict';

const NAGANO_BOUNDS = [[35.15,137.24],[37.07,138.94]];
const INITIAL = {lat:36.20,lng:138.02,zoom:9};
const MAX_RESULT_LIST = 75;
const CACHE_DB = 'shinshu-atlas-cache-v2';
const BASE_GEOJSON = 'https://cdn.jsdelivr.net/gh/kyodo-official/japan-choropleth@main/data/geojson/by-prefecture/20/';
const FALLBACK_GEOJSON = 'https://raw.githubusercontent.com/kyodo-official/japan-choropleth/main/data/geojson/by-prefecture/20/';
const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.nchc.org.tw/api/interpreter'
];

const CATEGORY_GROUPS = [
  {name:'生活・買い物',items:[
    {id:'convenience',name:'コンビニ',icon:'🏪',color:'#308e75',selectors:['["shop"="convenience"]']},
    {id:'fuel',name:'ガソリンスタンド',icon:'⛽',color:'#ba7a31',selectors:['["amenity"="fuel"]']},
    {id:'supermarket',name:'スーパー',icon:'🛒',color:'#31946f',selectors:['["shop"="supermarket"]']},
    {id:'drugstore',name:'ドラッグストア',icon:'💊',color:'#447da1',selectors:['["shop"="chemist"]','["amenity"="pharmacy"]']},
    {id:'restaurant',name:'飲食店',icon:'🍴',color:'#bc7955',selectors:['["amenity"~"^(restaurant|fast_food|cafe)$"]']},
    {id:'bank',name:'銀行・ATM',icon:'🏦',color:'#6876aa',selectors:['["amenity"~"^(bank|atm)$"]']},
    {id:'hotel',name:'宿泊施設',icon:'🛏',color:'#8c6bab',selectors:['["tourism"~"^(hotel|guest_house|hostel|motel|ryokan)$"]']}
  ]},
  {name:'教育・公共・医療',items:[
    {id:'school',name:'学校',icon:'🏫',color:'#507dac',selectors:['["amenity"~"^(school|college|university|kindergarten)$"]']},
    {id:'library',name:'図書館',icon:'📚',color:'#3f8c91',selectors:['["amenity"="library"]']},
    {id:'hospital',name:'病院・診療所',icon:'🏥',color:'#bf5d71',selectors:['["amenity"~"^(hospital|clinic|doctors)$"]']},
    {id:'government',name:'役場・行政',icon:'🏛',color:'#526ba4',selectors:['["office"="government"]','["amenity"="townhall"]']},
    {id:'police',name:'警察・消防',icon:'🚓',color:'#5577aa',selectors:['["amenity"~"^(police|fire_station)$"]']},
    {id:'postoffice',name:'郵便局',icon:'📮',color:'#be6c50',selectors:['["amenity"="post_office"]']}
  ]},
  {name:'交通・インフラ',items:[
    {id:'roadstation',name:'道の駅',icon:'🚩',color:'#b17a40',selectors:['["name"~"道の駅"]','["name:ja"~"道の駅"]']},
    {id:'railway',name:'鉄道駅',icon:'🚉',color:'#597baa',selectors:['["railway"~"^(station|halt)$"]']},
    {id:'bus',name:'バス停',icon:'🚌',color:'#639691',selectors:['["highway"="bus_stop"]']},
    {id:'parking',name:'駐車場',icon:'🅿',color:'#6488ad',selectors:['["amenity"="parking"]']},
    {id:'charging',name:'EV充電',icon:'⚡',color:'#638e4d',selectors:['["amenity"="charging_station"]']},
    {id:'dam',name:'ダム',icon:'🌊',color:'#3787aa',selectors:['["waterway"="dam"]']}
  ]},
  {name:'観光・自然',items:[
    {id:'peak',name:'山・山頂',icon:'⛰',color:'#4e967b',selectors:['["natural"="peak"]']},
    {id:'onsen',name:'温泉',icon:'♨',color:'#be8270',selectors:['["natural"="hot_spring"]','["amenity"="public_bath"]']},
    {id:'shrine',name:'神社・寺',icon:'⛩',color:'#ad6864',selectors:['["amenity"="place_of_worship"]']},
    {id:'park',name:'公園',icon:'🌳',color:'#3d956b',selectors:['["leisure"="park"]']},
    {id:'viewpoint',name:'展望台',icon:'🔭',color:'#8075a1',selectors:['["tourism"="viewpoint"]']},
    {id:'castle',name:'史跡・城',icon:'🏯',color:'#9e7a52',selectors:['["historic"~"^(castle|ruins|monument|archaeological_site)$"]']},
    {id:'waterfall',name:'滝',icon:'💧',color:'#3986a5',selectors:['["waterway"="waterfall"]']},
    {id:'museum',name:'博物館',icon:'🖼',color:'#8b6d95',selectors:['["tourism"="museum"]']}
  ]}
];
const CATEGORIES = CATEGORY_GROUPS.flatMap(g=>g.items);
const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c=>[c.id,c]));
const DEFAULT_IDS = ['convenience','fuel','school','roadstation','railway','peak'];

// Official 23 district groupings, based on current municipalities, with seat counts as of 2026.
const PREFECTURAL_DISTRICTS = [
  ['長野市・上水内郡',11,'長野市 信濃町 小川村 飯綱町'],
  ['松本市・東筑摩郡',7,'松本市 麻績村 生坂村 山形村 朝日村 筑北村'],
  ['上田市・小県郡',4,'上田市 青木村 長和町'],
  ['岡谷市・下諏訪町',2,'岡谷市 下諏訪町'],
  ['飯田市・下伊那郡',4,'飯田市 松川町 高森町 阿南町 阿智村 平谷村 根羽村 下條村 売木村 天龍村 泰阜村 喬木村 豊丘村 大鹿村'],
  ['諏訪市',1,'諏訪市'],
  ['須坂市・上高井郡',2,'須坂市 小布施町 高山村'],
  ['小諸市',1,'小諸市'],
  ['伊那市',2,'伊那市'],
  ['駒ヶ根市',1,'駒ヶ根市'],
  ['中野市・下高井郡',2,'中野市 山ノ内町 木島平村 野沢温泉村'],
  ['大町市',1,'大町市'],
  ['飯山市・下水内郡',1,'飯山市 栄村'],
  ['茅野市・富士見町・原村',2,'茅野市 富士見町 原村'],
  ['塩尻市',2,'塩尻市'],
  ['佐久市・北佐久郡',4,'佐久市 軽井沢町 御代田町 立科町'],
  ['千曲市・埴科郡',2,'千曲市 坂城町'],
  ['東御市',1,'東御市'],
  ['安曇野市',2,'安曇野市'],
  ['南佐久郡',1,'小海町 川上村 南牧村 南相木村 北相木村 佐久穂町'],
  ['上伊那郡',2,'辰野町 箕輪町 飯島町 南箕輪村 中川村 宮田村'],
  ['木曽郡',1,'上松町 南木曽町 木祖村 王滝村 大桑村 木曽町'],
  ['北安曇郡',1,'池田町 松川村 白馬村 小谷村']
].map(([name,seats,names],index)=>({name,seats,names:names.split(' '),index}));
const PREF_BY_MUNI = new Map();
for(const d of PREFECTURAL_DISTRICTS)for(const name of d.names)PREF_BY_MUNI.set(name,d);

const el = id => document.getElementById(id);
const safe = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const shortNum = n => Number(n).toLocaleString('ja-JP');
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
const store = {points:new Map(), queries:new Map(), db:null, loading:false, abort:null, boundaryMode:'municipality', municipalities:null, districts:null, layers:{}, markers:new Map(), selected:new Set(DEFAULT_IDS), search:'', map:null, cluster:null, base:null, activeBase:'osm', seenLocal:false};

function setStatus(message,state='normal'){
  el('global-status').textContent=message;
  el('status-dot').className='status-dot'+(state==='loading'?' loading':state==='error'?' error':'');
}
let alertTimer;
function notify(message,ms=6000){el('map-message-text').textContent=message;el('map-message').classList.add('show');clearTimeout(alertTimer);if(ms)alertTimer=setTimeout(()=>el('map-message').classList.remove('show'),ms)}
function categoriesFor(tags={}){
  const out=[];
  if(tags.shop==='convenience')out.push('convenience');
  if(tags.amenity==='fuel')out.push('fuel');
  if(tags.shop==='supermarket')out.push('supermarket');
  if(tags.shop==='chemist'||tags.amenity==='pharmacy')out.push('drugstore');
  if(['restaurant','fast_food','cafe'].includes(tags.amenity))out.push('restaurant');
  if(['bank','atm'].includes(tags.amenity))out.push('bank');
  if(['hotel','guest_house','hostel','motel','ryokan'].includes(tags.tourism))out.push('hotel');
  if(['school','college','university','kindergarten'].includes(tags.amenity))out.push('school');
  if(tags.amenity==='library')out.push('library');
  if(['hospital','clinic','doctors'].includes(tags.amenity))out.push('hospital');
  if(tags.office==='government'||tags.amenity==='townhall')out.push('government');
  if(['police','fire_station'].includes(tags.amenity))out.push('police');
  if(tags.amenity==='post_office')out.push('postoffice');
  if((String(tags.name||'').includes('道の駅')||String(tags['name:ja']||'').includes('道の駅')) && tags.highway!=='bus_stop' && tags.public_transport!=='platform')out.push('roadstation');
  if(['station','halt'].includes(tags.railway))out.push('railway');
  if(tags.highway==='bus_stop')out.push('bus');
  if(tags.amenity==='parking')out.push('parking');
  if(tags.amenity==='charging_station')out.push('charging');
  if(tags.waterway==='dam')out.push('dam');
  if(tags.natural==='peak')out.push('peak');
  if(tags.natural==='hot_spring'||tags.amenity==='public_bath')out.push('onsen');
  if(tags.amenity==='place_of_worship')out.push('shrine');
  if(tags.leisure==='park')out.push('park');
  if(tags.tourism==='viewpoint')out.push('viewpoint');
  if(['castle','ruins','monument','archaeological_site'].includes(tags.historic))out.push('castle');
  if(tags.waterway==='waterfall')out.push('waterfall');
  if(tags.tourism==='museum')out.push('museum');
  return out;
}
function classInfo(p){const id=(p.categoryIds||[]).find(x=>store.selected.has(x))||p.categoryIds?.[0];return CATEGORY_BY_ID[id]||{name:'その他',icon:'📍',color:'#267660'};}
function distanceKm(a,b){const r=Math.PI/180,dLat=(a.lat-b.lat)*r,dLon=(a.lng-b.lng)*r;const aa=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLon/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(aa)));}
function formatDistance(km){return km<1?`${Math.round(km*1000)} m`:`${km.toFixed(km<10?1:0)} km`;}
function pointInRing(p,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=ring[i][0],yi=ring[i][1],xj=ring[j][0],yj=ring[j][1];if((yi>p[1])!==(yj>p[1]) && p[0]<(xj-xi)*(p[1]-yi)/(yj-yi)+xi)inside=!inside;}return inside;}
function pointInFeature(lng,lat,feature){
  const geometry=feature?.geometry;if(!geometry)return false;
  if(feature.__bbox){const [x0,y0,x1,y1]=feature.__bbox;if(lng<x0||lng>x1||lat<y0||lat>y1)return false;}
  const polygons=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[];
  return polygons.some(poly=>pointInRing([lng,lat],poly[0])&&!poly.slice(1).some(r=>pointInRing([lng,lat],r)));
}
function decorateBounds(geo){
  for(const feature of geo.features){
    const g=feature.geometry;if(!g)continue;
    let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
    const rings=g.type==='Polygon'?g.coordinates:g.type==='MultiPolygon'?g.coordinates.flat():[];
    for(const ring of rings)for(const c of ring){if(c[0]<west)west=c[0];if(c[0]>east)east=c[0];if(c[1]<south)south=c[1];if(c[1]>north)north=c[1];}
    if(Number.isFinite(west))feature.__bbox=[west,south,east,north];
  }
  return geo;
}
function findMuni(lat,lng){return store.municipalities?.features.find(f=>pointInFeature(lng,lat,f))||null;}
function findNational(lat,lng){return store.districts?.features.find(f=>pointInFeature(lng,lat,f))||null;}
function areaInfo(lat,lng){const municipality=findMuni(lat,lng)?.properties?.displayName||null;const national=findNational(lat,lng)?.properties?.name||null;return {municipality,national,prefectural:municipality?PREF_BY_MUNI.get(municipality):null};}
function inNagano(lat,lng){return store.municipalities ? !!findMuni(lat,lng) : lat>=NAGANO_BOUNDS[0][0]&&lat<=NAGANO_BOUNDS[1][0]&&lng>=NAGANO_BOUNDS[0][1]&&lng<=NAGANO_BOUNDS[1][1];}
function areaHTML(lat,lng){const a=areaInfo(lat,lng);if(!a.municipality)return `<div class="area-popup">長野県の市町村境界外です。<br><span class="meta">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>`;return `<div class="area-popup"><strong>${safe(a.municipality)}</strong><br>衆議院：${safe(a.national||'不明')}<br>県議会：${safe(a.prefectural?.name||'不明')} ${a.prefectural?`（定数${a.prefectural.seats}）`:''}<br>参議院：長野県選挙区<br><span class="meta">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>`;}
function municipalityName(feature){return feature.properties?.displayName||feature.properties?.municipality||'名称不明';}

function configureMap(){
  const parsed=new URL(location.href).searchParams;
  const lat=Number(parsed.get('lat')),lng=Number(parsed.get('lng')),z=Number(parsed.get('z'));
  const valid=Number.isFinite(lat)&&Number.isFinite(lng)&&Number.isFinite(z)&&lat>34&&lat<38&&lng>136&&lng<140&&z>=5&&z<=19;
  store.map=L.map('map',{zoomControl:false,preferCanvas:true,zoomSnap:.5}).setView(valid?[lat,lng]:[INITIAL.lat,INITIAL.lng],valid?z:INITIAL.zoom);
  L.control.zoom({position:'bottomleft'}).addTo(store.map);
  store.cluster=typeof L.markerClusterGroup==='function'?L.markerClusterGroup({chunkedLoading:true,chunkInterval:80,maxClusterRadius:47,disableClusteringAtZoom:16,showCoverageOnHover:false,spiderfyOnMaxZoom:true}):L.featureGroup();
  if(!store.cluster.zoomToShowLayer)store.cluster.zoomToShowLayer=(marker,callback)=>{store.map.setView(marker.getLatLng(),16);callback();};
  store.map.addLayer(store.cluster);
  setBase('osm');
  store.map.on('moveend',()=>{updateMetrics();scheduleAutomaticLoad();});
  store.map.on('click',e=>L.popup({maxWidth:280}).setLatLng(e.latlng).setContent(areaHTML(e.latlng.lat,e.latlng.lng)).openOn(store.map));
  store.map.on('zoomend',()=>{el('map-hint-text').textContent=store.map.getZoom()<10?'この範囲の施設を取得できます。市町村まで拡大すると自動取得します':'地図を動かすと選択カテゴリの施設を自動取得します';});
}
function setBase(id){
  const layers={
    osm:{url:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',attr:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',max:19},
    gsi:{url:'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',attr:'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',max:18},
    pale:{url:'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',attr:'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>',max:18},
    photo:{url:'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',attr:'<a href="https://maps.gsi.go.jp/development/ichiran.html">地理院タイル</a>（写真）',max:18}
  };
  const def=layers[id]||layers.osm;
  if(store.base)store.map.removeLayer(store.base);
  store.base=L.tileLayer(def.url,{attribution:def.attr,maxZoom:def.max,updateWhenIdle:true}).addTo(store.map);
  store.base.bringToBack();
  store.activeBase=id;
}
function buildCategoryControls(){
  const root=el('category-groups');root.innerHTML='';
  for(const group of CATEGORY_GROUPS){
    const block=document.createElement('div');block.className='category-group';
    block.innerHTML=`<div class="category-title">${safe(group.name)}</div><div class="category-grid"></div>`;
    for(const cat of group.items){
      const label=document.createElement('label');label.className='category-item';label.dataset.id=cat.id;
      const input=document.createElement('input');input.type='checkbox';input.checked=store.selected.has(cat.id);input.value=cat.id;input.setAttribute('aria-label',cat.name);
      const ico=document.createElement('span');ico.className='cat-icon';ico.textContent=cat.icon;
      const span=document.createElement('span');span.textContent=cat.name;
      label.append(input,ico,span);
      label.classList.toggle('checked',input.checked);
      input.addEventListener('change',()=>{
        if(input.checked)store.selected.add(cat.id);else store.selected.delete(cat.id);
        label.classList.toggle('checked',input.checked);onCategoryChange();
      });
      block.querySelector('.category-grid').append(label);
    }
    root.append(block);
  }
  updateSelectedCount();
}
function updateSelectedCount(){el('selected-count').textContent=`${store.selected.size}カテゴリ`}
function setSelected(ids){store.selected=new Set(ids);document.querySelectorAll('.category-item').forEach(label=>{const checked=store.selected.has(label.dataset.id);label.querySelector('input').checked=checked;label.classList.toggle('checked',checked)});onCategoryChange();}
function onCategoryChange(){updateSelectedCount();renderPOIs();scheduleAutomaticLoad();}
function popupFor(p){
  const c=classInfo(p),t=p.tags||{},a=areaInfo(p.lat,p.lng);
  const title=t['name:ja']||t.name||'名称未登録';
  const addr=[t['addr:full'],[t['addr:city'],t['addr:street'],t['addr:housenumber']].filter(Boolean).join(' ')].find(Boolean);
  const website=[t.website,t['contact:website']].find(x=>/^https?:\/\//i.test(x||''));
  const url=`https://www.openstreetmap.org/${encodeURIComponent(p.osmType||'node')}/${encodeURIComponent(String(p.osmId||''))}`;
  return `<div class="poi-popup-title">${safe(title)}</div><div class="popup-type">${safe(c.name)}</div>`+
    (addr?`<div class="poi-popup-row">所在地：${safe(addr)}</div>`:'')+
    (t.brand?`<div class="poi-popup-row">ブランド：${safe(t.brand)}</div>`:'')+
    (t.operator?`<div class="poi-popup-row">運営：${safe(t.operator)}</div>`:'')+
    (t['opening_hours']?`<div class="poi-popup-row">営業時間：${safe(t.opening_hours)}</div>`:'')+
    (a.municipality?`<div class="poi-popup-row">自治体：${safe(a.municipality)}</div>`:'')+
    `<div class="poi-popup-row">緯度経度：${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</div>`+
    `<div class="poi-popup-links"><a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.lat+','+p.lng)}" target="_blank" rel="noopener">経路・周辺地図</a>`+
    (p.osmId?`<a href="${url}" target="_blank" rel="noopener">OSMで編集</a>`:'')+
    (website?`<a href="${safe(website)}" target="_blank" rel="noopener noreferrer">公式サイト</a>`:'')+'</div>';
}
let activeFiltered=[];
function renderPOIs(){
  store.cluster.clearLayers();store.markers.clear();
  activeFiltered=[...store.points.values()].filter(p=>p.categoryIds?.some(id=>store.selected.has(id)) && (!store.search || [p.tags?.name,p.tags?.['name:ja'],p.tags?.brand,p.tags?.operator].some(s=>String(s||'').toLowerCase().includes(store.search.toLowerCase()))));
  const markers=[];
  // Present all locally loaded POIs (up to a safe per-browser rendering cap). CSV/GeoJSON exports are not capped.
  for(const p of activeFiltered.slice(0,25000)){
    const c=classInfo(p);
    const div=L.divIcon({html:`<div class="poi-pin" style="background:${c.color}"><span>${c.icon}</span></div>`,iconSize:[30,34],iconAnchor:[12,31],popupAnchor:[3,-27],className:'',});
    const marker=L.marker([p.lat,p.lng],{icon:div,title:p.tags?.['name:ja']||p.tags?.name||c.name});
    marker.bindPopup(()=>popupFor(p),{maxWidth:300});
    store.markers.set(p.key,marker);markers.push(marker);
  }
  store.cluster.addLayers(markers);
  el('total-poi-count').textContent=shortNum(store.points.size);
  updateMetrics();
}
function updateMetrics(){
  if(!store.map)return;
  const b=store.map.getBounds();const center=store.map.getCenter();
  const visible=activeFiltered.filter(p=>b.contains([p.lat,p.lng]));
  visible.sort((a,b)=>distanceKm(a,center)-distanceKm(b,center));
  el('visible-poi-count').textContent=shortNum(visible.length);
  el('results-count').textContent=`${shortNum(visible.length)}件`;
  const list=el('results-list');list.textContent='';
  const fragment=document.createDocumentFragment();
  for(const p of visible.slice(0,MAX_RESULT_LIST)){
    const c=classInfo(p),row=document.createElement('button');row.className='result-row';row.type='button';
    const icon=document.createElement('span');icon.className='result-row-icon';icon.textContent=c.icon;
    const detail=document.createElement('span');detail.className='result-details';
    const n=document.createElement('span');n.className='result-name';n.textContent=p.tags?.['name:ja']||p.tags?.name||'名称未登録';
    const sub=document.createElement('span');sub.className='result-sub';sub.textContent=`${c.name}${p.tags?.brand?' · '+p.tags.brand:''}`;
    detail.append(n,sub);
    const distance=document.createElement('span');distance.className='result-distance';distance.textContent=formatDistance(distanceKm(p,center));
    row.append(icon,detail,distance);
    row.addEventListener('click',()=>{store.map.setView([p.lat,p.lng],Math.max(15,store.map.getZoom()));const marker=store.markers.get(p.key);if(marker)store.cluster.zoomToShowLayer(marker,()=>marker.openPopup());closeMobileSidebar();});
    fragment.append(row);
  }
  if(!visible.length){const p=document.createElement('div');p.className='empty-results';p.textContent=store.search?'一致する施設はありません。別のキーワードを試してください。':'この表示範囲に読み込み済みの施設はありません。地図右上の「施設を取得」を押してください。';fragment.append(p);}
  list.append(fragment);
  el('result-desc').textContent=visible.length>MAX_RESULT_LIST?`近い順に${MAX_RESULT_LIST}件を表示。CSV／GeoJSONには全件を出力します。`:`カテゴリで絞り込み、施設を選択すると詳細を表示できます。`;
  const params=new URLSearchParams(location.search);params.set('lat',center.lat.toFixed(5));params.set('lng',center.lng.toFixed(5));params.set('z',store.map.getZoom().toFixed(1));
  try{history.replaceState(null,'',location.pathname+'?'+params.toString()+location.hash)}catch{};
}
async function openDB(){
  if(!('indexedDB' in window))return null;
  return new Promise(resolve=>{
    try{
      const req=indexedDB.open(CACHE_DB,1);
      req.onupgradeneeded=()=>{const db=req.result;db.createObjectStore('pois',{keyPath:'key'});db.createObjectStore('queries',{keyPath:'key'})};
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>resolve(null);
      req.onblocked=()=>resolve(null);
    }catch{resolve(null)}
  });
}
function getAllDB(storeName){return new Promise(resolve=>{
  if(!store.db)return resolve([]);
  try{const req=store.db.transaction(storeName,'readonly').objectStore(storeName).getAll();req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>resolve([]);}catch{resolve([])}
});}
function putAllDB(storeName,data){return new Promise(resolve=>{
  if(!store.db||!data.length)return resolve();
  try{const tx=store.db.transaction(storeName,'readwrite');const s=tx.objectStore(storeName);for(const entry of data)s.put(entry);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve()}
});}
function clearDB(){return new Promise(resolve=>{
  if(!store.db)return resolve();
  try{const tx=store.db.transaction(['pois','queries'],'readwrite');tx.objectStore('pois').clear();tx.objectStore('queries').clear();tx.oncomplete=()=>resolve();tx.onerror=()=>resolve();}catch{resolve()}
});}
function objectFromOSM(e){
  const lat=Number(e.lat??e.center?.lat),lng=Number(e.lon??e.center?.lon),tags=e.tags||{};
  if(!Number.isFinite(lat)||!Number.isFinite(lng)||!inNagano(lat,lng))return null;
  const categoryIds=categoriesFor(tags);if(!categoryIds.length)return null;
  return {key:e.type+':'+e.id,osmType:e.type,osmId:e.id,lat,lng,tags,categoryIds,updatedAt:Date.now()};
}
function saveRecords(records){let added=0;for(const p of records){if(!store.points.has(p.key))added++;store.points.set(p.key,p);}return added}
function bboxParts(bounds){
  const south=Math.max(NAGANO_BOUNDS[0][0],bounds.getSouth()),north=Math.min(NAGANO_BOUNDS[1][0],bounds.getNorth());
  const west=Math.max(NAGANO_BOUNDS[0][1],bounds.getWest()),east=Math.min(NAGANO_BOUNDS[1][1],bounds.getEast());
  if(south>=north||west>=east)return [];
  // Split regional searches into manageable requests; this does not create an unbounded crawler.
  const span=(north-south)*(east-west),divide=span>1.5?3:span>.45?2:1;
  const chunks=[];
  for(let y=0;y<divide;y++)for(let x=0;x<divide;x++){
    const s=south+(north-south)*y/divide,n=south+(north-south)*(y+1)/divide;
    const w=west+(east-west)*x/divide,e=west+(east-west)*(x+1)/divide;
    chunks.push([s,w,n,e].map(v=>v.toFixed(5)).join(','));
  }
  return chunks;
}
function queryQL(bbox,selected){const patterns=[...new Set(selected.flatMap(id=>CATEGORY_BY_ID[id]?.selectors||[]))];const selectors=patterns.map(filter=>`nwr${filter}(${bbox});`).join('\n');return `[out:json][timeout:80];(${selectors});out center qt 25000;`;}
async function overpassRequest(ql,signal){
  let last;
  for(const endpoint of OVERPASS_ENDPOINTS){
    try{
      const result=await fetch(endpoint,{method:'POST',body:new URLSearchParams({data:ql}),signal});
      if(!result.ok)throw new Error(`HTTP ${result.status}`);
      const json=await result.json();if(!Array.isArray(json.elements))throw new Error('レスポンス形式が不正です');return json.elements;
    }catch(e){if(e.name==='AbortError')throw e;last=e;}
  }
  throw last||new Error('Overpass APIが応答しません');
}
let autoTimer;
function autoCoverageIsHigh(bounds,categoryIds){
  const [s,w,n,e]=bounds.split(',').map(Number);
  const area=(n-s)*(e-w);if(area<=0)return false;
  const prefix=categoryIds.join(',')+'|';
  for(const key of store.queries.keys()){
    if(!key.startsWith(prefix))continue;
    const [ss,ww,nn,ee]=key.slice(prefix.length).split(',').map(Number);
    const overlap=Math.max(0,Math.min(n,nn)-Math.max(s,ss))*Math.max(0,Math.min(e,ee)-Math.max(w,ww));
    if(overlap/area>.83)return true;
  }
  return false;
}
function scheduleAutomaticLoad(){clearTimeout(autoTimer);if(store.loading||store.selected.size===0)return;if(store.map?.getZoom()>=10){autoTimer=setTimeout(()=>loadPOIs(true),1300)}}
async function loadPOIs(automatic=false){
  if(store.loading){if(!automatic&&store.abort){store.abort.abort();setStatus('取得を中止しました');}return;}
  if(!store.selected.size){if(!automatic)notify('先に施設カテゴリを1つ以上選択してください。');return;}
  const b=store.map.getBounds(),parts=bboxParts(b);
  if(!parts.length){if(!automatic)notify('長野県内に地図を移動してください。');return;}
  if(automatic&&parts.length>1)return;
  const categoryIds=[...store.selected].sort();
  if(automatic&&autoCoverageIsHigh(parts[0],categoryIds))return;
  const todo=parts.filter(bbox=>{
    const key=categoryIds.join(',')+'|'+bbox;
    return !store.queries.has(key);
  });
  if(!todo.length){if(!automatic)notify('この範囲・カテゴリは読み込み済みです。',2500);return;}
  const controller=new AbortController();store.abort=controller;store.loading=true;
  el('load-pois').textContent='取得中…（押すと中止）';
  let completed=0,added=0,errors=[];
  try{
    for(const bbox of todo){
      if(controller.signal.aborted)break;
      setStatus(`施設を取得中 ${completed+1}/${todo.length}…`,'loading');
      const queryKey=categoryIds.join(',')+'|'+bbox;
      try{
        const elements=await overpassRequest(queryQL(bbox,categoryIds),controller.signal);
        const records=elements.map(objectFromOSM).filter(Boolean);
        added+=saveRecords(records);
        await putAllDB('pois',records);
        const seen={key:queryKey,time:Date.now(),count:records.length};store.queries.set(queryKey,seen);
        await putAllDB('queries',[seen]);
        if(elements.length>=25000)errors.push('一部のエリアで取得件数上限に達しました');
        renderPOIs();
      }catch(e){if(e.name==='AbortError')break;errors.push(e.message||'不明なエラー');}
      completed++;
      if(todo.length>1&&completed<todo.length)await wait(650);
    }
    if(controller.signal.aborted){setStatus(`取得中止：${shortNum(added)}件追加`);notify('取得を中止しました。取得済みの施設は保存されています。');}
    else if(errors.length){setStatus(`一部失敗：${shortNum(added)}件追加`,'error');notify(`取得 ${completed}/${todo.length}区画、追加${shortNum(added)}件。一部失敗：${errors[0]}`,9000);}
    else {setStatus(`取得完了：${shortNum(added)}件追加`);notify(`${shortNum(added)}件追加しました（${todo.length}区画）。取得結果はブラウザに保存されます。`,3500);}
  }finally{store.loading=false;store.abort=null;el('load-pois').disabled=false;el('load-pois').innerHTML='<span aria-hidden="true">↻</span> この範囲の施設を取得';}
}
async function loadGeoJSON(file){
  let failure=null;
  // Use bundled geometry if present, otherwise the original public distribution over HTTPS.
  for(const path of [`./data/${file}`,BASE_GEOJSON+file,FALLBACK_GEOJSON+file]){
    try{
      const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),13000);
      let response;
      try{response=await fetch(path,{signal:controller.signal,cache:'force-cache'})}finally{clearTimeout(timer)}
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const geo=await response.json();
      if(geo.type!=='FeatureCollection'||!Array.isArray(geo.features))throw new Error('GeoJSONの形式が不正です');
      return geo;
    }catch(e){failure=e;}
  }
  throw failure||new Error('境界データを取得できません');
}
function populateMunicipalitySelector(){
  const select=el('municipality-select');
  select.length=1;
  const items=store.municipalities?.features||[];
  for(const f of [...items].sort((a,b)=>municipalityName(a).localeCompare(municipalityName(b),'ja'))){
    const opt=document.createElement('option');opt.value=municipalityName(f);opt.textContent=municipalityName(f);select.append(opt);
  }
  el('municipality-count').innerHTML=`${shortNum(items.length)} <small>/ 77</small>`;
}
const DISTRICT_COLORS=['#d97c4e','#4f83c4','#7b68aa','#37a09c','#b9a242','#b76587','#79934f','#a17a4b'];
function styleMunicipality(){return {color:'#346d64',weight:1,opacity:.55,fillColor:'#2e9c83',fillOpacity:.035};}
function styleNational(f){return {color:DISTRICT_COLORS[(Number(f.properties?.districtNumber)||1)-1],weight:2.1,opacity:.92,fillColor:DISTRICT_COLORS[(Number(f.properties?.districtNumber)||1)-1],fillOpacity:.16};}
function stylePrefecture(f){const name=municipalityName(f),d=PREF_BY_MUNI.get(name),color=DISTRICT_COLORS[d?.index%8||0];return {color:color,weight:1.1,opacity:.65,fillColor:color,fillOpacity:.19};}
function buildBoundaryLayer(mode){
  const collection=mode==='national'?store.districts:store.municipalities;
  if(!collection)return null;
  const style=mode==='national'?styleNational:mode==='prefectural'?stylePrefecture:styleMunicipality;
  return L.geoJSON(collection,{style,onEachFeature:(f,layer)=>{
    const name=mode==='national'?f.properties?.name:municipalityName(f);
    layer.bindTooltip(safe(name||''),{sticky:true,opacity:.92});
    layer.on('click',e=>{
      L.DomEvent.stopPropagation(e);
      const {lat,lng}=e.latlng;
      L.popup({maxWidth:280}).setLatLng(e.latlng).setContent(areaHTML(lat,lng)).openOn(store.map);
    });
    layer.on('mouseover',()=>layer.setStyle({weight:mode==='national'?3.3:2.5,fillOpacity:mode==='municipality'?.12:.27}));
    layer.on('mouseout',()=>store.layers.active?.resetStyle(layer));
  }});
}
function updateBoundaries(){
  if(store.layers.active)store.map.removeLayer(store.layers.active);
  if(store.boundaryMode==='none'){store.layers.active=null;return;}
  store.layers.active=buildBoundaryLayer(store.boundaryMode);
  if(store.layers.active){store.layers.active.addTo(store.map);store.layers.active.bringToBack();if(store.base)store.base.bringToBack();}
  else notify('区域データをまだ取得できていません。インターネット接続を確認してください。');
}
async function fetchBoundaries(){
  try{
    store.municipalities=decorateBounds(await loadGeoJSON('municipalities.geojson'));
    const names=store.municipalities.features.map(municipalityName);
    if(names.length!==77)notify(`境界データは${names.length}市町村です。期待値77と異なります。`,10000);
    const unmapped=names.filter(x=>!PREF_BY_MUNI.has(x));
    if(unmapped.length)notify('県議会選挙区の未対応市町村：'+unmapped.join('、'),12000);
    populateMunicipalitySelector();
    updateBoundaries();
    setStatus(`${names.length}市町村の境界を取得しました`);
  }catch(e){setStatus('市町村境界の取得に失敗','error');notify('市町村境界を取得できません。ネット接続か配布サイトを確認してください。',9500)}
  try{
    store.districts=decorateBounds(await loadGeoJSON('electoral-districts.geojson'));
    if(store.districts.features.length!==5)notify('衆議院区割りの件数が5区と異なります。',7000);
    if(store.boundaryMode==='national')updateBoundaries();
  }catch(e){notify('衆議院選挙区の境界データを取得できませんでした。',8000)}
}
function decodeGeoJSON(file){return new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onload=()=>{try{resolve(JSON.parse(reader.result))}catch(e){reject(e)}};reader.onerror=()=>reject(reader.error);reader.readAsText(file);
});}
async function importGeoJSON(file){
  if(file.size>35_000_000){notify('35MBを超えるファイルは一度に取り込めません。');return;}
  try{
    const data=await decodeGeoJSON(file);
    if(data.type!=='FeatureCollection'||!Array.isArray(data.features))throw new Error('FeatureCollection形式のGeoJSONを指定してください');
    const records=[];
    for(let i=0;i<data.features.length;i++){
      const f=data.features[i],geo=f.geometry,props=f.properties||{};
      if(geo?.type!=='Point'||!Array.isArray(geo.coordinates))continue;
      const [lng,lat]=geo.coordinates;if(!Number.isFinite(lat)||!Number.isFinite(lng)||!inNagano(lat,lng))continue;
      const tags=props.tags&&typeof props.tags==='object'?props.tags:props;
      const categoryIds=categoriesFor(tags);
      if(!categoryIds.length && props.category && CATEGORY_BY_ID[props.category])categoryIds.push(props.category);
      if(!categoryIds.length)continue;
      const key=(props.key||'import:'+file.name+':'+i);
      records.push({key,osmType:props.osmType||'node',osmId:props.osmId||null,lat,lng,tags,categoryIds,updatedAt:Date.now()});
    }
    const added=saveRecords(records);await putAllDB('pois',records);renderPOIs();notify(`${shortNum(added)}件の新規施設を読み込みました。既存と重なるキーは更新しました。`);
  }catch(e){notify('インポート失敗：'+e.message,10000)}
}
function exportRows(){return activeFiltered.map(p=>({name:p.tags?.['name:ja']||p.tags?.name||'',categories:p.categoryIds.map(id=>CATEGORY_BY_ID[id]?.name||id).join(' / '),municipality:areaInfo(p.lat,p.lng).municipality||'',latitude:p.lat,longitude:p.lng,brand:p.tags?.brand||'',address:p.tags?.['addr:full']||'',website:p.tags?.website||'',osm_url:p.osmId?`https://www.openstreetmap.org/${p.osmType}/${p.osmId}`:''}));}
function preventFormula(s){const v=String(s??'');return /^[=+\-@\t\r]/.test(v)?"'"+v:v;}
function exportCSV(){const rows=exportRows(),keys=['name','categories','municipality','latitude','longitude','brand','address','website','osm_url'];const csv='\ufeff'+[keys.join(','),...rows.map(row=>keys.map(k=>'"'+preventFormula(row[k]).replace(/"/g,'""')+'"').join(','))].join('\r\n');downloadBlob(csv,'shinshu-atlas-landmarks.csv','text/csv;charset=utf-8');}
function exportGeoJSON(){const features=activeFiltered.map(p=>({type:'Feature',geometry:{type:'Point',coordinates:[p.lng,p.lat]},properties:{name:p.tags?.['name:ja']||p.tags?.name||'',category:p.categoryIds[0],categoryIds:p.categoryIds,key:p.key,osmType:p.osmType,osmId:p.osmId,tags:p.tags}}));const data={type:'FeatureCollection',features};downloadBlob(JSON.stringify(data),'shinshu-atlas-landmarks.geojson','application/geo+json;charset=utf-8');}
function downloadBlob(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
async function handleSearch(event){
  event.preventDefault();const q=el('search-input').value.trim();store.search=q;renderPOIs();
  if(!q)return;
  const local=activeFiltered.find(p=>[p.tags?.name,p.tags?.['name:ja'],p.tags?.brand].some(v=>(v||'').includes(q)));
  if(local){store.map.setView([local.lat,local.lng],Math.max(14,store.map.getZoom()));const m=store.markers.get(local.key);if(m)store.cluster.zoomToShowLayer(m,()=>m.openPopup());return;}
  const muni=store.municipalities?.features.find(f=>municipalityName(f).includes(q));
  if(muni){store.map.fitBounds(L.geoJSON(muni).getBounds().pad(.04));setStatus(`${municipalityName(muni)}に移動しました`);return;}
  try{
    setStatus('地名を検索中…','loading');
    const params=new URLSearchParams({format:'json',limit:'5',countrycodes:'jp',q:q.includes('長野県')?q:q+' 長野県'});
    const resp=await fetch('https://nominatim.openstreetmap.org/search?'+params.toString());if(!resp.ok)throw new Error('HTTP '+resp.status);
    const locations=await resp.json();const first=locations.find(x=>inNagano(Number(x.lat),Number(x.lon)));
    if(first){store.map.setView([Number(first.lat),Number(first.lon)],14);notify('地名検索：'+first.display_name,4000);setStatus('検索しました');}
    else{notify('該当する県内の施設・地名が見つかりませんでした。',5000);setStatus('検索結果なし');}
  }catch(e){notify('地名検索に失敗しました：'+e.message,6000);setStatus('地名検索に失敗','error')}
}
function openMobileSidebar(){el('sidebar').classList.add('open');el('mobile-backdrop').classList.add('show')}
function closeMobileSidebar(){el('sidebar').classList.remove('open');el('mobile-backdrop').classList.remove('show')}
function wireUI(){
  el('dismiss-map-message').onclick=()=>el('map-message').classList.remove('show');
  el('search-form').addEventListener('submit',handleSearch);
  let searchTimer;el('search-input').addEventListener('input',e=>{clearTimeout(searchTimer);const term=e.target.value.trim();searchTimer=setTimeout(()=>{store.search=term;renderPOIs()},180)});
  el('municipality-select').addEventListener('change',e=>{const name=e.target.value,feature=store.municipalities?.features.find(f=>municipalityName(f)===name);if(feature){store.map.fitBounds(L.geoJSON(feature).getBounds(),{padding:[22,22],maxZoom:13});notify(`${name}へ移動しました。施設データを取得します。`,3000);closeMobileSidebar();}});
  el('select-default').onclick=()=>setSelected(DEFAULT_IDS);
  el('all-categories').onclick=()=>{setSelected(CATEGORIES.map(c=>c.id));notify('全カテゴリを選択しました。広い範囲の一括取得は時間がかかります。',5000)};
  el('clear-categories').onclick=()=>setSelected([]);
  document.querySelectorAll('input[name="boundary"]').forEach(r=>r.addEventListener('change',()=>{if(r.checked){store.boundaryMode=r.value;updateBoundaries();}}));
  el('base-layer').onchange=e=>setBase(e.target.value);
  el('load-pois').onclick=()=>loadPOIs(false);
  el('fit-nagano').onclick=()=>store.map.fitBounds(NAGANO_BOUNDS,{padding:[25,25]});
  el('export-csv').onclick=exportCSV;
  el('export-geojson').onclick=exportGeoJSON;
  el('import-file').onchange=async e=>{if(e.target.files?.[0])await importGeoJSON(e.target.files[0]);e.target.value='';};
  el('clear-cache').onclick=async()=>{if(!confirm('ブラウザに保存された施設データをすべて削除しますか？'))return;await clearDB();store.points.clear();store.queries.clear();renderPOIs();setStatus('施設データを削除しました');notify('ローカルキャッシュを削除しました。',3000)};
  el('copy-map-link').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);notify('現在の地図URLをコピーしました。',2800)}catch{notify('この環境ではURLをコピーできません。ブラウザのアドレスバーからコピーしてください。')}};
  el('open-sidebar').onclick=openMobileSidebar;el('close-sidebar').onclick=closeMobileSidebar;el('mobile-backdrop').onclick=closeMobileSidebar;
}
// Objects thrown by browser APIs are not necessarily Error instances. They may be
// DOM Events or even plain strings, so never assume error.message exists.
function diagnosticText(error){
  if(error instanceof Error)return `${error.name}: ${error.message}`;
  if(typeof error==='string')return error;
  if(error===null)return 'null';
  if(typeof error==='undefined')return 'undefined（例外の詳細が渡されませんでした）';
  if(typeof error==='object'){
    const fields=['name','message','type','code'].filter(k=>error[k]!=null).map(k=>`${k}=${String(error[k])}`);
    return fields.length?fields.join(' / '):`${Object.prototype.toString.call(error)}（詳細不明）`;
  }
  return String(error);
}
function startupError(step,error){
  const detail=`${step}: ${diagnosticText(error)}`;
  console.error('[信州アトラス]',detail,error);
  setStatus(`${step}でエラーが発生しました`,'error');
  notify('初期化に失敗しました：'+detail+'。F12 → Console の赤いエラーを確認してください。',0);
}
async function init(){
  let stage='Leafletの読込';
  try{
    if(typeof L==='undefined')throw new Error('地図ライブラリの取得に失敗しました。ネット接続またはCDNへの接続をご確認ください');
    stage='地図の作成';configureMap();
    stage='カテゴリの描画';buildCategoryControls();
    stage='画面操作の設定';wireUI();
    stage='初期表示';renderPOIs();
  }catch(error){startupError(stage,error);return;}

  // Loading saved data is optional; browser privacy settings may disable IndexedDB.
  // The app must still operate if the browser refuses a database transaction.
  try{
    const db=await Promise.race([openDB(),new Promise(resolve=>setTimeout(()=>resolve(null),3500))]);
    store.db=db;
    const cache=await Promise.race([
      Promise.all([getAllDB('pois'),getAllDB('queries')]),
      new Promise(resolve=>setTimeout(()=>resolve([[],[]]),3500))
    ]);
    const [points,queries]=cache;
    saveRecords(points.filter(p=>p&&p.key&&Number.isFinite(p.lat)&&Number.isFinite(p.lng)));
    for(const q of queries.filter(q=>q&&q.key))store.queries.set(q.key,q);
    renderPOIs();
    setStatus(points.length?`${shortNum(points.length)}件の保存データを復元しました`:'地図の準備ができました。境界を読み込み中…');
  }catch(error){
    console.warn('施設キャッシュの復元をスキップしました',error);
    store.db=null;
    setStatus('地図の準備完了（保存データの読込は省略）');
  }
  el('map-message').classList.remove('show');
  if(store.map.getZoom()>=10)scheduleAutomaticLoad();

  // External GeoJSON requests may time out or be blocked; do not make map
  // initialization contingent on a third-party geometry server.
  fetchBoundaries().then(()=>{
    if(store.municipalities)setStatus('準備完了。施設の取得を開始できます');
  }).catch(error=>{
    console.warn('区域データを読み込めませんでした',error);
    setStatus('施設は利用可能（区域データ未取得）');
  });
}
init().catch(error=>startupError('予期しないエラー',error));