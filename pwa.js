let deferredInstallPrompt=null;

function showInstallButton(show){
  const btn=document.getElementById("installApp");
  if(btn) btn.hidden=!show;
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

  install?.addEventListener("click",async()=>{
    if(!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt=null;
    showInstallButton(false);
  });

  mobileCart?.addEventListener("click",()=>{
    document.getElementById("cartBtn")?.click();
  });

  if("serviceWorker" in navigator){
    window.addEventListener("load",()=>{
      navigator.serviceWorker.register("./sw.js").catch(err=>console.warn("PWA:",err));
    });
  }
});
