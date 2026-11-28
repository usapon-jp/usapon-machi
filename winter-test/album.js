// Photo album (IndexedDB: thumbnails + full images, newest 60, favourites kept), ported from the Halloween 2026 game.
const $ = id => document.getElementById(id);
const MAX=60;
// iPhone / iPad only put a picture into Photos through the share sheet ("画像を保存"); others download it.
const SHARE_SAVE=/iP(hone|ad|od)/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

export function createAlbum({toast,openModal,closeModal}) {
  const A={list:[]};
  const album=window.SeasonAlbumStore.create();
  let filter='all',current=null,delArmed=false;
  const ready=album.list().then(loaded=>{
    A.list=window.SeasonAlbumStore.merge(loaded,A.list);
    if($('mAlbumList').classList.contains('on'))render();
  });

  const thumb=url=>new Promise(res=>{
    const im=new Image();
    im.onload=()=>{const w=240,h=Math.round(w*im.naturalHeight/im.naturalWidth),c=document.createElement('canvas');c.width=w;c.height=h;
      c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',.8));};
    im.onerror=()=>res(null);im.src=url;
  });
  async function add(url,kind){
    await ready;
    const id='christmas:'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),t=await thumb(url);
    if(!t)return null;
    const meta={id,season:'christmas',kind:kind||'free',ts:Date.now(),thumb:t};
    A.list.unshift(meta);await album.put(meta,url);
    while(A.list.filter(m=>m.season==='christmas').length>MAX){ // drop the oldest picture that is not a favourite
      let k=-1;for(let i=A.list.length-1;i>=0;i--)if(A.list[i].season==='christmas'&&!A.list[i].fav){k=i;break;}
      if(k<0)break;album.remove(A.list.splice(k,1)[0].id);
    }
    return id;
  }
  async function replace(id,url){ // the frame was switched on/off after the shot
    const m=A.list.find(q=>q.id===id);if(!m)return;
    const t=await thumb(url);if(t)m.thumb=t;album.put(m,url);
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
    $('albumChips').querySelectorAll('.ach').forEach(b=>{
      const selected=b.dataset.f===filter;
      b.classList.toggle('on',selected);b.setAttribute('aria-pressed',String(selected));
    });
    const vis=A.list.filter(m=>filter==='all'||(filter==='fav'?!!m.fav:m.season===filter));
    const grid=$('albumGrid');grid.textContent='';
    for(const m of vis){
      const b=document.createElement('button');b.type='button';b.className='at';b.dataset.id=m.id;
      const im=document.createElement('img');im.alt=m.season==='halloween'?'ハロウィンの写真':'クリスマスの写真';im.src=m.thumb;b.append(im);
      if(m.fav){const i=document.createElement('i');i.textContent='★';b.append(i);}
      grid.append(b);
    }
    $('albumEmpty').hidden=vis.length>0;
  }
  function setFav(on){$('btnAlbumFav').textContent=(on?'★':'☆')+' お気に入り';}
  function setDel(armed){delArmed=armed;const b=$('btnAlbumDel');b.classList.toggle('armed',armed);b.textContent=armed?'ほんとうに？':'ゴミ箱';}
  async function show(id){
    const m=A.list.find(q=>q.id===id);if(!m)return;
    const url=await album.full(id);if(!url){toast('写真をよみこめなかったよ');return;}
    current=id;setDel(false);setFav(m.fav);
    const d=new Date(m.ts);
    $('albumCap').textContent=(m.season==='halloween'?'ハロウィン':'クリスマス')+(m.kind==='selfie'?'の じどり':'の 写真')+'　'+d.getFullYear()+'.'+(d.getMonth()+1)+'.'+d.getDate();
    $('albumImg').src=url;closeModal('mAlbumList');openModal('mAlbum');
  }
  const back=()=>{closeModal('mAlbum');render();openModal('mAlbumList');};
  $('album-button').addEventListener('click',()=>{render();openModal('mAlbumList');});
  $('btnAlbumListClose').addEventListener('click',()=>closeModal('mAlbumList'));
  for(const [value,label] of window.SeasonAlbumStore.tabs){
    const button=document.createElement('button');button.type='button';button.className='ach';
    button.dataset.f=value;button.textContent=label;$('albumChips').append(button);
  }
  $('albumChips').addEventListener('click',e=>{const b=e.target.closest('.ach');if(b){filter=b.dataset.f;render();}});
  $('albumGrid').addEventListener('click',e=>{const b=e.target.closest('.at');if(b)show(b.dataset.id);});
  $('btnAlbumClose').addEventListener('click',back);
  $('btnAlbumSave').addEventListener('click',()=>save($('albumImg').src));
  $('btnAlbumFav').addEventListener('click',()=>{const m=A.list.find(q=>q.id===current);if(!m)return;m.fav=!m.fav;album.put(m);setFav(m.fav);});
  $('btnAlbumDel').addEventListener('click',()=>{
    if(!delArmed){setDel(true);return;}
    const k=A.list.findIndex(q=>q.id===current);if(k>=0)A.list.splice(k,1);
    album.remove(current);current=null;back();toast('写真をけしたよ');
  });
  return {add,replace,save,count:()=>A.list.length};
}
