(function(){
  const $=(s)=>document.querySelector(s);
  const esc=(v)=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
  const username=v=>String(v||"").trim().toLowerCase().replace(/[^a-z0-9._-]/g,"").slice(0,30);
  function preview(){
    const n=$("#profileNameInput")?.value.trim()||"Admin CAMXD Store";
    const u=username($("#profileUsernameInput")?.value)||"admin";
    const a=$("#profileAvatarInput")?.value.trim()||"";
    if($("#profilePreviewName"))$("#profilePreviewName").textContent=n;
    if($("#profilePreviewUsername"))$("#profilePreviewUsername").textContent=u;
    const av=$("#profileEditorAvatar"); if(!av)return;
    if(a){av.innerHTML='<img src="'+esc(a)+'" alt="">';av.classList.add("has-image");}
    else{av.textContent=n.trim().split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"A";av.classList.remove("has-image");}
  }
  async function load(){
    const {data:{user}}=await sb.auth.getUser(); if(!user)return;
    const m=user.user_metadata||{};
    if($("#profileNameInput"))$("#profileNameInput").value=m.full_name||m.display_name||m.name||"Admin CAMXD Store";
    if($("#profileUsernameInput"))$("#profileUsernameInput").value=m.username||m.user_name||"admin";
    if($("#profileAvatarInput"))$("#profileAvatarInput").value=m.avatar_url||m.picture||"";
    preview();
  }
  async function save(){
    const n=$("#profileNameInput").value.trim()||"Admin CAMXD Store",u=username($("#profileUsernameInput").value)||"admin",a=$("#profileAvatarInput").value.trim(),e=$("#profileFormError"),b=$("#saveProfileBtn");
    if(a){try{const x=new URL(a);if(!/^https?:$/.test(x.protocol))throw 0}catch{e.textContent="URL foto profil tidak valid.";return}}
    e.textContent="";b.disabled=true;b.textContent="⏳ Menyimpan...";
    try{const r=await sb.auth.updateUser({data:{full_name:n,display_name:n,name:n,username:u,avatar_url:a||null}});if(r.error)throw r.error;await load();$("#profileEditor").hidden=true;if(window.showAdminToast)window.showAdminToast("Profil tersimpan","Profil admin berhasil diperbarui.");}
    catch(x){e.textContent="Gagal menyimpan profil: "+(x?.message||String(x))}
    finally{b.disabled=false;b.textContent="💾 Simpan Profil"}
  }
  function init(){
    $("#editProfileBtn")?.addEventListener("click",()=>{ $("#profileEditor").hidden=false;load();$("#profileEditor").scrollIntoView({behavior:"smooth",block:"center"});});
    $("#closeProfileEditorBtn")?.addEventListener("click",()=>$("#profileEditor").hidden=true);
    $("#profileNameInput")?.addEventListener("input",preview);
    $("#profileUsernameInput")?.addEventListener("input",preview);
    $("#profileAvatarInput")?.addEventListener("input",preview);
    $("#saveProfileBtn")?.addEventListener("click",save);
  }
  init();
})();