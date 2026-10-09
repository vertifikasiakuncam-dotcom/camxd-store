const CACHE_NAME="camxd-admin-v23";
const PUSH_DIAGNOSTIC_KEY="./__camxd_push_received.json";
const APP_SHELL=[
  "./admin.html",
  "./admin.css",
  "./admin.js",
  "./admin-pwa.js",
  "./admin-push.js?v=20261009-16",
  "./admin-profile.js",
  "./admin-manifest.webmanifest?v=20261006-3",
  "./camxd-admin-icon.svg",
  "./supabase-config.js",
  "./camxd-logo.png"
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
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("push",event=>{
  event.waitUntil((async()=>{
    let data={};
    let raw="";

    try{
      if(event.data){
        raw=event.data.text();
        try{
          data=JSON.parse(raw);
        }catch{
          data={body:raw};
        }
      }
    }catch{
      data={body:"Pesanan baru masuk."};
    }

    // Diagnostic marker: proves that the Android Service Worker received
    // the server push, even if the notification UI is unavailable.
    try{
      const diagnostic={
        receivedAt:new Date().toISOString(),
        title:data.title || "CAMXD STORE",
        body:data.body || "",
        raw:raw.slice(0,2000)
      };
      const cache=await caches.open(CACHE_NAME);
      await cache.put(
        PUSH_DIAGNOSTIC_KEY,
        new Response(JSON.stringify(diagnostic),{
          headers:{"Content-Type":"application/json"}
        })
      );
    }catch(error){
      console.error("CAMXD push diagnostic marker:",error);
    }

    const isDiagnostic=String(data.body||"").includes("CX-DIAGNOSTIC");
    const title=isDiagnostic ? "CAMXD STORE • PUSH DIAGNOSTIC" : (data.title || "CAMXD STORE");

    const options={
      body:isDiagnostic
        ? "Service Worker Android menerima push dari FCM."
        : (data.body || "Pesanan baru masuk."),
      tag:data.tag || ("camxd-push-"+Date.now()),
      renotify:true,
      requireInteraction:true,
      silent:false,
      vibrate:[200,100,200],
      timestamp:Date.now(),
      data:{url:data.url || "./admin.html?app=camxd-admin"}
    };

    try{
      await self.registration.showNotification(title,options);
    }catch(error){
      console.error("CAMXD showNotification failed:",error);
      throw error;
    }
  })());
});

self.addEventListener("notificationclick",event=>{
  event.notification.close();
  const target=new URL(
    event.notification.data?.url || "./admin.html?app=camxd-admin",
    self.registration.scope
  );
  event.waitUntil((async()=>{
    const list=await clients.matchAll({type:"window",includeUncontrolled:true});
    const isAdminTarget=target.pathname.endsWith("/admin.html");
    const sameApp=list.find(client=>{
      try{
        const current=new URL(client.url);
        if(current.origin!==target.origin) return false;
        return isAdminTarget
          ? current.pathname.endsWith("/admin.html")
          : !current.pathname.endsWith("/admin.html");
      }catch{return false;}
    });
    if(sameApp && "navigate" in sameApp){
      const navigated=await sameApp.navigate(target.href);
      if(navigated && "focus" in navigated) return navigated.focus();
      if("focus" in sameApp) return sameApp.focus();
    }
    return clients.openWindow(target.href);
  })());
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET") return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin) return;

  event.respondWith(
    fetch(event.request).then(response=>{
      if(response.ok){
        caches.open(CACHE_NAME).then(cache=>cache.put(event.request,response.clone()));
      }
      return response;
    }).catch(()=>caches.match(event.request).then(c=>c||caches.match("./admin.html")))
  );
});
