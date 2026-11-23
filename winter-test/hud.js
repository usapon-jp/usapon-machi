// HUD and touch controls, ported from the Halloween 2026 game (2-stage stick, dash latch, jump, toast, cards, help).
const $ = id => document.getElementById(id);

export function createHud({coarse}) {
  // joy: -1..1 stick; dash: held / latched; jump: one-shot (game.js clears it)
  const input={joy:{x:0,y:0},dash:false,dashLatch:false,dashIdle:0,jump:false,keys:new Set()};
  let toastTimer=0;
  function toast(message,ms=2600){
    const t=$('toast');t.textContent=message;t.classList.add('on');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('on'),ms);
  }
  const anyModal=()=>!!document.querySelector('.modal.on');
  function openModal(id){$(id).classList.add('on');resetStick();}
  function closeModal(id){$(id).classList.remove('on');}

  // Two stages: inside the ring = slow walk (up to half speed), pulled beyond it = normal walk.
  const joy=$('joystick'),knob=$('knob');
  let stick=null,cx=0,cy=0,ring=48;
  function resetStick(){
    stick=null;input.joy.x=input.joy.y=0;knob.style.transform='';joy.classList.remove('act','fast');
    if(input.dashLatch)releaseDash();
  }
  function setStick(x,y){
    let dx=x-cx,dy=y-cy;const m=Math.hypot(dx,dy),out=ring+22;
    if(m>out){dx=dx/m*out;dy=dy/m*out;}
    const mm=Math.min(m,out);
    knob.style.transform=`translate(${dx}px,${dy}px)`;
    joy.classList.toggle('act',m>8);joy.classList.toggle('fast',mm>ring+4);
    const f=mm<=ring?.5*mm/ring:.5+.5*Math.min(1,(mm-ring)/22);
    input.joy.x=mm>0?dx/mm*f:0;input.joy.y=mm>0?-dy/mm*f:0;
  }
  joy.addEventListener('pointerdown',e=>{
    if(stick!==null)return;
    stick=e.pointerId;joy.setPointerCapture(stick);
    const r=joy.getBoundingClientRect();cx=r.left+r.width/2;cy=r.top+r.height/2;ring=r.width/2;
    setStick(e.clientX,e.clientY);
  });
  joy.addEventListener('pointermove',e=>{if(e.pointerId===stick)setStick(e.clientX,e.clientY);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])joy.addEventListener(name,e=>{if(e.pointerId===stick)resetStick();});

  // Dash: one press starts it, another press stops it; it also stops when the stick is let go or idle.
  const dash=$('tbDash'),jump=$('tbJump');
  function releaseDash(){input.dash=input.dashLatch=false;dash.classList.remove('hold');}
  dash.addEventListener('pointerdown',e=>{
    e.preventDefault();
    if(input.dashLatch){releaseDash();return;}
    input.dash=input.dashLatch=true;input.dashIdle=0;dash.classList.add('hold');
  });
  jump.addEventListener('pointerdown',e=>{e.preventDefault();input.jump=true;});
  for(const b of [dash,jump,$('photoBtn'),$('camShut')])b.addEventListener('contextmenu',e=>e.preventDefault());

  // A button pressed with the mouse or a finger lets go of the focus, so Space jumps instead of pressing it again.
  document.addEventListener('click',e=>{const b=e.target.closest?.('button');if(b&&e.detail>0)b.blur();},true);
  // keyboard (movement keys only go to the set; actions are handled by their owners)
  const movement=new Set(['KeyW','KeyS','KeyA','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight']);
  addEventListener('keydown',e=>{
    if(anyModal())return;
    if(e.code==='Space'){if(!(e.target instanceof HTMLButtonElement)){e.preventDefault();if(!e.repeat)input.jump=true;}return;}
    if(!movement.has(e.code)||(e.target instanceof HTMLButtonElement&&e.code.startsWith('Arrow')))return;
    e.preventDefault();input.keys.add(e.code);
  });
  addEventListener('keyup',e=>input.keys.delete(e.code));
  const clear=()=>{input.keys.clear();resetStick();releaseDash();};
  addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});

  // Help card: PC / phone tabs
  const tabs=$('helpTabs');
  const setTab=t=>{
    tabs.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
    document.querySelectorAll('#helpSheet .hp').forEach(p=>p.classList.toggle('on',p.dataset.t===t));
  };
  tabs.addEventListener('click',e=>{const b=e.target.closest('button[data-t]');if(b)setTab(b.dataset.t);});
  setTab(coarse?'sp':'pc');
  $('help-button').addEventListener('click',()=>openModal('mHelp'));
  $('btnHelpClose').addEventListener('click',()=>closeModal('mHelp'));

  // one frame of the stick + keys, camera-relative later in game.js
  function axes(dt){
    const k=input.keys,press=(...c)=>c.some(x=>k.has(x))?1:0;
    let x=press('KeyD','ArrowRight')-press('KeyA','ArrowLeft')+input.joy.x;
    let y=press('KeyW','ArrowUp')-press('KeyS','ArrowDown')+input.joy.y;
    let m=Math.hypot(x,y);if(m>1){x/=m;y/=m;m=1;}
    if(input.dashLatch){input.dashIdle=m>.05?0:input.dashIdle+dt;if(input.dashIdle>1.8)releaseDash();}
    const running=input.dash||k.has('ShiftLeft')||k.has('ShiftRight');
    if(running&&m>.05&&m<1){x/=m;y/=m;m=1;} // dashing: the slow ring also runs at full speed
    return {x,y,m,running};
  }
  return {input,toast,openModal,closeModal,anyModal,axes,resetStick};
}
