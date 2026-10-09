const CACHE_NAME="camxd-store-v12";
const APP_SHELL=[
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./pwa.js",
  "./supabase-config.js",
  "./camxd-logo.png",
  "./banner-notifikasi-camxd.png",
  "./camxd-background.png",
  "./qris-gopay.jpg",
  "./manifest.webmanifest"
];

self.addEventListener("install",event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});


const PUSH_DIAGNOSTIC_KEY="./__camxd_push_received.json";

self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let data={},raw="";
    try{
      if(event.data){
        raw=event.data.text();
        try{data=JSON.parse(raw);}catch{data={body:raw};}
      }
    }catch{data={body:"Pesanan baru masuk."};}

    try{
      const diagnostic={
        receivedAt:new Date().toISOString(),
        title:data.title||"CAMXD STORE",
        body:data.body||"",
        raw:raw.slice(0,2000)
      };
      const cache=await caches.open(CACHE_NAME);
      await cache.put(PUSH_DIAGNOSTIC_KEY,new Response(JSON.stringify(diagnostic),{
        headers:{"Content-Type":"application/json"}
      }));
    }catch(error){
      console.error("CAMXD push marker:",error);
    }

    const isDiagnostic=String(data.body||"").includes("CX-DIAGNOSTIC");
    const title=isDiagnostic ? "CAMXD STORE • PUSH DIAGNOSTIC" : (data.title||"CAMXD STORE");
    const options={
      body:isDiagnostic ? "Service Worker Android menerima push dari FCM." : (data.body||"Pesanan baru masuk."),
      icon:"./camxd-logo.png",
      badge:"./camxd-logo.png",
      tag:data.tag||("camxd-push-"+Date.now()),
      renotify:true,
      requireInteraction:true,
      silent:false,
      vibrate:[200,100,200],
      timestamp:Date.now(),
      data:{url:data.url||"./admin.html?app=camxd-admin"}
    };
    // Tampilkan banner hanya untuk notifikasi pelanggan, bukan notifikasi Admin.
    if(String(data.url||"").includes("#cek-pesanan")){
      options.image="https://vertifikasiakuncam-dotcom.github.io/camxd-store/banner-notifikasi-camxd.png?v=20261009-2";
    }
    await self.registration.showNotification(title,options);
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(
    event.notification.data?.url||"./admin.html?app=camxd-admin",
    self.location.origin
  ).href;
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

  const isDocument=event.request.mode==="navigate";
  const isAppCode=/\.(html|css|js|webmanifest)$/.test(url.pathname);

  if(isDocument || isAppCode){
    event.respondWith(
      fetch(event.request)
        .then(response=>{
          if(response.ok){
            const copy=response.clone();
            caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
          }
          return response;
        })
        .catch(()=>caches.match(event.request).then(cached=>cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached=>cached || fetch(event.request).then(response=>{
        if(response.ok){
          const copy=response.clone();
          caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));
        }
        return response;
      }))
      .catch(()=>caches.match(event.request))
  );
});
