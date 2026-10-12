// 以前ここ(usapon-machi/)にあったゲームのサービスワーカーを片付けるためのファイル。
// ゲームは 2026/ と 2025/ に移ったので、古い登録とキャッシュを消して自分も外れる。
self.addEventListener('install',e=>{self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.delete('usapon-machi-v1').then(()=>self.registration.unregister()))});
