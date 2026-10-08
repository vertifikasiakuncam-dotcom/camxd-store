/* CAMXD Admin Web Push — isolated notification module */
(() => {
  const VAPID_PUBLIC_KEY = "BHLHJoF5iZEleTr8wkf7VPwU_yOCvzLHS6xG6Nb9uP6fUfpxG2QCeZVXdl7rsQz9mt8WCMw0dM4pZFXgZOJZEZo";
  const VAPID_KEY_VERSION = "v4";

  function urlBase64ToUint8Array(base64String){
    const padding="=".repeat((4-base64String.length%4)%4);
    const base64=(base64String+padding).replace(/-/g,"+").replace(/_/g,"/");
    const raw=atob(base64);
    return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)));
  }

  async function getRegistration(){
    if(!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
    return navigator.serviceWorker.ready;
  }

  async function subscribeAdminPush(){
    try{
      if(!("Notification" in window) || !("PushManager" in window)) return false;
      const {data:{session}}=await window.sb.auth.getSession();
      if(!session?.user?.id) return false;

      if(Notification.permission==="default"){
        const permission=await Notification.requestPermission();
        if(permission!=="granted") return false;
      }
      if(Notification.permission!=="granted") return false;

      const reg=await getRegistration();
      if(!reg) return false;

      let sub=await reg.pushManager.getSubscription();
      const storedVersion=localStorage.getItem("camxd_admin_push_vapid_version");
      if(sub && storedVersion!==VAPID_KEY_VERSION){
        try{ await sub.unsubscribe(); }catch{}
        sub=null;
      }

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

      const {error}=await window.sb
        .from("admin_push_subscriptions")
        .upsert(payload,{onConflict:"endpoint"});

      if(error){
        console.error("CAMXD push subscription:",error);
        return false;
      }

      localStorage.setItem("camxd_admin_push_enabled","1");
      localStorage.setItem("camxd_admin_push_vapid_version",VAPID_KEY_VERSION);
      return true;
    }catch(error){
      console.error("CAMXD Web Push:",error);
      return false;
    }
  }

  window.subscribeAdminPush=subscribeAdminPush;

  document.addEventListener("DOMContentLoaded",()=>{
    const btn=document.getElementById("enableNotificationsBtn");

    // admin.js disables the button once Android/browser permission is already granted.
    // Therefore, refresh the push subscription automatically when permission is granted.
    if("Notification" in window && Notification.permission==="granted"){
      setTimeout(async()=>{
        const ok=await subscribeAdminPush();
        if(ok && btn){
          btn.textContent="🔔 Notifikasi Aktif";
          btn.disabled=true;
        }
      },800);
    }

    if(!btn) return;
    const original=btn.textContent;
    btn.addEventListener("click",async()=>{
      const ok=await subscribeAdminPush();
      if(ok){
        btn.textContent="🔔 Notifikasi Aktif";
        btn.disabled=true;
      }else if(Notification.permission==="granted"){
        btn.textContent=original;
      }
    },true);
  });
})();