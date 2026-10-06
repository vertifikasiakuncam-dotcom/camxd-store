const CACHE_NAME="camxd-admin-v4";
const APP_SHELL=[
  "./admin.html",
  "./admin.css",
  "./admin.js",
  "./admin-pwa.js",
  "./admin-profile.js",
  "./admin-manifest.webmanifest?v=20261006-2",
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