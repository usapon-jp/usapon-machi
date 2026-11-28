(() => {
  function create(T,actor,ground,route){
    const canvas=document.createElement('canvas');canvas.width=384;canvas.height=128;
    const ctx=canvas.getContext('2d');
    const texture=new T.CanvasTexture(canvas);
    const sprite=new T.Sprite(new T.SpriteMaterial({map:texture,transparent:true,opacity:0,depthWrite:false}));
    let caption='';
    function paint(text){
      if(caption===text)return;
      caption=text;
      const lines=text.split('\n');
      ctx.clearRect(0,0,384,128);
      ctx.fillStyle='#fff3e5';ctx.strokeStyle='#dcb2a4';ctx.lineWidth=4;
      ctx.beginPath();ctx.roundRect(5,6,374,96,35);ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(173,99);ctx.lineTo(193,120);ctx.lineTo(211,99);ctx.fill();
      ctx.fillStyle='#57323b';ctx.font=lines.length>1?'bold 28px sans-serif':'bold 47px sans-serif';
      ctx.textAlign='center';ctx.textBaseline='middle';
      lines.forEach((line,i)=>ctx.fillText(line,192,55+(i-(lines.length-1)/2)*32,338));
      texture.needsUpdate=true;
    }
    sprite.position.y=1.45;actor.add(sprite);sprite.visible=false;

    let index=1,phase=0,stopTime=0,visibleTime=0,reminder=0,lookout=0,clock=0,idleTime=0;
    let started=false,waitForPlayer=false,pose=null;
    actor.position.set(route[0][0],ground(...route[0]),route[0][1]);
    function speak(text,duration){
      paint(text);visibleTime=duration;captionDuration=duration;phase=.05;
    }
    let captionDuration=2.4;
    function update(dt,player,enabled){
      if(!enabled){sprite.visible=false;return;}
      clock+=dt;
      const p=actor.position, dx=player.x-p.x,dz=player.z-p.z,distance=Math.hypot(dx,dz);
      if(distance>5.4)waitForPlayer=true;
      if(distance<3.5)waitForPlayer=false;
      const target=route[index];
      const moving=started&&!!target&&!waitForPlayer&&lookout<=0;
      let heading=Math.atan2(dx,dz);
      if(moving){
        const x=target[0]-p.x,z=target[1]-p.z,length=Math.hypot(x,z);
        const step=Math.min(length,dt*2.7);
        if(length>.001){p.x+=x*step/length;p.z+=z*step/length;heading=Math.atan2(x,z);}
        if(length-step<.002){index++;if(!route[index])lookout=0;}
        phase=(phase+dt*1.7)%1;
        stopTime=0;visibleTime=0;
      }else{
        if(!started&&distance<5){
          idleTime+=dt;
          if(idleTime>=2.1){phase=.05;idleTime=0;}
        }
        if(started){
          lookout=Math.max(0,lookout-dt);
          stopTime+=dt;reminder=Math.max(0,reminder-dt);
          if(stopTime>=2.2&&reminder===0&&distance>1.9&&distance<19&&visibleTime===0){speak('こっちだよ',2.4);reminder=6.5;}
        }
        if(phase>0){phase+=dt*2.5;if(phase>=1)phase=0;}
        visibleTime=Math.max(0,visibleTime-dt);
      }
      p.y=ground(p.x,p.z)+(pose?0:Math.sin(phase*Math.PI)*.18);
      if(pose)pose(phase);
      if(moving||distance>.15){
        const turn=heading-actor.rotation.y;
        actor.rotation.y+=Math.atan2(Math.sin(turn),Math.cos(turn))*(1-Math.exp(-dt*10));
      }
      const opacity=Math.max(0,Math.min(1,visibleTime*4,(captionDuration-visibleTime)*5));
      sprite.visible=opacity>0;sprite.material.opacity=opacity;
      sprite.position.y=1.45+Math.sin(clock*4)*.035;
      sprite.scale.set(1.74,.58,1).multiplyScalar(.78+.22*opacity);
    }
    return {
      update,
      greet(){if(!started)speak('こっちこっち！',2);},
      greetClose(){visibleTime=0;phase=.05;},
      start(line){
        if(started)return;
        started=true;lookout=line?3:.25;reminder=lookout;
        if(line)speak(line,lookout);
      },
      usePose(fn){pose=fn;}
    };
  }
  function encounter(T,camera,actor,title,lines){
    const box=document.createElement('section');
    box.className='santa-meeting';box.hidden=true;
    box.setAttribute('aria-label',title);
    const speaker=document.createElement('strong');speaker.textContent=title;
    const text=document.createElement('p');text.setAttribute('aria-live','polite');
    const button=document.createElement('button');button.type='button';
    box.append(speaker,text,button);document.body.append(box);
    const original=new T.Vector3(),target=new T.Vector3(),close=new T.Vector3(),originalView=new T.Quaternion();
    let active=false,index=0,elapsed=0,heading=0,done=null;
    function show(){
      text.textContent=lines[index];
      button.textContent=index===lines.length-1?'ついていく':'つぎへ';
    }
    button.onclick=()=>{
      if(++index<lines.length){show();return;}
      active=false;box.hidden=true;document.body.classList.remove('santa-meeting-open');done();
    };
    return {
      active:()=>active,
      begin(player,onDone){
        if(active)return;
        active=true;index=0;elapsed=0;done=onDone;
        original.copy(camera.position);originalView.copy(camera.quaternion);
        heading=Math.atan2(player.x-actor.position.x,player.z-actor.position.z);
        document.body.classList.add('santa-meeting-open');show();box.hidden=false;button.focus();
      },
      frame(dt){
        if(!active)return;
        elapsed+=dt;
        const blend=Math.min(1,elapsed/.66);
        const ease=blend*blend*(3-2*blend);
        const position=actor.position;
        const distance=camera.aspect<.8?2.6:2.15;
        close.set(position.x+Math.sin(heading+.22)*distance,position.y+1.03,position.z+Math.cos(heading+.22)*distance);
        target.set(position.x,position.y+.62,position.z);
        camera.position.lerpVectors(original,close,ease);
        camera.lookAt(target);camera.quaternion.slerp(originalView,1-ease);
        camera.updateMatrixWorld();
      }
    };
  }
  window.SantaGuide={create,encounter};
})();
