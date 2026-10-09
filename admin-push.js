/* CAMXD Admin Web Push — isolated notification module */
(() => {
  const VAPID_PUBLIC_KEY = "BD5nIoOP11mvsDoTJjTsNIRQkLevxbjlb4zgDdH9Ls_5-ikCWWCKm7Ca_Dp8Sti7Jdli-gJsSWFoCy2ZxLPTAzM";

  function urlBase64ToUint8Array(base64String){
    const padding="=".repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  async function getRegistration(){
    if(!("serviceWorker" in navigator) || !("PushManager" in window)) return null;

    // Admin push must use admin-sw.js. The store's sw.js is a different worker.
    const reg=await navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"});
    await reg.update();

    if(reg.active) return reg;

    await new Promise(resolve=>{
      const worker=reg.installing || reg.waiting;
      if(!worker){
        resolve();
        return;
      }
      worker.addEventListener("statechange",()=>{
        if(worker.state==="activated" || worker.state==="redundant") resolve();
      });
    });

    return reg.active ? reg : navigator.serviceWorker.ready;
  }

  async function getPushStatus(){
    try{
      if(!("Notification" in window) || !("PushManager" in window)) return "unsupported";
      if(Notification.permission==="denied") return "denied";
      const reg=await getRegistration();
      if(!reg) return "unsupported";
      const sub=await reg.pushManager.getSubscription();
      return sub ? "active" : "not_subscribed";
    }catch(error){
      console.error("CAMXD push status:",error);
      return "error";
    }
  }

  function setButtonStatus(btn,status){
    if(!btn) return;
    if(status==="active"){
      btn.textContent="🔔 Notifikasi Aktif";
    }else if(status==="denied"){
      btn.textContent="🔕 Notifikasi Diblokir";
    }else if(status==="not_subscribed"){
      btn.textContent="🔔 Aktifkan Push";
    }else if(status==="unsupported"){
      btn.textContent="⚠️ Push Tidak Didukung";
    }else{
      btn.textContent="⚠️ Push Belum Siap";
    }
    btn.disabled=false;
  }

  async function subscribeAdminPush(){
    try{
      if(!("Notification" in window) || !("PushManager" in window)) return false;
      if(!window.supabase || typeof window.supabase.createClient!=="function") return false;
      const pushSb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
        auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
      });
      const {data:{session}}=await pushSb.auth.getSession();
      if(!session?.user?.id) return false;

      if(Notification.permission==="default"){
        const permission=await Notification.requestPermission();
        if(permission!=="granted") return false;
      }
      if(Notification.permission!=="granted") return false;

      const reg=await getRegistration();
      if(!reg) return false;

      let sub=await reg.pushManager.getSubscription();
      if(!sub){
        sub=await reg.pushManager.subscribe({
          userVisibleOnly:true,
          applicationServerKey:urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }

      const json=sub.toJSON();
      const payload={
        user_id:session.user.id,
        endpoint:json.endpoint,
        subscription:{
          endpoint:json.endpoint,
          expirationTime:json.expirationTime ?? null,
          keys:json.keys || {}
        },
        user_agent:navigator.userAgent
      };

      const {error}=await pushSb.from("admin_push_subscriptions").upsert(payload,{onConflict:"endpoint"});
      if(error){
        console.error("CAMXD push subscription:",error);
        return false;
      }

      localStorage.setItem("camxd_admin_push_enabled","1");
      return true;
    }catch(error){
      console.error("CAMXD Web Push:",error);
      return false;
    }
  }

  let nativeFcmToken=localStorage.getItem("camxd_admin_fcm_token")||"";
  let nativeRegistrationClient=null;
  async function registerNativeFcmToken(token){
    if(!token) return false;
    nativeFcmToken=token;
    localStorage.setItem("camxd_admin_fcm_token",token);
    try{
      if(!window.supabase || typeof window.supabase.createClient!=="function") return false;
      if(!nativeRegistrationClient){
        // Reuse the dashboard's actual Supabase client. A second client has a separate
        // auth event lifecycle and may miss the login button's session change.
        nativeRegistrationClient=window.camxdAdminSupabase || window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
          auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
        });
        nativeRegistrationClient.auth.onAuthStateChange((_event,session)=>{
          if(session?.access_token && nativeFcmToken) sendNativeFcmRegistration(nativeFcmToken,session.access_token);
        });
      }
      const {data:{session}}=await nativeRegistrationClient.auth.getSession();
      if(!session?.access_token) {
        // The dashboard may finish loading before the login page stores its session.
        return false;
      }
      return await sendNativeFcmRegistration(token,session.access_token);
    }catch(error){
      console.error("CAMXD native FCM registration:",error);
      return false;
    }
  }
  async function sendNativeFcmRegistration(token,accessToken){
    const response=await fetch(SUPABASE_URL+"/functions/v1/admin-fcm-register",{
      method:"POST",
      headers:{"Authorization":"Bearer "+accessToken,"apikey":SUPABASE_PUBLISHABLE_KEY,"Content-Type":"application/json"},
      body:JSON.stringify({token,user_agent:"CAMXD Admin Android"})
    });
    if(!response.ok){console.error("CAMXD native FCM registration failed:",response.status,await response.text());return false;}
    localStorage.setItem("camxd_admin_fcm_registered","1");
    console.log("CAMXD native FCM token registered");
    return true;
  }
  window.onCamxdAdminFcmToken=registerNativeFcmToken;
  if(nativeFcmToken) registerNativeFcmToken(nativeFcmToken);

  // Retry after the dashboard finishes login/session restoration.
  window.addEventListener("pageshow",()=>{
    const token=localStorage.getItem("camxd_admin_fcm_token");
    if(token) registerNativeFcmToken(token);
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible"){
      const token=localStorage.getItem("camxd_admin_fcm_token");
      if(token) registerNativeFcmToken(token);
    }
  });

  window.subscribeAdminPush=subscribeAdminPush;

  document.addEventListener("DOMContentLoaded",async()=>{
    const btn=document.getElementById("enableNotificationsBtn");
    if(!btn) return;

    btn.disabled=false;
    const status=await getPushStatus();

    if(status==="active"){
      btn.textContent="🔄 Sinkronisasi Push...";
      const synced=await subscribeAdminPush();
      setButtonStatus(btn,synced ? "active" : "active");
      if(!synced) btn.title="Subscription Android belum tersinkron ke server";
    }else{
      setButtonStatus(btn,status);
    }

    if(new URLSearchParams(location.search).get("push-test-server")==="1"){
      try{
        const testSb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{
          auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}
        });
        const {data:{session}}=await testSb.auth.getSession();
        if(session?.access_token){
          const response=await fetch(SUPABASE_URL+"/functions/v1/send-admin-push-test",{
            method:"POST",
            headers:{
              "Authorization":"Bearer "+session.access_token,
              "Content-Type":"application/json"
            },
            body:"{}"
          });
          const result=await response.json().catch(()=>({}));
          console.log("CAMXD server push test:",response.status,result);
        }
      }catch(error){
        console.error("CAMXD server push test:",error);
      }
    }

    if(new URLSearchParams(location.search).get("push-test")==="1"){
      try{
        const reg=await getRegistration();
        if(reg && Notification.permission==="granted"){
          await reg.showNotification("CAMXD STORE",{
            body:"Tes notifikasi berhasil diterima oleh Service Worker Android.",
            tag:"camxd-local-push-test",
            renotify:true,
            requireInteraction:true,
            data:{url:"./admin.html?app=camxd-admin"}
          });
        }
      }catch(error){
        console.error("CAMXD local push test:",error);
      }
    }

    btn.addEventListener("click",async()=>{
      btn.disabled=true;
      btn.textContent="🔄 Sinkronisasi...";
      const ok=await subscribeAdminPush();
      if(ok){
        setButtonStatus(btn,"active");
      }else{
        const after=await getPushStatus();
        setButtonStatus(btn,after);
      }
    },true);
  });
})();