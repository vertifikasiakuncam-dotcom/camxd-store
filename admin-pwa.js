let deferredAdminInstallPrompt=null;
function showAdminInstallButton(show){
  const btn=document.getElementById("installAdminBtn");
  if(btn) btn.hidden=!show;
}
window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredAdminInstallPrompt=event;
  showAdminInstallButton(true);
});
window.addEventListener("appinstalled",()=>{
  deferredAdminInstallPrompt=null;
  showAdminInstallButton(false);
});
document.addEventListener("DOMContentLoaded",()=>{
  const btn=document.getElementById("installAdminBtn");
  btn?.addEventListener("click",async()=>{
    if(!deferredAdminInstallPrompt) return;
    deferredAdminInstallPrompt.prompt();
    await deferredAdminInstallPrompt.userChoice;
    deferredAdminInstallPrompt=null;
    showAdminInstallButton(false);
  });
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./admin-sw.js").catch(err=>console.warn("Admin PWA:",err));
  }
});