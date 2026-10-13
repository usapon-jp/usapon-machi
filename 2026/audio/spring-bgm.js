/* ===== SpringBGM (癒しの泉) — 生成型ヒーリングBGMエンジン =====
   外部音声ファイルなし。Web Audio だけで「水音 + 淡いパッド + ガラスのきらめき」をその場で生成し続ける。
   - 1/fゆらぎ: 6〜11オクターブ分のなめらかな乱数を足し合わせた Pink(). パッドの強弱/フィルター/水音/きらめきの出現頻度/残響量にだけ使う
   - 和音: 全部ダイアトニックのゆるい7th/add9/sus2/6th。声部はなるべく動かさず、動く声も1つずつずらして変える
   - 時計: AudioContext.currentTime の先読みスケジューリング(setInterval は 250ms ごとに「ならす予約」を入れるだけ)
   使い方: const bgm = SpringBGM.create(ctx, ctx.destination); bgm.start(); bgm.setVolume(.6); bgm.stop(); */
(function(root){
'use strict';

/* ---------- 小道具 ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const hz=m=>440*Math.pow(2,(m-69)/12);
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const lerp=(a,b,t)=>a+(b-a)*t;

/* 1/fゆらぎ: オクターブごとに(周期が倍々の)なめらかな乱数を同じ強さで足す(Voss法の補間版)。
   step(dt)で時間を進め、v(≈-1..1に収まる)を返す。raw は PSD 検証用の未圧縮値 */
function Pink(rand,oct,base){
  const o=[];for(let i=0;i<oct;i++)o.push({T:base*Math.pow(2,i),a:rand()*2-1,b:rand()*2-1,ph:rand()});
  const norm=1/Math.sqrt(oct*0.19);
  const me={raw:0,v:0,step(dt){let s=0;
    for(let i=0;i<oct;i++){const k=o[i];k.ph+=dt/k.T;while(k.ph>=1){k.ph-=1;k.a=k.b;k.b=rand()*2-1}
      const x=k.ph,w=x*x*(3-2*x);s+=k.a+(k.b-k.a)*w}
    me.raw=s*norm;me.v=Math.tanh(me.raw*0.9);return me.v}};
  me.step(0);return me;
}

/* ---------- モード設定(数値は時間をかけて補間される。いまは「昼」だけ) ---------- */
const CH={ // 主音からの半音。ぜんぶ長音階の中の音
  I:   {n:'Iadd9/maj9', iv:[0,4,7,11,14]},
  IV:  {n:'IVmaj7(9)',  iv:[5,9,12,16,19]},
  vi:  {n:'vi9',        iv:[9,12,16,19,23]},
  V:   {n:'V6/9',       iv:[7,11,14,16,21]},
  ii:  {n:'iisus(9)',   iv:[2,4,7,9,12]},
  iii: {n:'iiim7(11)',  iv:[4,7,11,14,9]}
};
const MODES={
  day:{
    pool:['I','IV','vi','V','ii','iii'], keys:[2,9,2,7], // D → A → D → G …(明るい調をゆっくり巡る)
    padLvl:.14, padCutLo:900, padCutHi:2600, bassLvl:.018, chordMin:28, chordMax:52,
    glassRate:1/22, glassLvl:.04, epRate:1/60, epLvl:.024, sparkRate:1/36, sparkLvl:.013,
    waterLvl:1.1, flowFreq:820, babble:.3, plopRate:1/48, dropRate:1/18, wash:.14,
    rev:.5, lp:8200
  }
};

/* ---------- エンジン ---------- */
function create(ctx,dest,opts){
  opts=opts||{};
  const rand=mulberry32(opts.seed!=null?opts.seed:(Math.random()*2**31|0));
  const R=()=>rand();
  const manual=!!opts.manual;            // true: タイマーを使わず外から pump(t) する(オフライン書き出し/検査用)
  const LOOK=2.6, CTL=.25;               // 先読み秒 / ゆらぎ更新周期
  let mode='day',target=MODES.day,cur=Object.assign({},MODES.day);
  let built=false,running=false,timer=null,t0=0,ctlT=0,vol=.6,disposed=false;
  const log=[];const L=(t,type,x)=>{if(log.length<4000)log.push(Object.assign({t:+t.toFixed(2),type},x||{}))};
  const stat={voices:0,maxVoices:0,created:0,events:{glass:0,ep:0,spark:0,plop:0,bloop:0,chord:0}};
  const live=[]; // {end}
  const T={water:1,pad:1,glass:1,drops:1}; // 試聴用の層ごとのバランス(線形ゲイン)
  const N={}; // ノード置き場
  const mf=k=>opts.mute&&opts.mute.indexOf(k)>=0?0:1; // 検査用: 層を個別に消す

  /* ゆらぎ(1/f): 用途ごとに独立 */
  const P={pad:Pink(rand,10,2.5),cut:Pink(rand,10,2.5),water:Pink(rand,10,2),tex:Pink(rand,9,1.5),dens:Pink(rand,11,2.5),wide:Pink(rand,9,3)}; // 最速の揺れでも周期 約3〜5秒

  /* ---------- 構築 ---------- */
  function noiseBuf(sec,seed){ // ピンクがかったステレオノイズ(L/Rは別乱数)
    const sr=ctx.sampleRate,n=sr*sec|0,b=ctx.createBuffer(2,n,sr),rr=mulberry32(seed);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
      for(let i=0;i<n;i++){const w=rr()*2-1;
        b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;
        d[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926}
      // ループ継ぎ目: 端を短くクロスフェード
      const f=sr*.25|0;for(let i=0;i<f;i++){const a=i/f;d[i]=d[i]*a+d[n-f+i]*(1-a)}}
    return b}
  function makeIR(sec){
    const sr=ctx.sampleRate,n=sr*sec|0,b=ctx.createBuffer(2,n,sr),rr=mulberry32(77);
    for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;const pre=sr*.022|0;
      for(let i=pre;i<n;i++){const t=(i-pre)/sr,u=(i-pre)/(n-pre);
        const env=Math.exp(-6.9*t/(sec*.8));              // 約4秒で -60dB
        lp+=((rr()*2-1)-lp)*(.8*(1-u)+.16*u);              // 尾に向かってだんだん暗くなる
        d[i]=lp*env}
      for(const [dt,g] of [[.031,.5],[.047,.4],[.071,.3],[.093,.25]]){const k=(dt*sr|0)+(c?19:0);d[k]+=g*(c?-1:1)*.6}}
    return b}
  function src(buf,rate,offset){const s=ctx.createBufferSource();s.buffer=buf;s.loop=true;s.playbackRate.value=rate||1;s.start(0,offset||0);return s}
  function biq(type,f,q){const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;if(q!=null)b.Q.value=q;return b}
  function gain(v){const g=ctx.createGain();g.gain.value=v;return g}
  function pan(p){if(ctx.createStereoPanner){const s=ctx.createStereoPanner();s.pan.value=p;return s}return gain(1)}
  function lfo(f,depth,param){const o=ctx.createOscillator();o.frequency.value=f;const g=gain(depth);o.connect(g);g.connect(param);o.start();return o}

  function build(){
    if(built)return;built=true;
    // 出力: 音量 → 軽いリミッター → 出口
    N.out=gain(0);
    N.comp=ctx.createDynamicsCompressor();
    N.comp.threshold.value=-12;N.comp.knee.value=10;N.comp.ratio.value=4;N.comp.attack.value=.05;N.comp.release.value=.6; // 音量を最大にしたときだけ効く保険のリミッター
    N.hp=biq('highpass',90,.6);N.lp=biq('lowpass',cur.lp,.5);
    N.mix=gain(1);N.mix.connect(N.hp);N.hp.connect(N.lp);N.lp.connect(N.out);N.out.connect(N.comp);N.comp.connect(dest); // 音量(N.out)→リミッター→出口
    // 残響(1個だけ共有)
    N.rev=ctx.createConvolver();N.rev.buffer=makeIR(3.8);
    N.revIn=gain(1);N.revWet=gain(cur.rev*.5);N.revIn.connect(N.rev);N.rev.connect(N.revWet);N.revWet.connect(N.mix);
    // きらめき用のゆるいエコー(左右で長さを変える)
    N.echoIn=gain(1);N.echoWet=gain(.4);
    {const dl=ctx.createDelay(2),dr=ctx.createDelay(2),fb=gain(.34),flp=biq('lowpass',2400,.4),mer=ctx.createChannelMerger(2);
     dl.delayTime.value=.47;dr.delayTime.value=.71;
     N.echoIn.connect(dl);dl.connect(flp);flp.connect(fb);fb.connect(dr);dr.connect(dl);
     dl.connect(mer,0,0);dr.connect(mer,0,1);mer.connect(N.echoWet);N.echoWet.connect(N.mix);N.echoWet.connect(N.revIn)}

    /* パッド: 声ごとに(のこぎり+三角)→パン→共通ローパス(1/fで開閉)→コーラス→ミックス */
    N.padIn=gain(1);N.padLP=biq('lowpass',1100,.4);N.padOut=gain(cur.padLvl);
    N.padIn.connect(N.padLP);
    {const dry=gain(.62),ch=ctx.createDelay(.05),chG=gain(.5);ch.delayTime.value=.017;
     lfo(.11,.002,ch.delayTime);
     N.padLP.connect(dry);N.padLP.connect(ch);ch.connect(chG);dry.connect(N.padOut);chG.connect(N.padOut);
     N.padOut.connect(N.mix);const s=gain(.5);N.padOut.connect(s);s.connect(N.revIn);}

    /* 水音 */
    N.water=gain(cur.waterLvl*mf('water')*T.water);N.bed=gain(mf('bed'));N.bed.connect(N.water);N.waterLP=biq('lowpass',2300,.4);N.water.connect(N.waterLP);N.waterLP.connect(N.mix);
    {const s=gain(.16);N.waterLP.connect(s);s.connect(N.revIn)}
    const bufA=noiseBuf(7,11),bufB=noiseBuf(11,23);N.bufs=[bufA,bufB];
    // (1) 流れ: やわらかな「ふわぁ」
    N.flowSrc=src(bufA,1,0);N.flowBP=biq('bandpass',cur.flowFreq,1.4);N.flowG=gain(.075);
    {const hp=biq('highpass',330,.5);N.flowSrc.connect(hp);hp.connect(N.flowBP);N.flowBP.connect(N.flowG);N.flowG.connect(N.bed)}
    // (2) さざ波のあわ: 中域を、ずれた周期の揺れで細かく揺らす
    N.babSrc=src(bufB,1.07,2.3);N.babBP=biq('bandpass',1250,1.8);N.babG=gain(.0);N.babAM=gain(.5);
    {N.babSrc.connect(N.babBP);N.babBP.connect(N.babAM);N.babAM.connect(N.babG);N.babG.connect(N.bed);
     N.lfos=[lfo(2.9,.08,N.babAM.gain),lfo(4.7,.05,N.babAM.gain),lfo(.31,.2,N.babAM.gain)];
     N.babFreqL=lfo(.21,300,N.babBP.frequency)}
    // (3) 水辺のうねり(低めの ちゃぷ…ちゃぷ…)
    N.washSrc=src(bufA,.6,3.1);N.washLP=biq('lowpass',520,.6);const washHP=biq('highpass',220,.5);N.washG=gain(0);N.washAM=gain(.6);
    {N.washSrc.connect(washHP);washHP.connect(N.washLP);N.washLP.connect(N.washAM);N.washAM.connect(N.washG);N.washG.connect(N.bed);
     N.lfos.push(lfo(.11,.15,N.washAM.gain),lfo(.07,.1,N.washAM.gain))}
    // (4) 空気: ほとんど意識しない高めの空気
    N.airSrc=src(bufB,.8,5.7);N.airLP=biq('lowpass',900,.3);N.airG=gain(.03);
    {const hp=biq('highpass',300,.4);N.airSrc.connect(hp);hp.connect(N.airLP);N.airLP.connect(N.airG);N.airG.connect(N.bed)}
    // きらめき/EP/低音の出口
    N.glassBus=gain(mf('glass')*T.glass);N.glassBus.connect(N.mix);
    {const s=gain(.7);N.glassBus.connect(s);s.connect(N.revIn);const e=gain(.35);N.glassBus.connect(e);e.connect(N.echoIn)}
    N.curve=new Float32Array(64);for(let i=0;i<64;i++){const x=i/63;N.curve[i]=Math.sin(x*Math.PI/2)**2}
  }

  /* ---------- ノードの寿命管理 ---------- */
  function reg(end){stat.created++;live.push({end});}
  function reap(now){for(let i=live.length-1;i>=0;i--)if(live[i].end<now)live.splice(i,1);
    stat.voices=live.length;if(stat.voices>stat.maxVoices)stat.maxVoices=stat.voices}
  function cleanup(osc,nodes){osc.onended=()=>{for(const n of nodes){try{n.disconnect()}catch(e){}}}}

  /* ---------- 楽器 ---------- */
  const SLOT_LO=[55,60,64,67],SLOT_HI=[67,72,76,79],SLOT_PAN=[-.45,-.15,.15,.45];
  function padVoice(t,midi,slot,atk){
    const f=hz(midi),g=gain(0),p=pan(SLOT_PAN[slot]);
    const o1=ctx.createOscillator(),o2=ctx.createOscillator(),g1=gain(.14),g2=gain(.46),o3=ctx.createOscillator(),g3=gain(.2);o3.type='sine';o3.frequency.value=f*2;o3.detune.value=R()*4-2;o3.connect(g3);g3.connect(g);
    o1.type='sawtooth';o1.frequency.value=f;o1.detune.value=-6+R()*2;
    o2.type='triangle';o2.frequency.value=f;o2.detune.value=6-R()*2;
    o1.connect(g1);o2.connect(g2);g1.connect(g);g2.connect(g);g.connect(p);p.connect(N.padIn);
    g.gain.setValueCurveAtTime(N.curve.map(x=>x*.25),t,atk);
    o1.start(t);o2.start(t);o3.start(t);reg(1e9);const rec=live[live.length-1];
    return {g,o:[o1,o2,o3],nodes:[g,g1,g2,p],rec,midi,atk,t,
      release(tr,rel){try{g.gain.setTargetAtTime(0,tr,rel/4)}catch(e){}
        o1.stop(tr+rel*1.15);o2.stop(tr+rel*1.15);o3.stop(tr+rel*1.15);cleanup(o1,[o1,o2,o3,g1,g2,g3,g,p]);rec.end=tr+rel*1.15}}}
  function bassVoice(t,midi,atk){
    const g=gain(0),o=ctx.createOscillator();o.type='sine';o.frequency.value=hz(midi);o.connect(g);g.connect(N.padIn);
    g.gain.setValueCurveAtTime(N.curve.map(x=>x*cur.bassLvl*2.2),t,atk);o.start(t);reg(1e9);const rec=live[live.length-1];
    return {g,midi,rec,release(tr,rel){try{g.gain.setTargetAtTime(0,tr,rel/4)}catch(e){}o.stop(tr+rel*1.15);cleanup(o,[o,g]);rec.end=tr+rel*1.15}}}
  /* ガラス: 倍音(1, 2, 3.01, 4.2)にゆっくり立ち上がり→長い余韻 */
  function glass(t,midi,lvl,panv){
    const f=hz(midi),atk=.6+R()*.7,dec=2.6+R()*2.2,tail=atk+dec*5;
    const g=gain(0),p=pan(panv);g.connect(p);p.connect(N.glassBus);
    const parts=[[1,1,1],[2.0,.3,.55],[3.01,.09,.3],[4.2,.04,.2]];let last=null;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(lvl,t+atk);g.gain.setTargetAtTime(0,t+atk,dec);
    const ns=[g,p];
    for(const [r,a,d] of parts){if(f*r>9000)continue;const o=ctx.createOscillator(),pg=gain(a);o.type='sine';o.frequency.value=f*r;
      pg.gain.setValueAtTime(a,t);pg.gain.setTargetAtTime(a*.2,t+atk,dec*d);o.connect(pg);pg.connect(g);o.start(t);o.stop(t+tail);ns.push(o,pg);last=o}
    cleanup(last,ns);reg(t+tail)}
  /* 遠くのエレピ: やわらかい2オペFM */
  function ep(t,midi,lvl,panv){
    const f=hz(midi),g=gain(0),p=pan(panv),c=ctx.createOscillator(),m=ctx.createOscillator(),mg=gain(0),lp=biq('lowpass',1900,.5);
    c.type='sine';m.type='sine';c.frequency.value=f;m.frequency.value=f*2;
    mg.gain.setValueAtTime(f*1.1,t);mg.gain.setTargetAtTime(f*.04,t,.7);
    m.connect(mg);mg.connect(c.frequency);c.connect(lp);lp.connect(g);g.connect(p);p.connect(N.glassBus);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(lvl,t+.07);g.gain.setTargetAtTime(0,t+.07,1.9);
    c.start(t);m.start(t);c.stop(t+10);m.stop(t+10);cleanup(c,[c,m,mg,lp,g,p]);reg(t+10)}
  /* 丸く小さな「ぽちゃん」: 低めのサインを短く立ち上げて指数で減衰。ピッチはほぼ一定(+3%)で、共鳴フィルターは使わない */
  function drop(t,small){
    if(!mf('drops'))return;
    const f=small?430+R()*150:290+R()*100,dur=small?.13:.2+R()*.06,pn=R()*1.2-.6,lvl=(small?.45:1)*(.6+R()*.4)*.0125*T.drops;
    const o=ctx.createOscillator(),g=gain(0),p=pan(pn),lp=biq('lowpass',1000,.3);o.type='sine';
    o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*1.03,t+.05);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(lvl,t+.012);g.gain.setTargetAtTime(0,t+.012,dur/4);
    o.connect(g);g.connect(lp);lp.connect(p);p.connect(N.water);
    const rv=gain(.5);p.connect(rv);rv.connect(N.revIn); // 余韻は残響にまかせる
    o.start(t);o.stop(t+dur*1.6);cleanup(o,[o,g,lp,p,rv]);reg(t+dur*1.6+.05)}
  function plop(t){drop(t,false);L(t,'plop');stat.events.plop++}

  /* ---------- 和音 ---------- */
  const PERMS=[];(function p(a,r){if(!r.length){PERMS.push(a);return}for(let i=0;i<r.length;i++)p(a.concat(r[i]),r.filter((_,j)=>j!==i))})([],[0,1,2,3]);
  function lead(prev,pcs){
    let best=null,bc=1e9;
    for(let skip=0;skip<pcs.length;skip++){const combo=pcs.filter((_,i)=>i!==skip);
      for(const perm of PERMS){let cost=0;const notes=[];
        for(let i=0;i<4;i++){const pc=combo[perm[i]];let bm=null,bd=1e9;
          for(let m=SLOT_LO[i];m<=SLOT_HI[i];m++)if(m%12===pc){const d=Math.abs(m-prev[i]);if(d<bd){bd=d;bm=m}}
          if(bm==null){cost=1e9;break}notes.push(bm);cost+=bd+(bd>0?.8:0)}
        if(cost>=1e9)continue;
        const s=notes.slice().sort((a,b)=>a-b);let bad=false;
        for(let i=1;i<4;i++){const d=s[i]-s[i-1];if(d===0)bad=true;else if(d===1)cost+=8;else if(d===2)cost+=1}
        if(bad)continue;if(s[3]-s[0]<9)cost+=6;
        cost+=R()*2.6;if(cost<bc){bc=cost;best=notes}}}
    return best||prev}
  const CS={voices:[null,null,null,null],bass:null,prev:[59,64,71,76],chord:null,key:target.keys[0],keyIdx:0,nchord:0,hist:[],nextKeyAt:16,nextChord:0};
  function pickChord(){
    const pool=target.pool,lastDeg=CS.chord?CS.chord.deg:null,ban=CS.hist.slice(-2);
    const curPcs=CS.chord?CS.chord.pcs:[];let tot=0;const w=pool.map(d=>{
      if(d===lastDeg||ban.includes(d))return 0;
      const pcs=CH[d].iv.map(x=>(x+CS.key)%12),ov=pcs.filter(x=>curPcs.includes(x)).length;
      const x=.35+Math.pow(ov,1.5);tot+=x;return x});
    let r=R()*tot,i=0;for(;i<w.length-1;i++){r-=w[i];if(r<=0)break}
    while(w[i]===0)i=(i+1)%w.length;
    return pool[i]}
  function changeChord(t,first){
    if(!first&&CS.nchord>=CS.nextKeyAt){CS.keyIdx=(CS.keyIdx+1)%target.keys.length;CS.key=target.keys[CS.keyIdx];CS.nextKeyAt=CS.nchord+14+(R()*9|0);L(t,'key',{key:CS.key})}
    const deg=pickChord(),def=CH[deg],pcs=def.iv.map(x=>(x+CS.key)%12);
    const notes=lead(CS.prev,pcs);
    const atk=5+R()*2.5,rel=7+R()*3;
    for(let i=0;i<4;i++){
      const v=CS.voices[i],st=first?0:R()*4.2; // 声ごとに少しずらして入れ替え(4秒以内)
      if(v&&v.midi===notes[i])continue;                // 同じ音は伸ばしたまま
      const nv=padVoice(t+st,notes[i],i,atk);
      if(v)v.release(t+st+atk*.35,rel);                // 新しい声が立ち上がりはじめてから旧い声が引く
      CS.voices[i]=nv}
    const rootPc=(def.iv[0]+CS.key)%12,bm=36+((rootPc-36)%12+12)%12;
    if(!CS.bass||CS.bass.midi!==bm){const nb=bassVoice(t+1.2,bm,atk+1);if(CS.bass)CS.bass.release(t+1.2+atk*.4,rel+2);CS.bass=nb}
    CS.prev=notes;CS.chord={deg,pcs,t,name:def.n};CS.hist.push(deg);if(CS.hist.length>6)CS.hist.shift();CS.nchord++;
    // 24〜50秒ごとに変化(+1/f的な長短)
    const dur=lerp(cur.chordMin,cur.chordMax,clamp(.5+.45*P.dens.v+(R()-.5)*.5,0,1));
    CS.nextChord=t+dur;stat.events.chord++;L(t,'chord',{deg,key:CS.key,notes:notes.slice(),dur:+dur.toFixed(1)});
  }

  /* ---------- スケジューラ ---------- */
  const EV={glass:0,ep:0,spark:0,plop:0,bloop:0,lastGlassMidi:[]};
  const poisson=(rate,min)=>Math.max(min||0,-Math.log(1-R()*.999)/rate);
  const dens=()=>Math.exp(.85*P.dens.v); // 0.43〜2.3倍の範囲でゆらぐ頻度
  function pickGlassMidi(lo,hi,pcsOverride){
    const pcs=pcsOverride||CS.chord.pcs;const c=[];
    for(let m=lo;m<=hi;m++)if(pcs.includes(m%12)&&!EV.lastGlassMidi.includes(m))c.push(m);
    const m=c.length?c[R()*c.length|0]:lo;EV.lastGlassMidi.push(m);if(EV.lastGlassMidi.length>3)EV.lastGlassMidi.shift();return m}
  function schedule(until){
    while(CS.nextChord<until)changeChord(CS.nextChord,false);
    while(EV.glass<until){const t=EV.glass;
      if(t>=t0){const m=pickGlassMidi(67,84);glass(t,m,cur.glassLvl*(.7+R()*.6),R()*1.4-.7);stat.events.glass++;L(t,'glass',{m})}
      EV.glass=t+poisson(cur.glassRate*dens(),7)}
    while(EV.spark<until){const t=EV.spark;
      if(t>=t0){const n=1+(R()*2.4|0);let tt=t;const pent=[0,2,4,7,9].map(x=>(x+CS.key)%12);
        for(let i=0;i<n;i++){glass(tt,pickGlassMidi(79,91,pent),cur.sparkLvl*(.6+R()*.6),R()*1.8-.9);stat.events.spark++;tt+=.35+R()*.9}L(t,'spark',{n})}
      EV.spark=t+poisson(cur.sparkRate*dens(),12)}
    while(EV.ep<until){const t=EV.ep;
      if(t>=t0){ep(t,pickGlassMidi(60,76),cur.epLvl*(.7+R()*.5),R()*1.0-.5);stat.events.ep++;L(t,'ep')}
      EV.ep=t+poisson(cur.epRate*dens(),22)}
    while(EV.plop<until){const t=EV.plop;
      if(t>=t0)plop(t);
      EV.plop=t+poisson(cur.plopRate*Math.exp(.5*P.water.v),12)}
    while(EV.bloop<until){const t=EV.bloop;
      if(t>=t0){drop(t,true);stat.events.bloop++}
      EV.bloop=t+poisson(cur.dropRate*Math.exp(.5*P.tex.v),6)}
  }

  /* ---------- 1/fゆらぎを AudioParam へ(ゆっくりしたターゲット追従) ---------- */
  function setp(param,v,t,tau){param.cancelScheduledValues(t);param.setTargetAtTime(v,t,tau)}
  function ctl(t){
    // モード補間(数値のみ)
    for(const k in target)if(typeof target[k]==='number')cur[k]+=(target[k]-cur[k])*.04;
    const pad=P.pad.step(CTL),cut=P.cut.step(CTL),wat=P.water.step(CTL),tex=P.tex.step(CTL);P.dens.step(CTL);const wide=P.wide.step(CTL);
    const tau=.5;
    setp(N.padOut.gain,mf('pad')*T.pad*cur.padLvl*(1+.09*pad),t,tau);                                       // ① パッド音量の微細な強弱
    const cutoff=Math.exp(lerp(Math.log(cur.padCutLo),Math.log(cur.padCutHi),.5+.5*cut)); // ② フィルター周波数(対数でゆらぐ)
    setp(N.padLP.frequency,cutoff,t,tau);
    setp(N.flowG.gain,.075*(1+.15*wat),t,tau);                                               // ③ 水音の強弱
    setp(N.flowBP.frequency,cur.flowFreq*Math.exp(.2*tex),t,tau);                         //    と質感
    setp(N.babG.gain,.1*cur.babble*(1+.2*wat+.12*tex),t,tau);
    setp(N.washG.gain,.16*cur.wash*(1+.25*Math.max(wat,-.6)),t,tau*2);
    setp(N.airG.gain,.03*(1+.25*tex),t,tau*2);
    setp(N.revWet.gain,cur.rev*.5*(1+.28*wide),t,tau*2);                                   // ⑤ 空間の広がり(残響量)
    setp(N.lp.frequency,cur.lp,t,.5);
    N.pv={pad,cut,wat,tex,dens:P.dens.v,wide,cutoff};
  }

  /* ---------- 公開API ---------- */
  function pump(now){
    if(!running)return;
    while(ctlT<=now){ctl(Math.max(ctlT,now>ctlT+1?now:ctlT));ctlT+=CTL}
    schedule(now+LOOK);reap(now);
  }
  function start(fade,at){
    if(disposed)return;build();
    const now=at!=null?at:ctx.currentTime;
    if(!running){running=true;t0=now+.05;ctlT=now;
      CS.nextChord=Infinity;changeChord(t0,true);CS.nextChord=t0+lerp(cur.chordMin,cur.chordMax,.5);
      EV.glass=t0+7+R()*5;EV.spark=t0+11+R()*6;EV.ep=t0+19+R()*10;EV.plop=t0+9+R()*8;EV.bloop=t0+4+R()*6;
      for(let i=0;i<8;i++)ctl(now+i*.01); // 初期値を先に入れる
      N.out.gain.cancelScheduledValues(now);N.out.gain.setValueAtTime(0,now);
      N.out.gain.setTargetAtTime(volGain(),now,(fade||7)/4);
      if(!manual&&!timer)timer=setInterval(()=>pump(ctx.currentTime),250);
      pump(now)}
    else{N.out.gain.cancelScheduledValues(now);N.out.gain.setTargetAtTime(volGain(),now,(fade||7)/4)}
  }
  function volGain(){return Math.pow(vol,1.6)*6} // 音量60%で約-21 LUFS(第1版と同じ聴感レベル)
  function setVolume(v){vol=clamp(v,0,1);if(built&&running){const t=ctx.currentTime;N.out.gain.cancelScheduledValues(t);N.out.gain.setTargetAtTime(volGain(),t,.08)}}
  function stop(fade){ // フェードアウトしてノードを全部解放
    if(!running)return;const f=fade||4,t=ctx.currentTime;
    N.out.gain.cancelScheduledValues(t);N.out.gain.setTargetAtTime(0,t,f/4);
    running=false;if(timer){clearInterval(timer);timer=null}
    setTimeout(dispose,(f*1000)*1.6+200);
  }
  function dispose(){
    if(disposed||!built)return;if(running)return;
    for(const k of ['flowSrc','babSrc','washSrc','airSrc'])try{N[k].stop()}catch(e){}
    for(const o of (N.lfos||[]).concat([N.babFreqL]))try{o.stop()}catch(e){}
    for(const v of CS.voices)if(v)try{v.o[0].stop();v.o[1].stop();v.o[2].stop()}catch(e){}
    if(CS.bass)try{CS.bass.release(ctx.currentTime,.1)}catch(e){}
    try{N.out.disconnect()}catch(e){}
    built=false;disposed=false;for(const k in N)delete N[k];live.length=0;CS.voices=[null,null,null,null];CS.bass=null;CS.chord=null;
  }
  function setBalance(b){ // {water,pad,glass,drops}: 線形ゲイン(1=標準)。本番UIには出さず、試聴ページだけが使う
    for(const k in b)if(k in T)T[k]=clamp(+b[k]||0,0,4);
    if(!built)return;const t=ctx.currentTime;
    N.water.gain.cancelScheduledValues(t);N.water.gain.setTargetAtTime(cur.waterLvl*mf('water')*T.water,t,.15);
    N.glassBus.gain.cancelScheduledValues(t);N.glassBus.gain.setTargetAtTime(mf('glass')*T.glass,t,.15)}
  function setMode(m){if(MODES[m]){mode=m;target=MODES[m]}}
  return {start,stop,dispose,setVolume,setMode,setBalance,pump,
    get running(){return running},get mode(){return mode},
    get state(){return {chord:CS.chord,key:CS.key,pv:N.pv,cur}},
    stats:()=>stat,log,P,CS,_ctl:ctl,_N:N};
}

root.SpringBGM={create,Pink,mulberry32,MODES,CH};
})(typeof window!=='undefined'?window:globalThis);
