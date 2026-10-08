const CACHE_NAME="camxd-admin-v9";
const APP_SHELL=[
  "./admin.html",
  "./admin.css",
  "./admin.js",
  "./admin-pwa.js",
  "./admin-push.js?v=20261008-6",
  "./admin-profile.js",
  "./admin-manifest.webmanifest?v=20261006-3",
  "./camxd-admin-icon.svg",
  "./supabase-config.js",
  "./camxd-logo.png"
];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("push",event=>{
  let data={};
  try{ data=event.data ? event.data.json() : {}; }catch{ data={body:event.data?.text()||"Pesanan baru masuk"}; }
  const title=data.title || "CAMXD STORE";
  const options={
    body:data.body || "Pesanan baru masuk.",
    icon:"./camxd-admin-icon.svg",
    badge:"./camxd-admin-icon.svg",
    tag:data.tag || "camxd-order",
    renotify:true,
    requireInteraction:true,
    data:{url:data.url || "./admin.html?app=camxd-admin"}
  };
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(event.notification.data?.url || "./admin.html?app=camxd-admin",self.location.origin).href;
  event.waitUntil(
    clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{
      for(const client of list){
        if("focus" in client) return client.focus();
      }
      return clients.openWindow(target);
    })
  );
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;
  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok)caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
      return response;
    }).catch(()=>caches.match(event.request).then(c=>c||caches.match("./admin.html")))
  );
});