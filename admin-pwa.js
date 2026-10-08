let deferredAdminInstallPrompt=null;

function adminIsInstalled(){
  return window.matchMedia("(display-mode: standalone)").matches ||
         window.matchMedia("(display-mode: fullscreen)").matches ||
         window.navigator.standalone === true;
}

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
  const install=document.getElementById("installAdminBtn");

  if(adminIsInstalled()){
    showAdminInstallButton(false);
  }

  install?.addEventListener("click",async()=>{
    if(deferredAdminInstallPrompt){
      deferredAdminInstallPrompt.prompt();
      try{
        await deferredAdminInstallPrompt.userChoice;
      }catch(err){
        console.warn("CAMXD Admin install:",err);
      }
      deferredAdminInstallPrompt=null;
      showAdminInstallButton(false);
      return;
    }

    const message =
      "Instalasi otomatis belum tersedia di browser ini.\n\n" +
      "Android Chrome: tekan ⋮ → Tambahkan ke layar utama / Install app.\n" +
      "Jika pilihan itu belum muncul, buka halaman Admin melalui Chrome dan pastikan halaman sudah selesai dimuat.";
    if(typeof window.showAdminToast==="function"){
      window.showAdminToast("Install Admin",message);
    }else{
      alert(message);
    }
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js",{scope:"./",updateViaCache:"none"})
        .then(reg=>reg.update())
        .catch(err=>console.warn("Admin PWA:",err));
    });
  }
});
