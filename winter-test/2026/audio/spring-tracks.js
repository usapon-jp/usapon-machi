/* ===== SpringTracks (癒しの泉) — Gemini で作った曲を、つなぎ目なく流し続けるプレーヤー =====
   - 曲のデータは加工しない。音量は曲ごとの固定トリム(dB)だけ、つなぎ目は「次の曲を、前の曲が終わる L 秒前に頭から鳴らす」だけ。
     フェードの曲線は掛けない(各曲が持っている自然なフェードアウトと静かな導入を、そのまま重ねる)。
   - 重なり時間 L は曲の組ごとに、冒頭と終盤の音量を解析して決めた表 OVERLAP を使う。
   - 再生は <audio> 2本(ストリーミング)を Web Audio に接続。曲まるごとをメモリに展開しない(スマホのメモリ対策)。
     次の曲は、いまの曲の途中(30秒以降)になってから読み込み始める。
   使い方: const T = SpringTracks.create(ctx, destNode, {base:'audio/spring/'});
          T.start(['clearing','garden','water']);  // ユーザーのタップの中で呼ぶ(iOS対策)
          T.pause(); T.resume(); T.stop(); */
(function(root){
'use strict';

/* dur=秒, trim=dB(曲ごとの聴感ラウドネスをそろえる), entry=曲が静かな導入から本編に入る時刻(秒)
   LUFS(元音源): clearing -11.5 / midnight -11.5 / garden -11.3 / water -11.5 / surface -10.5 */
const TRACKS={
  clearing:{file:'clearing-at-first-light.mp3',title:'Clearing at First Light',dur:170.63,trim:0,   skip:4.0,entry:15.3},
  midnight:{file:'midnight-mirror.mp3',        title:'Midnight Mirror',        dur:175.91,trim:0,   skip:3.0,entry:17.0},
  garden:  {file:'the-gardens-first-breath.mp3',title:"The Garden's First Breath",dur:155.32,trim:-0.2,skip:13.5,entry:14.0},
  water:   {file:'where-water-meets-stone.mp3', title:'Where Water Meets Stone', dur:156.55,trim:0,   skip:0,entry:12.5},
  surface: {file:'where-the-surface-rests.mp3', title:'Where the Surface Rests', dur:169.46,trim:-1.0,skip:3.0,entry:23.3}
};
/* 「前の曲 → 次の曲」で、次の曲を前の曲の終わりの何秒前から鳴らすか(秒)。冒頭と終盤の音量を解析して決めた(/tmp 解析: seam3)。
   次の曲の本編(entry)は、前の曲の余韻が十分小さくなってから入るようにしてある */
const OVERLAP={
  'clearing|midnight':10,'clearing|garden':22,'clearing|water':8, 'clearing|surface':9,
  'midnight|clearing':10,'midnight|garden':20,'midnight|water':6, 'midnight|surface':8,
  'garden|clearing':13,  'garden|midnight':13, 'garden|water':12, 'garden|surface':12,
  'water|clearing':12,   'water|midnight':12,  'water|garden':22, 'water|surface':12,
  'surface|clearing':8,  'surface|midnight':5, 'surface|garden':19,'surface|water':5
};
const DEFAULT_OVERLAP=10;

const dB=x=>Math.pow(10,x/20);
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;const t=a[i];a[i]=a[j];a[j]=t}return a}
// 無音の短い wav(iOS で <audio> を「ユーザー操作のなかで」使えるようにしておくため)
function silentWav(){
  const n=800,b=new Uint8Array(44+n);const dv=new DataView(b.buffer);
  const s=(o,t)=>{for(let i=0;i<t.length;i++)b[o+i]=t.charCodeAt(i)};
  s(0,'RIFF');dv.setUint32(4,36+n,true);s(8,'WAVEfmt ');dv.setUint32(16,16,true);dv.setUint16(20,1,true);dv.setUint16(22,1,true);
  dv.setUint32(24,8000,true);dv.setUint32(28,8000,true);dv.setUint16(32,1,true);dv.setUint16(34,8,true);s(36,'data');dv.setUint32(40,n,true);
  for(let i=0;i<n;i++)b[44+i]=128;
  let str='';for(let i=0;i<b.length;i++)str+=String.fromCharCode(b[i]);
  return 'data:audio/wav;base64,'+btoa(str);
}

function create(ctx,dest,opts){
  opts=opts||{};
  const base=opts.base||'audio/spring/';
  const log=opts.onEvent||function(){};
  const tracks=opts.tracks||TRACKS, overlaps=opts.overlap||OVERLAP;
  const direct=!!opts.direct;      // true: Web Audio を通さず <audio>.volume で音量を決める(音源が別オリジン扱いで無音になる環境用。試聴ページが自動で切り替える)
  let busLevel=1;
  let slots=null,cur=0,ids=[],queue=[],lastId=null,nextPlan=null,timer=null,running=false,paused=false,primed=false;
  const SIL=silentWav();

  function mkSlot(){
    const el=new Audio();el.preload='auto';el.setAttribute('playsinline','');el.setAttribute('webkit-playsinline','');
    const slot={el,id:null,started:false,loaded:null,startedAt:0,lv:1,rt:0};
    el.addEventListener('error',()=>log({type:'error',id:slot.id,code:el.error&&el.error.code}));
    if(direct){
      slot.level=v=>{clearInterval(slot.rt);slot.lv=v;el.volume=Math.max(0,Math.min(1,v*busLevel))};
      slot.ramp=(to,sec)=>{clearInterval(slot.rt);const from=slot.lv,t0=Date.now();slot.rt=setInterval(()=>{const k=Math.min(1,(Date.now()-t0)/(sec*1000));slot.lv=from+(to-from)*k;el.volume=Math.max(0,Math.min(1,slot.lv*busLevel));if(k>=1)clearInterval(slot.rt)},80)};
    }else{
      const src=ctx.createMediaElementSource(el),g=ctx.createGain();g.gain.value=1;src.connect(g);g.connect(dest);slot.src=src;slot.g=g;
      slot.level=v=>{g.gain.cancelScheduledValues(ctx.currentTime);g.gain.value=v;slot.lv=v};
      slot.ramp=(to,sec)=>{const t=ctx.currentTime;g.gain.cancelScheduledValues(t);g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(to,t+sec)};
    }
    return slot;
  }
  function url(id){return base+tracks[id].file}
  function overlapFor(a,b){const v=overlaps[a+'|'+b];return v==null?DEFAULT_OVERLAP:v}
  function pick(){ // 次に流す曲: 全曲を一巡してから並べ替え、直前の曲は繰り返さない
    if(!ids.length)return null;
    if(!queue.length){queue=shuffle(ids);if(ids.length>1&&queue[0]===lastId){const k=1+(Math.random()*(queue.length-1)|0);const t=queue[0];queue[0]=queue[k];queue[k]=t}}
    return queue.shift();
  }
  function load(slot,id){ // 読み込みだけ(再生はしない)
    if(slot.loaded===id)return;
    slot.id=id;slot.loaded=id;slot.started=false;
    slot.el.src=url(id);slot.el.load();
    slot.level(dB(tracks[id].trim));
  }
  function play(slot,pos){
    const p=slot.el;
    try{if(pos>0)p.currentTime=pos}catch(e){}
    slot.started=true;slot.startedAt=ctx.currentTime;
    const pr=p.play();if(pr&&pr.catch)pr.catch(err=>{log({type:'play-blocked',id:slot.id,err:String(err&&err.name||err)});slot.started=false});
  }
  function retire(slot){
    try{slot.el.pause()}catch(e){}
    slot.started=false;slot.loaded=null;slot.id=null;
  }
  function planNext(){
    const A=slots[cur];
    if(nextPlan&&nextPlan.after===A.id)return;
    const nid=pick();if(!nid)return;
    nextPlan={after:A.id,id:nid,overlap:overlapFor(A.id,nid)};
    log({type:'plan',after:A.id,next:nid,overlap:nextPlan.overlap});
  }
  function tick(){
    if(!running||paused||!slots)return;
    const A=slots[cur],B=slots[1-cur];
    if(!A.id)return;
    const meta=tracks[A.id],pos=A.el.currentTime,dur=(isFinite(A.el.duration)&&A.el.duration>10?A.el.duration:meta.dur);
    if(!nextPlan)planNext();
    // 次の曲を読み込み始める(いまの曲の30秒以降。曲が短くても終わりの40秒前までには)
    if(nextPlan&&B.loaded!==nextPlan.id&&!B.started&&(pos>30||dur-pos<nextPlan.overlap+40))load(B,nextPlan.id);
    const remaining=dur-pos;
    if(nextPlan&&!B.started&&remaining<=nextPlan.overlap){
      if(B.loaded!==nextPlan.id)load(B,nextPlan.id);
      play(B,0);lastId=nextPlan.id;log({type:'start-next',from:A.id,id:B.id,overlap:+remaining.toFixed(2),pos:+pos.toFixed(2)});
    }
    if(A.el.ended||remaining<=0.03){ // いまの曲が終わった
      const nextStarted=B.started;
      retire(A);
      if(nextStarted){cur=1-cur;nextPlan=null;log({type:'handover',now:slots[cur].id})}
      else if(nextPlan){ // 次の曲がまだ始まっていない(読み込みが遅れたなど): すぐ頭から流す
        load(B,nextPlan.id);play(B,0);lastId=nextPlan.id;cur=1-cur;log({type:'late-start',id:B.id});nextPlan=null}
    }
  }
  function prime(){ // タップの中で呼ぶ: 2本目の<audio>も「再生してよい」状態にしておく(iOS Safari)。1本目は本物の曲をそのまま再生する
    if(primed)return;primed=true;
    const s=slots[1];try{s.el.src=SIL;const p=s.el.play();if(p&&p.then)p.then(()=>{if(!s.started)try{s.el.pause()}catch(e){}}).catch(()=>{})}catch(e){}
  }
  return {
    TRACKS:tracks,OVERLAP:overlaps,
    /* 再生を始める。ids=流す曲の並び(順不同。一巡ごとに並べ替える)。first=最初の曲(省略可)、pos=最初の曲の開始位置(秒) */
    start(list,first,pos){
      if(!slots)slots=[mkSlot(),mkSlot()];
      ids=list.filter(i=>tracks[i]);if(!ids.length)return false;
      running=true;paused=false;queue=[];nextPlan=null;
      for(const s of slots)retire(s);
      prime();
      cur=0;const id=first&&ids.indexOf(first)>=0?first:pick();
      if(first&&queue.indexOf(first)>=0)queue.splice(queue.indexOf(first),1);
      load(slots[0],id);lastId=id;play(slots[0],pos==null?(tracks[id].skip||0):pos);
      log({type:'start',id,pos:pos||0});
      if(!timer)timer=setInterval(tick,250);
      return true;
    },
    setBus(v){busLevel=v;if(direct)for(const s of slots||[])s.el.volume=Math.max(0,Math.min(1,s.lv*busLevel))},
    get direct(){return direct},
    pause(){if(!running||paused)return;paused=true;for(const s of slots||[])if(s.started)try{s.el.pause()}catch(e){}},
    resume(){if(!running||!paused)return;paused=false;for(const s of slots||[])if(s.started){const p=s.el.play();if(p&&p.catch)p.catch(()=>{})}},
    stop(){running=false;paused=false;if(timer){clearInterval(timer);timer=null}for(const s of slots||[])retire(s);nextPlan=null},
    setPlaylist(list){ids=list.filter(i=>tracks[i]);queue=queue.filter(i=>ids.indexOf(i)>=0);if(nextPlan&&ids.indexOf(nextPlan.id)<0&&!slots[1-cur].started)nextPlan=null},
    /* 試聴用: いまの曲を、つなぎ目の手前 sec 秒に移動する */
    seekToSeam(sec){if(!running||!slots)return;const A=slots[cur];if(!A.id)return;if(!nextPlan)planNext();
      const t=Math.max(0,tracks[A.id].dur-(nextPlan?nextPlan.overlap:DEFAULT_OVERLAP)-(sec==null?10:sec));try{A.el.currentTime=t}catch(e){}},
    /* 試聴用: いますぐ次の曲へ(いまの曲は rel 秒かけて小さくする) */
    skip(rel){if(!running||!slots)return;const A=slots[cur],B=slots[1-cur];if(!A.id||B.started)return;
      if(!nextPlan)planNext();load(B,nextPlan.id);play(B,0);lastId=nextPlan.id;
      const r=rel==null?5:rel;A.ramp(0,r);
      const old=A;setTimeout(()=>{if(slots[cur]===old){retire(old);cur=1-cur;nextPlan=null}},r*1000+80);log({type:'skip',id:B.id})},
    state(){
      if(!slots||!running)return {running:false};
      const A=slots[cur],B=slots[1-cur];
      return {running:true,paused,id:A.id,pos:A.el.currentTime||0,dur:A.id?tracks[A.id].dur:0,next:nextPlan?nextPlan.id:null,overlap:nextPlan?nextPlan.overlap:null,
        nextPlaying:B.started,nextPos:B.started?B.el.currentTime:0,
        ready:A.el.readyState,blocked:!A.started};
    },
    get running(){return running},get paused(){return paused},_slots:()=>slots
  };
}
root.SpringTracks={create,TRACKS,OVERLAP};
})(typeof window!=='undefined'?window:globalThis);
