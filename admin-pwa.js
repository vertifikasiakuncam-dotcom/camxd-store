(function(){
  let installBusy=false;

  function getPrompt(){
    return window.__camxdAdminInstallPrompt || null;
  }

  function showButton(show){
    const btn=document.getElementById("installAdminBtn");
    if(btn) btn.hidden=!show;
  }

  window.addEventListener("beforeinstallprompt",function(event){
    event.preventDefault();
    window.__camxdAdminInstallPrompt=event;
    showButton(true);
  });

  window.addEventListener("appinstalled",function(){
    window.__camxdAdminInstallPrompt=null;
    showButton(false);
  });

  document.addEventListener("DOMContentLoaded",function(){
    const btn=document.getElementById("installAdminBtn");

    btn?.addEventListener("click",async function(){
      if(installBusy) return;

      const promptEvent=getPrompt();

      if(!promptEvent){
        alert("Chrome belum menyediakan dialog instalasi untuk halaman ini. Coba refresh halaman Admin sekali, tunggu beberapa detik, lalu tekan Install Admin lagi.");
        return;
      }

      installBusy=true;

      try{
        promptEvent.prompt();
        const choice=await promptEvent.userChoice;

        if(choice && choice.outcome==="accepted"){
          showButton(false);
          window.__camxdAdminInstallPrompt=null;
        }
      }catch(error){
        console.warn("CAMXD Admin install:",error);
        alert("Dialog instalasi gagal dibuka. Refresh halaman Admin sekali, lalu coba lagi.");
      }finally{
        installBusy=false;
      }
    });

    if("serviceWorker" in navigator){
      navigator.serviceWorker.register("./admin-sw.js",{scope:"./"})
        .then(function(registration){
          console.log("CAMXD Admin SW aktif:",registration.scope);
          registration.update();
        })
        .catch(function(error){
          console.warn("CAMXD Admin SW:",error);
        });
    }
  });
})();