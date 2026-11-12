/* 信州アトラス GeoGuessr Toolkit v2.4 - browser-only helper */
(function(){
  'use strict';
  const $=id=>document.getElementById(id);
  const presets={
    signs:{ids:['roadstation','railway','bus','government','postoffice','school'],label:'地名・標識'},
    shops:{ids:['convenience','fuel','supermarket','drugstore','bank','restaurant'],label:'店舗・チェーン'},
    terrain:{ids:['peak','viewpoint','dam','waterfall','onsen','park'],label:'山・地形'},
    local:{ids:['school','railway','roadstation','shrine','library','hospital'],label:'地域の目印'},
    all:{ids:['convenience','fuel','supermarket','drugstore','school','railway','bus','roadstation','peak','viewpoint','government','postoffice','dam','onsen','shrine'],label:'全ヒント'}
  };
  const regions={
    north:{label:'北信',lat:36.76,lng:138.20,zoom:10},
    east:{label:'東信',lat:36.32,lng:138.50,zoom:10},
    middle:{label:'中信',lat:36.28,lng:137.83,zoom:10},
    south:{label:'南信',lat:35.77,lng:137.97,zoom:9}
  };
  let guessMode=false,guess=null,guessMarker=null,answerMarker=null,answerLine=null;
  function feedback(s){const out=$('gg-feedback');if(out)out.textContent=s;}
  function storageGet(key){try{return localStorage.getItem(key)||'';}catch{return '';}}
  function storageSet(key,v){try{localStorage.setItem(key,v);}catch{}}
  function readable(p){return p.lat.toFixed(5)+', '+p.lng.toFixed(5);}
  function setGuessMode(active){
    guessMode=active;
    const b=$('gg-set-pin');
    if(!b)return;
    b.classList.toggle('is-active',active);
    b.textContent=active?'地図をタップしてピンを置く（解除）':'地図で推定地点を指定';
    feedback(active?'地図上の推定位置をタップしてください。':'推定位置を選択できます。');
  }
  function removeAnswer(){
    if(answerMarker){store.map.removeLayer(answerMarker);answerMarker=null;}
    if(answerLine){store.map.removeLayer(answerLine);answerLine=null;}
    $('gg-result').textContent='';
  }
  function putGuess(ll){
    if(!store?.map)return;
    const lat=Number(ll.lat),lng=Number(ll.lng);
    if(!Number.isFinite(lat)||!Number.isFinite(lng))return;
    guess={lat,lng};
    if(guessMarker){guessMarker.setLatLng([lat,lng]);}
    else{
      guessMarker=L.marker([lat,lng],{draggable:true,icon:L.divIcon({className:'gg-pin-icon',html:'<span>?</span>',iconSize:[36,42],iconAnchor:[18,40]})}).addTo(store.map);
      guessMarker.on('dragend',()=>putGuess(guessMarker.getLatLng()));
    }
    removeAnswer();
    $('gg-current-guess').textContent='推定地点: '+readable(guess);
    storageSet('shinshu-gg-guess',JSON.stringify(guess));
    setGuessMode(false);
    store.map.closePopup();
  }
  window.shinshuGuessHandler=function(ll){
    if(!guessMode)return false;
    putGuess(ll);
    return true;
  };
  function parseLatLng(input){
    const hit=String(input).trim().match(/(-?\d{1,2}(?:\.\d+)?)\s*[,，\s]\s*(-?\d{2,3}(?:\.\d+)?)/);
    if(!hit)return null;
    const lat=Number(hit[1]),lng=Number(hit[2]);
    if(lat<-90||lat>90||lng<-180||lng>180)return null;
    return {lat,lng};
  }
  function calculate(){
    if(!guess){feedback('先に地図をタップして推定地点を置いてください。');return;}
    const answer=parseLatLng($('gg-answer').value);
    if(!answer){feedback('正解座標を「36.12345, 138.12345」の形式で入力してください。');return;}
    removeAnswer();
    answerMarker=L.circleMarker([answer.lat,answer.lng],{radius:9,color:'#0c7362',fillColor:'#5fe2bd',fillOpacity:1,weight:3}).addTo(store.map).bindPopup('正解地点');
    answerLine=L.polyline([[guess.lat,guess.lng],[answer.lat,answer.lng]],{color:'#e78040',dashArray:'7 7',weight:3}).addTo(store.map);
    const km=distanceKm(guess,answer);
    const text=km<1?(km*1000).toFixed(0)+' m':km.toFixed(2)+' km';
    $('gg-result').textContent='推定と正解の距離: '+text;
    store.map.fitBounds(L.latLngBounds([guess.lat,guess.lng],[answer.lat,answer.lng]).pad(.32),{maxZoom:15});
    feedback('結果を表示しました。ピンの位置はドラッグで調整できます。');
  }
  function clearGuess(){
    if(guessMarker)store.map.removeLayer(guessMarker);
    guessMarker=null;guess=null;removeAnswer();
    $('gg-current-guess').textContent='まだ推定地点がありません';
    storageSet('shinshu-gg-guess','');
    setGuessMode(false);
  }
  function moveRegion(key){
    const r=regions[key];if(!r)return;
    store.map.setView([r.lat,r.lng],r.zoom);
    feedback(r.label+'地方の目安に移動しました（行政界そのものではありません）。');
    if(typeof closeMobileSidebar==='function')closeMobileSidebar();
  }
  function selectPreset(key){
    const preset=presets[key];if(!preset)return;
    if(typeof setSelected!=='function')return;
    setSelected(preset.ids);
    document.querySelectorAll('[data-gg-preset]').forEach(b=>b.classList.toggle('is-active',b.dataset.ggPreset===key));
    feedback(preset.label+'向けの施設カテゴリに切り替えました。ズームして施設を取得してください。');
  }
  function searchClue(){
    const term=$('gg-clue').value.trim();
    if(!term){feedback('看板や施設に書かれた文字を入力してください。');return;}
    const input=$('search-input');
    input.value=term;
    // Reuse the existing search flow: local POI names first, then a bounded geocoder.
    const form=$('search-form');
    if(form.requestSubmit)form.requestSubmit();else form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    feedback('「'+term+'」を検索しています。読み込み済み施設や地名から照合します。');
    if(typeof closeMobileSidebar==='function')closeMobileSidebar();
  }
  function setup(){
    if(typeof store==='undefined'||!store.map||!$('gg-toolkit'))return;
    document.querySelectorAll('[data-gg-preset]').forEach(b=>b.addEventListener('click',()=>selectPreset(b.dataset.ggPreset)));
    document.querySelectorAll('[data-gg-region]').forEach(b=>b.addEventListener('click',()=>moveRegion(b.dataset.ggRegion)));
    $('gg-clue-form').addEventListener('submit',e=>{e.preventDefault();searchClue();});
    $('gg-set-pin').addEventListener('click',()=>setGuessMode(!guessMode));
    $('gg-clear-pin').addEventListener('click',clearGuess);
    $('gg-check').addEventListener('click',calculate);
    $('gg-copy-pin').addEventListener('click',()=>{
      if(!guess){feedback('まだ推定地点がありません。');return;}
      const data=readable(guess);
      if(navigator.clipboard?.writeText)navigator.clipboard.writeText(data).then(()=>feedback('座標をコピーしました。')).catch(()=>feedback('コピーできませんでした: '+data));
      else feedback('推定座標: '+data);
    });
    const memo=$('gg-memo');memo.value=storageGet('shinshu-gg-memo');
    memo.addEventListener('input',()=>storageSet('shinshu-gg-memo',memo.value));
    store.map.on('click',e=>{if(guessMode)putGuess(e.latlng);});
    try{
      const stored=JSON.parse(storageGet('shinshu-gg-guess')||'null');
      if(stored&&Number.isFinite(stored.lat)&&Number.isFinite(stored.lng))putGuess(stored);
    }catch{}
    feedback('道路標識・学校名・店名・山の名前などを手がかりに検索できます。');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
})();