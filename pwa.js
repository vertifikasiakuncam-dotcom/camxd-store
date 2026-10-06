let deferredInstallPrompt=null;

function showInstallButton(show){
  const btn=document.getElementById("installApp");
  const sectionBtn=document.getElementById("installAppSection");
  if(btn) btn.hidden=false;
  if(sectionBtn) sectionBtn.disabled=false;
}

async function installStoreApp(){
  try{
    if(deferredInstallPrompt){
      deferredInstallPrompt.prompt();
      const choice=await deferredInstallPrompt.userChoice;
      deferredInstallPrompt=null;
      if(choice?.outcome==="accepted") showInstallButton(false);
      return;
    }

    const ua=navigator.userAgent||"";
    const isIOS=/iphone|ipad|ipod/i.test(ua);
    if(isIOS){
      alert("Untuk iPhone/iPad:\n\n1. Tekan tombol Bagikan (□↑) di Safari.\n2. Pilih “Tambahkan ke Layar Utama”.\n3. Tekan Tambahkan.");
      return;
    }

    alert("Instalasi otomatis belum tersedia di browser ini.\n\nCoba buka CAMXD Store di Chrome, lalu pilih menu ⋮ → Instal aplikasi / Tambahkan ke layar utama.");
  }catch(error){
    console.warn("Install CAMXD Store:",error);
    alert("Instalasi belum tersedia. Silakan gunakan menu browser → Instal aplikasi / Tambahkan ke layar utama.");
  }
}

window.installStoreApp=installStoreApp;

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
  const sectionInstall=document.getElementById("installAppSection");
  const mobileCart=document.getElementById("mobileCart");

  install?.addEventListener("click",installStoreApp);
  sectionInstall?.addEventListener("click",installStoreApp);

  mobileCart?.addEventListener("click",()=>{
    document.getElementById("cartBtn")?.click();
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js?v=20261006-2")
        .catch(err=>console.warn("PWA:",err));
    });
  }
});
