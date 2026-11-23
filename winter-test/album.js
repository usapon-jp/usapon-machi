// Photo album (IndexedDB: thumbnails + full images, newest 60, favourites kept), ported from the Halloween 2026 game.
// The winter town has its OWN database name: the test page lives on the same site as the Halloween game,
// so sharing 'usapon-machi-album' would mix the two albums.
const $ = id => document.getElementById(id);
const DB_NAME='usapon-winter-album', MAX=60;
// iPhone / iPad only put a picture into Photos through the share sheet ("画像を保存"); others download it.
const SHARE_SAVE=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

export function createAlbum({toast,openModal,closeModal}) {
  const A={db:null,ok:false,list:[],mem:{}};
  let filter='all',current=null,delArmed=false;
  try{
    const rq=indexedDB.open(DB_NAME,1);
    rq.onupgradeneeded=()=>{const d=rq.result;d.createObjectStore('meta',{keyPath:'id'});d.createObjectStore('full',{keyPath:'id'});};
    rq.onsuccess=()=>{
      A.db=rq.result;A.ok=true;
      try{const r=A.db.transaction('meta').objectStore('meta').getAll();
        r.onsuccess=()=>{A.list=(r.result||[]).concat(A.list).sort((a,b)=>b.ts-a.ts);if($('mAlbumList').classList.contains('on'))render();};}catch(e){}
    };
  }catch(e){}

  const thumb=url=>new Promise(res=>{
    const im=new Image();
    im.onload=()=>{const w=240,h=Math.round(w*im.naturalHeight/im.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',.8));};
    im.onerror=()=>res(null);im.src=url;
  });
  function put(meta,url){
    if(!A.ok){A.mem[meta.id]=url;return;}
    try{const tx=A.db.transaction(['meta','full'],'readwrite');tx.objectStore('meta').put(meta);tx.objectStore('full').put({id:meta.id,url});
      tx.onabort=tx.onerror=()=>{A.mem[meta.id]=url;};}catch(e){A.mem[meta.id]=url;}
  }
  function putMeta(m){if(!A.ok)return;try{A.db.transaction('meta','readwrite').objectStore('meta').put(m);}catch(e){}}
  function remove(id){
    delete A.mem[id];if(!A.ok)return;
    try{const tx=A.db.transaction(['meta','full'],'readwrite');tx.objectStore('meta').delete(id);tx.objectStore('full').delete(id);}catch(e){}
  }
  async function add(url,kind){
    const id=Date.now().toString(36)+Math.random().toString(36).slice(2,6),t=await thumb(url);
    if(!t)return null;
    const meta={id,kind:kind||'free',ts:Date.now(),thumb:t};
    A.list.unshift(meta);put(meta,url);
    while(A.list.length>MAX){ // drop the oldest picture that is not a favourite
      let k=-1;for(let i=A.list.length-1;i>=0;i--)if(!A.list[i].fav){k=i;break;}
      if(k<0)break;remove(A.list.splice(k,1)[0].id);
    }
    return id;
  }
  async function replace(id,url){ // the frame was switched on/off after the shot
    const m=A.list.find(q=>q.id===id);if(!m)return;
    const t=await thumb(url);if(t)m.thumb=t;put(m,url);
  }
  function full(id){
    if(A.mem[id])return Promise.resolve(A.mem[id]);if(!A.ok)return Promise.resolve(null);
    return new Promise(res=>{try{const r=A.db.transaction('full').objectStore('full').get(id);
      r.onsuccess=()=>res(r.result?r.result.url:null);r.onerror=()=>res(null);}catch(e){res(null);}});
  }
  async function save(src){
    try{
      const b=await (await fetch(src)).blob(),f=new File([b],'usapon-winter-'+Date.now()+'.jpg',{type:'image/jpeg'});
      if(SHARE_SAVE&&navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return;}
      const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=f.name;document.body.appendChild(a);a.click();
      toast('「ダウンロード」に ほぞんしたよ');setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
    }catch(e){if(e&&e.name==='AbortError')return;toast('保存できなかったよ\n画像を長押ししてね');}
  }

  function render(){
    $('albumChips').querySelectorAll('.ach').forEach(b=>b.classList.toggle('on',b.dataset.f===filter));
    const vis=A.list.filter(m=>filter==='all'||!!m.fav);
    const grid=$('albumGrid');grid.textContent='';
    for(const m of vis){
      const b=document.createElement('button');b.type='button';b.className='at';b.dataset.id=m.id;
      const im=document.createElement('img');im.alt='';im.src=m.thumb;b.append(im);
      if(m.fav){const i=document.createElement('i');i.textContent='★';b.append(i);}
      grid.append(b);
    }
    $('albumEmpty').hidden=vis.length>0;
  }
  function setFav(on){$('btnAlbumFav').textContent=(on?'★':'☆')+' お気に入り';}
  function setDel(armed){delArmed=armed;const b=$('btnAlbumDel');b.classList.toggle('armed',armed);b.textContent=armed?'ほんとうに？':'ゴミ箱';}
  async function show(id){
    const m=A.list.find(q=>q.id===id);if(!m)return;
    const url=await full(id);if(!url){toast('写真をよみこめなかったよ');return;}
    current=id;setDel(false);setFav(m.fav);
    const d=new Date(m.ts);
    $('albumCap').textContent=(m.kind==='selfie'?'ピヨちゃんの じどり':'ピヨちゃんの 冬さんぽ')+'　'+d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate();
    $('albumImg').src=url;closeModal('mAlbumList');openModal('mAlbum');
  }
  const back=()=>{closeModal('mAlbum');render();openModal('mAlbumList');};
  $('album-button').addEventListener('click',()=>{render();openModal('mAlbumList');});
  $('btnAlbumListClose').addEventListener('click',()=>closeModal('mAlbumList'));
  $('albumChips').addEventListener('click',e=>{const b=e.target.closest('.ach');if(b){filter=b.dataset.f;render();}});
  $('albumGrid').addEventListener('click',e=>{const b=e.target.closest('.at');if(b)show(b.dataset.id);});
  $('btnAlbumClose').addEventListener('click',back);
  $('btnAlbumSave').addEventListener('click',()=>save($('albumImg').src));
  $('btnAlbumFav').addEventListener('click',()=>{const m=A.list.find(q=>q.id===current);if(!m)return;m.fav=!m.fav;putMeta(m);setFav(m.fav);});
  $('btnAlbumDel').addEventListener('click',()=>{
    if(!delArmed){setDel(true);return;}
    const k=A.list.findIndex(q=>q.id===current);if(k>=0)A.list.splice(k,1);
    remove(current);current=null;back();toast('写真をけしたよ');
  });
  return {add,replace,save,count:()=>A.list.length};
}
