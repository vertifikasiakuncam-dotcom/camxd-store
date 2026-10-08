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
    return navigator.serviceWorker.ready;
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
      const pushSb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
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

  window.subscribeAdminPush=subscribeAdminPush;

  document.addEventListener("DOMContentLoaded",async()=>{
    const btn=document.getElementById("enableNotificationsBtn");
    if(!btn) return;
    btn.disabled=false;
    const status=await getPushStatus();
    setButtonStatus(btn,status);
    btn.addEventListener("click",async()=>{
      btn.disabled=true;
      btn.textContent="🔄 Mengecek...";
      const statusBefore=await getPushStatus();
      if(statusBefore==="active"){
        setButtonStatus(btn,"active");
        return;
      }
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