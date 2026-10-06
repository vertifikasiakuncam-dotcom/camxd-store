let deferredInstallPrompt=null;

function showInstallButton(show){
  const btn=document.getElementById("installApp");
  const sectionBtn=document.getElementById("installAppSection");
  if(btn) btn.hidden=false;
  if(sectionBtn) sectionBtn.disabled=false;
}
async function installStoreApp(){
  if(deferredInstallPrompt){
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    return;
  }
  alert("Untuk memasang CAMXD Store:\n\nAndroid/Chrome: gunakan menu browser lalu pilih 'Instal aplikasi' atau 'Tambahkan ke layar utama'.\n\niPhone/iPad: tekan Bagikan di Safari → Tambahkan ke Layar Utama.");
}

window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  showInstallButton(true);
});

window.addEventListener("appinstalled",()=>{
  deferredInstallPrompt=null;
  showInstallButton(false);
});

document.addEventListener("DOMContentLoaded",()=>{
  const install=document.getElementById("installApp");
  const mobileCart=document.getElementById("mobileCart");

  install?.addEventListener("click",installStoreApp);
  document.getElementById("installAppSection")?.addEventListener("click",installStoreApp);

  mobileCart?.addEventListener("click",()=>{
    document.getElementById("cartBtn")?.click();
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("PWA:",err));
    });
  }
});
