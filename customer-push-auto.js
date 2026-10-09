/* CAMXD Store customer push opt-in. Isolated from the stable checkout script. */
(function(){
"use strict";
const VAPID_PUBLIC_KEY="BD5nIoOP11mvsDoTJjTsNIRQkLevxbjlb4zgDdH9Ls_5-ikCWWCKm7Ca_Dp8Sti7Jdli-gJsSWFoCy2ZxLPTAzM";
function b64ToBytes(value){
 const padding="=".repeat((4-value.length%4)%4);
 const raw=atob((value+padding).replace(/-/g,"+").replace(/_/g,"/"));
 return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
function addOptIn(){
 const modal=document.getElementById("paymentModal");
 const idEl=document.getElementById("paymentOrderId");
 const waEl=document.getElementById("cartWa");
 if(!modal||!idEl||!waEl||document.getElementById("customerPushOptIn"))return;
 const wrap=document.createElement("div");
 wrap.id="customerPushOptIn";
 wrap.style.cssText="margin:14px 0;padding:14px;border:1px solid #5a4a00;border-radius:14px;background:#151515;color:#f7f7f7";
 const title=document.createElement("strong");
 title.textContent="🔔 Notifikasi status pesanan";
 title.style.cssText="display:block;margin-bottom:5px";
 const desc=document.createElement("p");
 desc.textContent="Jangan sampai ketinggalan kabar pesananmu! Aktifkan notifikasi agar kamu langsung tahu saat pembayaran diverifikasi, pesanan mulai diproses, hingga selesai. Cukup aktifkan sekali di perangkat ini.";
 desc.style.cssText="font-size:13px;line-height:1.5;color:#c9c9c9;margin:0 0 10px";
 const button=document.createElement("button");
 button.type="button";button.id="customerPushOptInButton";
 button.textContent="Aktifkan Notifikasi Pesanan";
 button.style.cssText="width:100%;padding:12px;border:0;border-radius:10px;background:#ffd000;color:#080808;font-weight:800;cursor:pointer";
 const status=document.createElement("p");
 status.id="customerPushOptInStatus";status.setAttribute("role","status");
 status.style.cssText="font-size:13px;white-space:pre-wrap;margin:9px 0 0;color:#ddd";
 button.addEventListener("click",async()=>{
  button.disabled=true;button.textContent="Mengaktifkan...";
  const orderId=(idEl.textContent||"").trim().toUpperCase();
  const customerWa=(waEl.value||"").trim();
  try{
   if(!orderId||orderId==="-"||!customerWa)throw new Error("ID pesanan atau nomor WhatsApp belum tersedia. Pastikan checkout berhasil.");
   if(!("serviceWorker"in navigator)||!("PushManager"in window)||!("Notification"in window))throw new Error("Browser ini belum mendukung push notification. Coba Chrome Android.");
   if(typeof SUPABASE_URL==="undefined"||typeof SUPABASE_PUBLISHABLE_KEY==="undefined")throw new Error("Konfigurasi server belum termuat.");
   const permission=await Notification.requestPermission();
   if(permission!=="granted")throw new Error("Izin notifikasi belum diberikan. Anda tetap bisa melanjutkan pembayaran.");
   const registration=await navigator.serviceWorker.register("./sw.js");
   await navigator.serviceWorker.ready;
   let subscription=await registration.pushManager.getSubscription();
   if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:b64ToBytes(VAPID_PUBLIC_KEY)});
   const response=await fetch(SUPABASE_URL+"/functions/v1/customer-push-subscribe",{
    method:"POST",
    headers:{"Content-Type":"application/json","apikey":SUPABASE_PUBLISHABLE_KEY},
    body:JSON.stringify({order_id:orderId,customer_wa:customerWa,subscription:subscription.toJSON(),user_agent:navigator.userAgent})
   });
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Pendaftaran gagal (HTTP "+response.status+").");
   status.textContent="✓ Notifikasi otomatis aktif untuk pesanan "+orderId+".";
   status.style.color="#8ee6a6";button.textContent="✓ Notifikasi Aktif";
  }catch(error){
   status.textContent="Belum aktif: "+(error&&error.message?error.message:String(error));
   status.style.color="#ffcf70";button.disabled=false;button.textContent="Coba Aktifkan Lagi";
  }
 });
 wrap.append(title,desc,button,status);
 const proofBox=modal.querySelector(".payment-proof-box");
 if(proofBox&&proofBox.parentNode)proofBox.parentNode.insertBefore(wrap,proofBox);
 else modal.querySelector(".payment-total")?.after(wrap);
}
function init(){
 addOptIn();
 const modal=document.getElementById("paymentModal");
 if(modal)new MutationObserver(addOptIn).observe(modal,{attributes:true,attributeFilter:["hidden","class","style"],childList:true,subtree:false});
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();