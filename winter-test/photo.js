// Camera mode, selfie, shutter and the photo card, ported from the Halloween 2026 game.
const $ = id => document.getElementById(id);
const store={get:k=>{try{return localStorage.getItem(k);}catch(e){return null;}},set:(k,v)=>{try{localStorage.setItem(k,v);}catch(e){}}};
// winter keys: the Halloween game on the same site keeps its own
const K_TOUR='usapon-winter-camtour', K_FRAME='usapon-winter-photo-frame', K_GUIDE='usapon-winter-photo-guide';

export function createPhoto({renderer,scene,camera,rig,hud,album,coarse,resize,beforeLeave}) {
  const {toast,openModal,closeModal}=hud;
  let fx=null,last=null;
  const ui={};
  const note=$('photoNote'),frameToggle=$('btnFrameTog');
  const savedMessage='「アルバム」に 保存しました';
  const failedMessage='アルバムに保存できませんでした。写真を端末に保存できます。';
  function setCamMode(on){
    if(on===rig.camMode)return;
    if(on)beforeLeave?.();
    rig.setCamMode(on);
    document.body.classList.toggle('cammode',on);document.body.classList.toggle('selfie',false);
    $('camTag').textContent='カメラモード';hud.resetStick();
    fx?.camOn(on);resize();
    if(on){
      if(store.get(K_TOUR)!=='1')setTimeout(()=>{if(rig.camMode)showTour();},350);
      else if(!coarse)toast('カメラモード',1400);
    }
  }
  function setSelfie(on){
    rig.setSelfie(on);document.body.classList.toggle('selfie',on);
    $('camTag').textContent=on?'じどりモード':'カメラモード';hud.resetStick();resize();
  }
  const frameOn=()=>store.get(K_FRAME)==='1';
  function frame(src,IW,IH,selfie){
    const OW=IW+120,OH=IH+260,out=document.createElement('canvas');out.width=OW;out.height=OH;
    const g=out.getContext('2d');
    g.fillStyle='#fbf3e6';g.fillRect(0,0,OW,OH);
    g.drawImage(src,0,0,src.width,src.height,60,60,IW,IH);
    g.strokeStyle='rgba(60,36,52,.25)';g.lineWidth=3;g.strokeRect(60,60,IW,IH);
    g.textAlign='center';g.textBaseline='alphabetic';
    g.fillStyle='#4a3340';g.font='800 54px "Hiragino Maru Gothic ProN","Zen Maru Gothic",sans-serif';g.fillText('うさぽん村 城下町',OW/2,IH+150);
    const d=new Date();
    g.fillStyle='#8a4b55';g.font='700 32px "Hiragino Maru Gothic ProN","Zen Maru Gothic",sans-serif';
    g.fillText((selfie?'ピヨちゃんの じどり　':'ピヨちゃんの 冬さんぽ　')+d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate(),OW/2,IH+204);
    for(const x of [110,OW-110]){ // holly: two leaves and three berries
      const y=IH+132;g.fillStyle='#4d7a55';
      for(const s of [-1,1]){g.save();g.translate(x+s*16,y);g.rotate(s*.5);g.beginPath();g.ellipse(0,0,22,10,0,0,Math.PI*2);g.fill();g.restore();}
      g.fillStyle='#c2353d';for(const [bx,by] of [[-7,-4],[7,-4],[0,7]]){g.beginPath();g.arc(x+bx,y+by,8,0,Math.PI*2);g.fill();}
    }
    return out.toDataURL('image/jpeg',.92);
  }
  function shoot(){
    if(!rig.camMode)return;
    if(fx&&fx.beforePhoto())return; // the effect gets set up first and calls shoot() again at its best moment
    const LS=innerWidth>innerHeight*1.15,IW=LS?1440:1080,IH=LS?1080:1440;
    const SS=!coarse&&renderer.capabilities.maxTextureSize>=4096?1.5:1,PW=IW*SS|0,PH=IH*SS|0;
    let url=null,shot=null;
    try{
      renderer.setPixelRatio(1);renderer.setSize(PW,PH,false);camera.aspect=PW/PH;camera.updateProjectionMatrix();
      renderer.render(scene,camera);
      shot=document.createElement('canvas');shot.width=IW;shot.height=IH;
      shot.getContext('2d').drawImage(renderer.domElement,0,0,PW,PH,0,0,IW,IH);
      const framed=frameOn();
      url=framed?frame(shot,IW,IH,rig.selfie):shot.toDataURL('image/jpeg',.92);
      last={shot,IW,IH,selfie:rig.selfie,framed,id:null};
    }catch(e){console.error(e);}
    resize();
    if(!url){toast('写真をとれませんでした\nもう一度ためしてね');return;}
    const capture=last;
    note.textContent='アルバムに保存中…';
    capture.id=album.add(url,rig.selfie?'selfie':'free');
    capture.id.then(id=>{if(last===capture)note.textContent=id?savedMessage:failedMessage;});
    $('photoImg').src=url;frameToggle.hidden=false;frameToggle.disabled=false;
    frameToggle.textContent=capture.framed?'わくを はずす':'わくを つける';
    const first=store.get(K_GUIDE)!=='1';store.set(K_GUIDE,'1');note.classList.toggle('first',first);
    const fl=$('flash');fl.classList.add('on');requestAnimationFrame(()=>requestAnimationFrame(()=>fl.classList.remove('on')));
    openModal('mPhoto');
  }
  frameToggle.addEventListener('click',async()=>{
    const capture=last;
    if(!capture)return;
    capture.framed=!capture.framed;store.set(K_FRAME,capture.framed?'1':'0');
    const url=capture.framed?frame(capture.shot,capture.IW,capture.IH,capture.selfie):capture.shot.toDataURL('image/jpeg',.92);
    $('photoImg').src=url;frameToggle.textContent=capture.framed?'わくを はずす':'わくを つける';
    frameToggle.disabled=true;
    const id=await capture.id;
    if(last===capture&&id)note.textContent='アルバムに保存中…';
    const saved=id&&await album.replace(id,url);
    if(last===capture){
      note.textContent=saved?savedMessage:failedMessage;
      frameToggle.disabled=false;
    }
  });
  $('btnSave').addEventListener('click',()=>album.save($('photoImg').src));
  $('btnRetake').addEventListener('click',()=>closeModal('mPhoto'));
  $('btnCamEnd').addEventListener('click',()=>{closeModal('mPhoto');setCamMode(false);});
  $('photoBtn').addEventListener('click',()=>{if(!hud.anyModal())setCamMode(true);});
  $('camShut').addEventListener('click',()=>{if(!hud.anyModal())shoot();});
  $('camFlip').addEventListener('click',()=>{if(rig.camMode)setSelfie(!rig.selfie);});
  $('camBack').addEventListener('click',()=>setCamMode(false));
  $('camHelp').addEventListener('click',()=>{if(rig.camMode)showTour();});
  $('camTour').addEventListener('click',hideTour);
  $('btnTourReplay').addEventListener('click',()=>{closeModal('mHelp');setCamMode(true);setTimeout(showTour,200);});
  addEventListener('keydown',e=>{
    if(e.code==='Escape'){
      const open=document.querySelector('.modal.on');
      if(open){open.classList.remove('on');return;}
      if($('camTour').classList.contains('on')){hideTour();return;}
      if(rig.camMode)setCamMode(false);
      return;
    }
    if(hud.anyModal()||e.repeat)return;
    if(e.code==='KeyP'){if(rig.camMode)shoot();else setCamMode(true);}
    if(e.code==='KeyV'&&rig.camMode)setSelfie(!rig.selfie);
  });

  // first-time guide over the camera buttons (holes cut out of a dark sheet, a label next to each)
  function showTour(){
    const t=$('camTour'),W=innerWidth,H=innerHeight;let holes='',rings='',labs='';
    const items=[['camShut','しゃしんを とる','up'],['camFlip','じどり ⇔ ふつう\nきりかえ','up-r'],['camFx','エフェクト','down-r'],['camBack','カメラモードを\nおわる','down'],['joystick','あるく','up-l'],['camHelp','この せつめい','down-r']];
    for(const [id,text,where] of items){
      const el=$(id);if(!el)continue;const r=el.getBoundingClientRect();if(r.width<4||r.height<4)continue;
      const x=r.left-6,y=r.top-6,w=r.width+12,h=r.height+12,rx=Math.min(w,h)/2;
      holes+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="#000"/>`;
      rings+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="none" stroke="#fff" stroke-width="2.5"/>`;
      let st;
      if(where==='up')st=`left:${r.left+r.width/2}px;bottom:${H-r.top+16}px;transform:translateX(-50%)`;
      else if(where==='up-r')st=`right:${Math.max(8,W-r.right)}px;bottom:${H-r.top+16}px`;
      else if(where==='up-l')st=`left:${Math.max(8,r.left)}px;bottom:${H-r.top+16}px`;
      else if(where==='down')st=`left:${Math.max(8,r.left)}px;top:${r.bottom+16}px`;
      else st=`right:${Math.max(8,W-r.right)}px;top:${r.bottom+16}px`;
      labs+=`<div class="ctl" style="${st}">${text}</div>`;
    }
    t.innerHTML=`<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><mask id="ctm"><rect width="${W}" height="${H}" fill="#fff"/>${holes}</mask></defs>`+
      `<rect width="${W}" height="${H}" fill="rgba(30,16,36,.74)" mask="url(#ctm)"/>${rings}</svg>${labs}`+
      `<div class="ctl mid" style="top:${H*.36}px">ドラッグで むきをかえる\n2本指・ホイールで ズーム</div><div class="ctl mid" style="top:${H*.5}px">タップでとじる</div>`;
    t.classList.add('on');
    // push overlapping labels apart, keep them on screen
    const els=[...t.querySelectorAll('.ctl:not(.mid)')],hit=(a,b)=>!(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top);
    els.forEach((el,i)=>{for(let k=0;k<12;k++){const r=el.getBoundingClientRect(),o=els.slice(0,i).find(q=>hit(r,q.getBoundingClientRect()));if(!o)break;
      const up=el.style.bottom!=='',orr=o.getBoundingClientRect(),d=up?(r.bottom-orr.top+8):(orr.bottom-r.top+8);
      if(up)el.style.bottom=(parseFloat(el.style.bottom)+d)+'px';else el.style.top=(parseFloat(el.style.top)+d)+'px';}});
    els.forEach(el=>{const r=el.getBoundingClientRect(),dx=r.right>W-8?-(r.right-W+8):(r.left<8?8-r.left:0);if(!dx)return;
      if(el.style.right!=='')el.style.right=(parseFloat(el.style.right)-dx)+'px';else el.style.left=(parseFloat(el.style.left)+dx)+'px';});
  }
  function hideTour(){$('camTour').classList.remove('on');store.set(K_TOUR,'1');}

  ui.setFx=f=>{fx=f;};
  return {setCamMode,setSelfie,shoot,setFx:ui.setFx,showTour,inspect:()=>({camMode:rig.camMode,selfie:rig.selfie,albumCount:album.count()})};
}
