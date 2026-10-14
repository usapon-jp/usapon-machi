// うさぽん街: シンプルなサービスワーカー(ネット優先、つながらない時は前回のデータで起動)
const CACHE='usapon-machi-2026-v1',CACHE_PREFIX='usapon-machi-2026-';
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET'||new URL(r.url).origin!==location.origin)return;
  if(new URL(r.url).pathname.indexOf('/audio/spring/')>=0)return; // 曲(大きな音声・Range要求)はブラウザに直接任せる
  e.respondWith(fetch(r).then(res=>{
    if(res&&res.ok){const c=res.clone();caches.open(CACHE).then(ch=>ch.put(r,c)).catch(()=>{})}
    return res;
  }).catch(()=>caches.match(r).then(m=>m||caches.match('./'))));
});
