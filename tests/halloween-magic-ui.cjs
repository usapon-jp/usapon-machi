const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
let browser;
(async()=>{
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--ignore-gpu-blocklist']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{let factory;Object.defineProperty(window,'createHalloweenMagic',{get:()=>factory,set:fn=>{factory=d=>{window.testMagicDeps=d;return fn(d)}}});localStorage.setItem('usapon-magic-guide-v1','1');localStorage.setItem('usapon-camtour','1');localStorage.setItem('usapon-land-tip','1');localStorage.setItem('usapon-quick-seen','1')});
 await page.goto('http://127.0.0.1:4186/2026/?magic-preview=1');await page.waitForFunction(()=>window.__usapon);await page.click('#btnStart');
 await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__usapon.magic.inspect().wandVisible),false);
 await page.screenshot({path:'/tmp/magic-ui-idle.png'});
 await page.click('#magicToggle');await page.waitForTimeout(300);await page.click('#magicToggle');await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>__usapon.magic.inspect().wandVisible),false);await page.click('#magicToggle');await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>__usapon.magic.inspect().wandVisible),true);assert.equal(await page.locator('#magicBar').count(),0);assert.equal(await page.locator('#magicPick').count(),0);
 await page.screenshot({path:'/tmp/magic-ui-equipped.png'});await page.click('#magicFire');await page.waitForTimeout(180);await page.screenshot({path:'/tmp/magic-ui-cast.png'});
 // Locate an actual visible prop by raycasting the rendered view, then use a real tap.
 let tapped=false;
 for(const pos of [[0,30,0],[2,12,0],[-2,-19,0],[12,28,0],[-23,13,0]]){
  await page.evaluate(p=>__usapon.tpTo(...p),pos);await page.waitForTimeout(450);
  const target=await page.evaluate(()=>{const d=testMagicDeps,rc=new d.THREE.Raycaster();for(const e of d.ED.list){if(!__usapon.magic.props().includes(e))continue;const q=d.edPos(e);if(Math.hypot(q.x-d.player.pos.x,q.z-d.player.pos.z)>8)continue;const v=new d.THREE.Vector3(q.x,q.y+.5,q.z).project(d.camera);if(v.z>1||Math.abs(v.x)>.8||Math.abs(v.y)>.7)continue;rc.setFromCamera(new d.THREE.Vector2(v.x,v.y),d.camera);const h=rc.intersectObjects(d.scene.children,true).find(h=>{let visible=true;for(let o=h.object;o;o=o.parent)if(!o.visible)visible=false;return visible&&!h.object.isSprite&&!h.object.isPoints});if(h&&(e.objs.some(o=>{let p=h.object;while(p){if(p===o)return true;p=p.parent}return false})||e.inst.some(([ib,i])=>ib.im===h.object&&i===h.instanceId))){window.testProp=e;return {x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2}}}return null});
  if(target){await page.touchscreen.tap(target.x,target.y);await page.waitForTimeout(150);tapped=await page.evaluate(()=>!!__usapon.magic.inspect().held);if(tapped)break}
 }
 assert(tapped,'real prop tap must select');await page.screenshot({path:'/tmp/magic-ui-carry.png'});
 const before=await page.evaluate(()=>__usapon.magic.inspect().held);const cdp=await page.context().newCDPSession(page);const joy=await page.locator('#joy').boundingBox();const jx=joy.x+joy.width/2,jy=joy.y+joy.height/2;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:jx,y:jy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:jx,y:jy+35}]});await page.waitForTimeout(350);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const after=await page.evaluate(()=>__usapon.magic.inspect().held);assert(Math.hypot(before.x-after.x,before.z-after.z)>.01);await page.click('#magicCancel');
 // A drag out and back must not count as a tap.
 const canvas=page.locator('#c');await page.mouse.move(180,380);await page.mouse.down();await page.mouse.move(240,380);await page.mouse.move(180,380);await page.mouse.up();assert.equal(await page.evaluate(()=>__usapon.magic.inspect().held),null);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:150,y:350},{x:220,y:350}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:130,y:350},{x:240,y:350}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await page.evaluate(()=>__usapon.magic.inspect().held),null);
 // Ensure all magic buttons avoid existing movement / equipment buttons, also when rewards are visible.
 for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
  await page.setViewportSize(size);await page.evaluate(()=>{document.getElementById('broomBtn').hidden=false;document.getElementById('candyBtn').hidden=false});await page.waitForTimeout(600);
  const overlap=await page.evaluate(()=>{const magic=[...document.querySelectorAll('.magic-button')].filter(e=>!e.hidden);const others=['photoBtn','broomBtn','candyBtn','tbJump','tbDash','joy'].map(id=>document.getElementById(id)).filter(e=>e&&e.getBoundingClientRect().width);const hits=[];for(const a of magic){const r=a.getBoundingClientRect();if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)hits.push(a.id+' outside');for(const b of [...magic,...others]){if(a===b)continue;const s=b.getBoundingClientRect();if(r.left<s.right&&r.right>s.left&&r.top<s.bottom&&r.bottom>s.top)hits.push(a.id+' '+b.id)}}return hits});assert.deepEqual(overlap,[],JSON.stringify(size));
 }
 await page.setViewportSize({width:390,height:844});await page.click('#photoBtn');await page.waitForTimeout(350);assert(await page.locator('#magicToggle').isHidden());assert(await page.locator('#magicSpark').isHidden());await page.screenshot({path:'/tmp/magic-ui-camera.png'});await page.click('#camShut');await page.waitForFunction(()=>document.getElementById('photoImg').naturalHeight===1920);assert.equal(await page.locator('#photoImg').evaluate(e=>e.naturalWidth),1080);
 await page.click('#btnRetake');await page.waitForTimeout(300);await page.click('#camShut');await page.waitForFunction(()=>document.getElementById('mPhoto').classList.contains('on'));assert.equal(await page.locator('#photoImg').evaluate(e=>e.naturalHeight),1920);
 const src=await page.locator('#photoImg').getAttribute('src');fs.writeFileSync('/tmp/magic-ui-story.jpg',Buffer.from(src.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log('PASS equip/unequip, real prop tap, walk carry, drag rejection, 390/320 portrait + landscape overlap, camera integration, 1080x1920, no runtime errors');await browser.close();
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
