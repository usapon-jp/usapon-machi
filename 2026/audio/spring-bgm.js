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
    harpLvl:.034, birdLvl:.0028,
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
  const stat={voices:0,maxVoices:0,created:0,events:{glass:0,ep:0,spark:0,plop:0,bloop:0,chord:0,harp:0,phrase:0,bird:0,scene:0}};
  const live=[]; // {end}
  const T={water:1,pad:1,glass:1,drops:1,harp:1,birds:1}; // 試聴用の層ごとのバランス(線形ゲイン)
  const N={}; // ノード置き場
  const mf=k=>opts.mute&&opts.mute.indexOf(k)>=0?0:1; // 検査用: 層を個別に消す

  /* ゆらぎ(1/f): 用途ごとに独立 */
  const S=Pink(rand,8,10);                 // 数十秒〜十数分で動く1/f: 場面の長さ・ハープの間・鳥の間隔に使う
  const SP=[0,1,2,3].map(()=>Pink(rand,7,10)); // 声ごとのゆっくりした出入り(1/f)
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
    N.slot=[];for(let i=0;i<5;i++){const g=gain(1);g.connect(N.padIn);N.slot.push(g)} // 声ごとの出入り(0〜3=和音の声, 4=低音)
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
    // ハープ(主役の一つ): 倍音を持つ波形1本 + ローパスの減衰で「爪弾いたあとだんだん丸くなる」音にする
    N.harpBus=gain(mf('harp')*T.harp);N.harpBus.connect(N.mix);
    {const s=gain(.6);N.harpBus.connect(s);s.connect(N.revIn);const e=gain(.1);N.harpBus.connect(e);e.connect(N.echoIn)}
    N.birdWave=ctx.createPeriodicWave(new Float32Array(4),new Float32Array([0,1,.35,.12]));
    // 遠景の鳥: 高域をおさえ、ほとんどを残響に送って「遠く」に置く
    N.birdBus=gain(mf('birds')*T.birds);
    {const bl=biq('lowpass',3800,.4),bd=gain(.3),bs=gain(.95);N.birdBus.connect(bl);bl.connect(bd);bd.connect(N.mix);bl.connect(bs);bs.connect(N.revIn)}
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
    o1.connect(g1);o2.connect(g2);g1.connect(g);g2.connect(g);g.connect(p);p.connect(N.slot[slot]);
    g.gain.setValueCurveAtTime(N.curve.map(x=>x*.25),t,atk);
    o1.start(t);o2.start(t);o3.start(t);reg(1e9);const rec=live[live.length-1];
    return {g,o:[o1,o2,o3],nodes:[g,g1,g2,p],rec,midi,atk,t,
      release(tr,rel){try{g.gain.setTargetAtTime(0,tr,rel/4)}catch(e){}
        o1.stop(tr+rel*1.15);o2.stop(tr+rel*1.15);o3.stop(tr+rel*1.15);cleanup(o1,[o1,o2,o3,g1,g2,g3,g,p]);rec.end=tr+rel*1.15}}}
  function bassVoice(t,midi,atk){
    const g=gain(0),o=ctx.createOscillator();o.type='sine';o.frequency.value=hz(midi);o.connect(g);g.connect(N.slot[4]);
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
  /* ハープ1音(加算合成): 参考録音の測定をもとに、基音と2倍音が主で、3倍音以上は急に小さくする(-9/-14/-25/-33/-40dB)。
     高い倍音ほど早く消える(減衰時間は基音の 1 / .75 / .5 / .35 / .25 / .2 倍)。立ち上がり直後に約5dB落ちてから
     ゆっくり響く二段の減衰と、指先が弦に触れる一瞬の低いノイズで「爪弾いた」感じにする。離調ペア(ピアノのうなり)は使わない */
  const HK=[[1,0,1],[2,-9,.75],[3,-14,.5],[4,-25,.35],[5,-33,.25],[6,-40,.2]]; // [倍音, dB, 減衰倍率]
  function harpNote(t,midi,vel,panv){
    if(!mf('harp'))return;
    const f=hz(midi),tau0=clamp(2.2*Math.pow(2,-(midi-60)/20),.9,4.2),peak=cur.harpLvl*vel/1.3;
    const p=pan(panv),nodes=[p];p.connect(N.harpBus);let lastO=null,end=t;
    for(const [k,db,dk] of HK){
      if(f*k>6500)break;
      const a=peak*Math.pow(10,(db+(k>1?(R()-.5)*6:0))/20),tk=tau0*dk,e=t+.5+tk*6;
      const o=ctx.createOscillator(),g=gain(0);o.type='sine';o.frequency.value=f*k;o.detune.value=(R()-.5)*2;
      const bo=k>=3?2.4:k===2?1.4:1;                   // 爪弾いた瞬間は高い倍音が明るく、すぐに丸くなる
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(a*bo,t+.003);
      g.gain.setTargetAtTime(a*.55,t+.003,k>=3?.05:.09); // 立ち上がり直後の「プルッ」とした粒立ち
      g.gain.setTargetAtTime(0,t+.5,tk);              // そのあとの長い余韻
      o.connect(g);g.connect(p);o.start(t);o.stop(e);nodes.push(o,g);if(k===1)lastO=o;if(e>end)end=e} // 一番長く鳴る基音が終わったら後片付け
    const ns=ctx.createBufferSource();ns.buffer=N.bufs[1];const nl=biq('lowpass',Math.min(1500,f*5),.5),ng=gain(0);
    ng.gain.setValueAtTime(0,t);ng.gain.linearRampToValueAtTime(peak*.22,t+.002);ng.gain.setTargetAtTime(0,t+.002,.009);
    ns.connect(nl);nl.connect(ng);ng.connect(p);ns.start(t,R()*8,.1);nodes.push(ns,nl,ng);
    {const n2=ctx.createBufferSource();n2.buffer=N.bufs[1];const nb=biq('bandpass',2600,1),g2=gain(0); // 弦が指からはじける一瞬の高いノイズ
     g2.gain.setValueAtTime(0,t);g2.gain.linearRampToValueAtTime(peak*.1,t+.001);g2.gain.setTargetAtTime(0,t+.001,.004);
     n2.connect(nb);nb.connect(g2);g2.connect(p);n2.start(t,R()*8,.05);nodes.push(n2,nb,g2)}
    cleanup(lastO,nodes);reg(end+.1)}
  /* 遠くの鳥(試験・既定はオフ): 倍音をもつ波形、ゆらぐ音程、80〜120Hzの声帯のざらつき、息のノイズを混ぜ、低めの帯域に収めて残響に送る */
  let birdsOn=!!opts.birds;
  function bird(t){
    if(!mf('birds')||!birdsOn)return 0;
    const fb=2300+R()*1200,lvl=cur.birdLvl,type=R()<.6?0:1,syl=[];let tt=t;
    if(type===0){const n=3+(R()*4|0),rise=R()<.5;for(let k=0;k<n;k++){const d=.04+R()*.03,c=(rise?1:-1)*(k/(n-1)-.5)*.35;syl.push({t:tt,d,f0:fb*(1+c+.08),f1:fb*(1+c-.08),am:80+R()*40,env:Math.sin(Math.PI*(k+.5)/n)});tt+=d+.055+R()*.06}}
    else{const n=2+(R()*2|0);let f=fb*1.05;for(let k=0;k<n;k++){const d=.16+R()*.1;syl.push({t:tt,d,f0:f,f1:f*.92,am:0,env:1-k*.2});f*=.89;tt+=d+.12+R()*.1}}
    const pn=R()*1.6-.8;
    for(const y of syl){
      const o=ctx.createOscillator(),am=ctx.createOscillator(),amg=gain(y.am?.28:0),g=gain(0),ag=gain(.72),p=pan(pn),end=y.t+y.d*2.4,l=lvl*(.5+.5*y.env);
      o.setPeriodicWave(N.birdWave);
      const c=new Float32Array(8);for(let q=0;q<8;q++){const x=q/7;c[q]=(y.f0*Math.pow(y.f1/y.f0,x))*(1+(R()-.5)*.03)}
      o.frequency.setValueCurveAtTime(c,y.t,y.d);am.type='sine';am.frequency.value=y.am||1;
      g.gain.setValueAtTime(0,y.t);g.gain.linearRampToValueAtTime(l,y.t+.006);g.gain.setTargetAtTime(0,y.t+y.d*.5,y.d*.22);
      am.connect(amg);amg.connect(ag.gain);o.connect(ag);ag.connect(g);g.connect(p);p.connect(N.birdBus);
      const ns=ctx.createBufferSource();ns.buffer=N.bufs[1];const nb=biq('bandpass',y.f0*1.1,3),ng=gain(0);
      ng.gain.setValueAtTime(0,y.t);ng.gain.linearRampToValueAtTime(l*.8,y.t+.006);ng.gain.setTargetAtTime(0,y.t+y.d*.5,y.d*.22);
      ns.connect(nb);nb.connect(ng);ng.connect(p);ns.start(y.t,R()*8,y.d*2.4);
      o.start(y.t);am.start(y.t);o.stop(end);am.stop(end);cleanup(o,[o,am,amg,ag,g,p,ns,nb,ng]);reg(end+.1)}
    stat.events.bird++;L(t,'bird',{kind:type,n:syl.length});return tt-t}

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

  /* ---------- 編曲: 場面(水辺 / 和音 / ハープ)が数十秒ごとに入れ替わる ----------
     slots=和音の4声の出入り, bass=低音, bed=水と空気の前に出る度合い, hg=ハープの休みの長さ(秒), hn=1フレーズの音数,
     glass/bird=きらめき・鳥の出やすさ。どの場面でも水音と薄い和音は鳴り続け、無音にはならない */
  const SCN={
    water:{slots:[.42,.32,.05,0],bass:.5,bed:1.6,hg:[30,60],hn:[1,1],glass:0,bird:1.7,dur:[22,42]},
    chord:{slots:[.9,.85,.7,.5],bass:.9,bed:1,hg:[26,55],hn:[3,4],glass:1,bird:1,dur:[28,52]},
    harp: {slots:[.8,.6,.3,0],bass:.7,bed:.95,rest:[.16,.05,.02,0],hg:[6,18],hn:[4,7],glass:.3,bird:.5,dur:[36,70]}
  };
  const NEXT={water:[['chord',.6],['harp',.4]],chord:[['harp',.55],['water',.45]],harp:[['water',.55],['chord',.45]]};
  const SL=[],HW=[],RS=[],DP=[]; // DP: 和音の声が順番にゆっくり引く時間帯
  // // 予約済みの場面 / ハープの鳴っている時間帯 / 声ごとの直前の目標値
  let forced=['harp','water'];
  function sceneAt(t){for(let i=SL.length-1;i>=0;i--)if(SL[i].a<=t)return SL[i];return SL[0]}
  function addScene(a,first){
    let name;
    if(first)name='chord';else if(forced.length)name=forced.shift();
    else{const last=SL[SL.length-1].name,prev2=SL.length>1?SL[SL.length-2].name:'',o=NEXT[last].map(([n,w])=>[n,n===prev2?w*.35:w]); // A→B→A の往復が続かないよう、2つ前の場面は選ばれにくくする
      name=R()*(o[0][1]+o[1][1])<o[0][1]?o[0][0]:o[1][0]}
    const sc=SCN[name];
    let dur=lerp(sc.dur[0],sc.dur[1],clamp(.5+.45*S.v+(R()-.5)*.5,0,1));
    if(first)dur=20;else if(SL.length===1)dur=38; // 試聴用: 最初は 和音20秒 → ハープ約38秒 → 休み
    SL.push({name,a,b:a+dur,sc});if(SL.length>8)SL.shift();stat.events.scene++;L(a,'scene',{name,dur:+dur.toFixed(1)});
    if(name==='harp')EV.harp=Math.min(EV.harp,a+5.5+R()*3);           // 和音が引いてからハープが入る
    else if(name==='chord')EV.harp=Math.min(EV.harp,a+12+R()*10);
    else EV.harp=Math.max(EV.harp,a+10+R()*15)}                        // 水辺: ハープは休む
  /* ハープのフレーズ: 現在の和音の音だけを使い、ゆっくり1音ずつ。ときどき軽いロール。最後の音は少し遅く弱く */
  function harpPhrase(t,nmin,nmax){
    const pcs=CS.chord.pcs,pool=[];for(let m=50;m<=81;m++)if(pcs.indexOf(m%12)>=0)pool.push(m);
    const idx=[];let n=nmin+(R()*(nmax-nmin+1)|0),roll=n>=4&&R()<.2,ioi,tt=t,last=-1;
    if(roll){const base=(R()*pool.length*.35)|0;let q=base;for(let k=0;k<4;k++){idx.push(Math.min(pool.length-1,q));q+=R()<.7?1:2}ioi=.1+R()*.04}
    else{let i=(R()*pool.length*.55)|0,dir=R()<.62?1:-1;if(i>pool.length*.6)dir=-1;
      for(let k=0;k<n;k++){
        for(let g=0;g<4&&last>=0&&(i<0||i>=pool.length||Math.abs(pool[clamp(i,0,pool.length-1)]-pool[last])<3);g++){if(i<0||i>=pool.length){dir=-dir;i=last+dir}else i+=dir} // 半音・全音のぶつかりを避ける
        i=clamp(i,0,pool.length-1);if(i===last)i=clamp(i-dir,0,pool.length-1);
        idx.push(i);last=i;i+=(R()<.78?1:2)*dir;if(R()<.18)dir=-dir;if(i<0){i=1;dir=1}if(i>=pool.length){i=pool.length-2;dir=-1}}
      ioi=.62+R()*.43}
    const N0=idx.length,notes=[];
    for(let k=0;k<N0;k++){const m=pool[idx[k]],vel=clamp(.62+.3*Math.sin(Math.PI*k/(N0-.99))+(R()-.5)*.14,.35,1)*(k===N0-1&&!roll?.8:1);
      harpNote(tt,m,vel,clamp((m-65)/30,-.5,.5)+(R()-.5)*.1);notes.push(m);stat.events.harp++;
      tt+=ioi*(1+(R()-.5)*.06)*(k>=N0-2&&!roll?1.25:1)}
    if(roll){const m=pool[Math.min(pool.length-1,idx[3]+2)];tt+=.7+R()*.3;harpNote(tt,m,.6,(R()-.5)*.4);notes.push(m);stat.events.harp++}
    HW.push({a:t-.5,b:tt+2.2});if(HW.length>6)HW.shift();stat.events.phrase++;L(t,'harp',{notes});return tt}
  const duckAt=t=>{for(const w of HW)if(t>=w.a&&t<w.b)return .74;return 1};

  /* ---------- スケジューラ ---------- */
  const EV={glass:0,ep:0,spark:0,plop:0,bloop:0,harp:0,bird:0,dip:0,lastGlassMidi:[]};
  const poisson=(rate,min)=>Math.max(min||0,-Math.log(1-R()*.999)/rate);
  const dens=()=>Math.exp(.85*P.dens.v); // 0.43〜2.3倍の範囲でゆらぐ頻度
  function pickGlassMidi(lo,hi,pcsOverride){
    const pcs=pcsOverride||CS.chord.pcs;const c=[];
    for(let m=lo;m<=hi;m++)if(pcs.includes(m%12)&&!EV.lastGlassMidi.includes(m))c.push(m);
    const m=c.length?c[R()*c.length|0]:lo;EV.lastGlassMidi.push(m);if(EV.lastGlassMidi.length>3)EV.lastGlassMidi.shift();return m}
  function schedule(until){
    while(CS.nextChord<until)changeChord(CS.nextChord,false);
    while(SL[SL.length-1].b<until)addScene(SL[SL.length-1].b,false);
    while(EV.harp<until){const t=EV.harp,sc=sceneAt(t);let end=t;
      if(t>=t0&&t>=sc.a+(sc.name==='harp'?5.5:3))end=harpPhrase(t,sc.sc.hn[0],sc.sc.hn[1]);
      const sc2=sceneAt(end).sc;EV.harp=end+lerp(sc2.hg[1],sc2.hg[0],clamp(.5+.45*S.v+(R()-.5)*.5,0,1))}
    while(EV.dip<until){const t=EV.dip;               // 「和音」の場面では、4つの声のうち1つが9〜18秒かけて順番に引く
      if(t>=t0&&sceneAt(t).name==='chord'){const d=9+R()*9;DP.push({i:R()*4|0,a:t,b:t+d});if(DP.length>6)DP.shift();L(t,'dip',{d:+d.toFixed(0)})}
      EV.dip=t+8+R()*10}
    while(EV.bird<until){const t=EV.bird,sc=sceneAt(t).sc;
      if(t>=t0&&birdsOn)bird(t);
      EV.bird=t+lerp(110,40,clamp(.5+.45*S.v+(R()-.5)*.5,0,1))/Math.max(.2,sceneAt(t).sc.bird)}
    while(EV.glass<until){const t=EV.glass;
      if(t>=t0&&R()<sceneAt(t).sc.glass){const m=pickGlassMidi(67,84);glass(t,m,cur.glassLvl*(.7+R()*.6),R()*1.4-.7);stat.events.glass++;L(t,'glass',{m})}
      EV.glass=t+poisson(cur.glassRate*dens(),7)}
    while(EV.spark<until){const t=EV.spark;
      if(t>=t0&&R()<sceneAt(t).sc.glass){const n=1+(R()*2.4|0);let tt=t;const pent=[0,2,4,7,9].map(x=>(x+CS.key)%12);
        for(let i=0;i<n;i++){glass(tt,pickGlassMidi(79,91,pent),cur.sparkLvl*(.6+R()*.6),R()*1.8-.9);stat.events.spark++;tt+=.35+R()*.9}L(t,'spark',{n})}
      EV.spark=t+poisson(cur.sparkRate*dens(),12)}
    while(EV.ep<until){const t=EV.ep;
      if(t>=t0&&R()<sceneAt(t).sc.glass){ep(t,pickGlassMidi(60,76),cur.epLvl*(.7+R()*.5),R()*1.0-.5);stat.events.ep++;L(t,'ep')}
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
    const tau=.5,sc=sceneAt(t).sc,sd=S.step(CTL);
    // ハープが休んでいるあいだは、和音の声をさらに引く(ゆっくり消え、ハープが戻るときはもっとゆっくり戻る)
    const rest=sc.rest&&!HW.some(w=>t+1>=w.a&&t<w.b)&&(EV.harp-t)>.5,rf=rest?sc.rest:[1,1,1,1];
    for(let i=0;i<4;i++){const dip=DP.some(w=>w.i===i&&t>=w.a&&t<w.b)?.2:1,v=sc.slots[i]*rf[i]*dip*(1+.3*SP[i].step(CTL)),up=v>(RS[i]||0);RS[i]=v;setp(N.slot[i].gain,v,t,up?5:1.4)}
    setp(N.slot[4].gain,sc.bass*(rest?.4:1),t,3);
    setp(N.padOut.gain,mf('pad')*T.pad*cur.padLvl*(1+.09*pad)*duckAt(t),t,.9);                                       // ① パッド音量の微細な強弱
    const cutoff=Math.exp(lerp(Math.log(cur.padCutLo),Math.log(cur.padCutHi),.5+.5*cut)); // ② フィルター周波数(対数でゆらぐ)
    setp(N.padLP.frequency,cutoff,t,tau);
    const bedK=sc.bed*(rest?1.25:1);
    setp(N.flowG.gain,.075*bedK*(1+.15*wat),t,3);                                               // ③ 水音の強弱
    setp(N.flowBP.frequency,cur.flowFreq*Math.exp(.2*tex),t,tau);                         //    と質感
    setp(N.babG.gain,.1*cur.babble*bedK*(1+.2*wat+.12*tex),t,3);
    setp(N.washG.gain,.16*cur.wash*bedK*(1+.25*Math.max(wat,-.6)),t,3);
    setp(N.airG.gain,.03*bedK*(1+.25*tex),t,3);
    setp(N.revWet.gain,cur.rev*.5*(1+.28*wide),t,tau*2);                                   // ⑤ 空間の広がり(残響量)
    setp(N.lp.frequency,cur.lp,t,.5);
    N.pv={pad,cut,wat,tex,dens:P.dens.v,wide,cutoff,sect:sd};
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
      SL.length=0;HW.length=0;forced=['harp','water'];EV.harp=t0+9999;addScene(t0,true);
      CS.nextChord=Infinity;changeChord(t0,true);CS.nextChord=t0+lerp(cur.chordMin,cur.chordMax,.5);
      EV.glass=t0+7+R()*5;EV.spark=t0+11+R()*6;EV.ep=t0+19+R()*10;EV.plop=t0+9+R()*8;EV.bloop=t0+4+R()*6;EV.bird=t0+22+R()*14;EV.dip=t0+8+R()*6;DP.length=0;
      for(let i=0;i<8;i++)ctl(now+i*.01); // 初期値を先に入れる
      N.out.gain.cancelScheduledValues(now);N.out.gain.setValueAtTime(0,now);
      N.out.gain.setTargetAtTime(volGain(),now,(fade||7)/4);
      if(!manual&&!timer)timer=setInterval(()=>pump(ctx.currentTime),250);
      pump(now)}
    else{N.out.gain.cancelScheduledValues(now);N.out.gain.setTargetAtTime(volGain(),now,(fade||7)/4)}
  }
  function volGain(){return Math.pow(vol,1.6)*7.7} // 音量60%で約-21 LUFS(第1版と同じ聴感レベル)
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
    N.glassBus.gain.cancelScheduledValues(t);N.glassBus.gain.setTargetAtTime(mf('glass')*T.glass,t,.15);
    N.harpBus.gain.cancelScheduledValues(t);N.harpBus.gain.setTargetAtTime(mf('harp')*T.harp,t,.15);
    N.birdBus.gain.cancelScheduledValues(t);N.birdBus.gain.setTargetAtTime(mf('birds')*T.birds,t,.15)}
  function setBirds(on){birdsOn=!!on;if(on&&running)EV.bird=Math.min(EV.bird,ctx.currentTime+12+R()*10)}
  function setMode(m){if(MODES[m]){mode=m;target=MODES[m]}}
  function _note(t,m,v,pn){build();harpNote(t,m,v,pn)} // 検査用: ハープ1音だけ鳴らす
  return {_note,start,stop,dispose,setVolume,setMode,setBalance,setBirds,pump,get birds(){return birdsOn},
    get running(){return running},get mode(){return mode},
    get state(){return {chord:CS.chord,key:CS.key,pv:N.pv,cur,scene:(sceneAt(ctx.currentTime)||{}).name}},
    stats:()=>stat,log,P,CS,_ctl:ctl,_N:N};
}

root.SpringBGM={create,Pink,mulberry32,MODES,CH};
})(typeof window!=='undefined'?window:globalThis);
