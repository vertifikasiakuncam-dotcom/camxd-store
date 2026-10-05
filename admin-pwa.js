let deferredAdminInstallPrompt=null;
let adminInstallBusy=false;
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
    if(adminInstallBusy) return;
    if(!deferredAdminInstallPrompt){
      alert("Menu instalasi belum tersedia. Buka menu Chrome ⋮ lalu pilih Tambahkan ke layar utama / Instal aplikasi.");
      return;
    }
    adminInstallBusy=true;
    try{
      deferredAdminInstallPrompt.prompt();
      const choice=await deferredAdminInstallPrompt.userChoice;
      if(choice?.outcome==="accepted") showAdminInstallButton(false);
    }catch(err){
      console.warn("Install Admin:",err);
      alert("Instalasi belum bisa dibuka. Coba refresh halaman Admin lalu tekan Install lagi.");
    }finally{
      deferredAdminInstallPrompt=null;
      adminInstallBusy=false;
    }
  });
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("./admin-sw.js").catch(err=>console.warn("Admin PWA:",err));
  }
});