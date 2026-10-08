/* CAMXD Admin Web Push — isolated notification module */
(() => {
  const VAPID_PUBLIC_KEY = "BA4Q9VnF37bfRl0fJtqPST1J6nALWVDV-ituIRgMwFkUgYBya_kBFgFLBlBPzSUyi2B4z9qGF62MpPvm27jEL58";

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

      let permission=Notification.permission;
      if(permission==="default") permission=await Notification.requestPermission();
      if(permission!=="granted") return false;

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

      const {error}=await window.sb
        .from("admin_push_subscriptions")
        .upsert(payload,{onConflict:"endpoint"});

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

  window.subscribeAdminPush=subscribeAdminPush;

  document.addEventListener("DOMContentLoaded",()=>{
    const btn=document.getElementById("enableNotificationsBtn");
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