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
  async function uploadAvatar(file, userId){
    if(!file) return "";
    if(file.size > 5 * 1024 * 1024) throw new Error("Ukuran foto maksimal 5 MB.");
    const allowed=["image/jpeg","image/png","image/webp"];
    if(!allowed.includes(file.type)) throw new Error("Format foto harus JPG, PNG, atau WebP.");
    const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
    const path=userId+"/avatar-"+Date.now()+"."+ext;
    const {error:uploadError}=await sb.storage.from("avatars").upload(path,file,{upsert:false,contentType:file.type});
    if(uploadError) throw uploadError;
    const {data}=sb.storage.from("avatars").getPublicUrl(path);
    return data.publicUrl;
  }

  async function save(){
    const n=$("#profileNameInput").value.trim()||"Admin CAMXD Store";
    const u=username($("#profileUsernameInput").value)||"admin";
    const a=$("#profileAvatarInput").value.trim();
    const file=$("#profileAvatarFile")?.files?.[0];
    const e=$("#profileFormError"),b=$("#saveProfileBtn");
    e.textContent="";b.disabled=true;b.textContent=file?"⏳ Upload foto...":"⏳ Menyimpan...";
    try{
      const {data:{user},error:userError}=await sb.auth.getUser();
      if(userError||!user) throw userError||new Error("Sesi admin tidak ditemukan.");
      let avatarUrl=a;
      if(file){
        try{
          avatarUrl=await uploadAvatar(file,user.id);
          e.textContent="✅ Foto berhasil di-upload. Menyimpan profil...";
        }catch(uploadErr){
          throw new Error("Upload foto gagal: "+(uploadErr?.message||String(uploadErr)));
        }
      }
      let r;
      try{
        r=await sb.auth.updateUser({data:{full_name:n,display_name:n,name:n,username:u,avatar_url:avatarUrl||null}});
      }catch(authErr){
        throw new Error(file
          ? "Foto berhasil di-upload, tetapi profil gagal disimpan: "+(authErr?.message||String(authErr))
          : "Profil gagal disimpan: "+(authErr?.message||String(authErr)));
      }
      if(r.error){
        throw new Error(file
          ? "Foto berhasil di-upload, tetapi profil gagal disimpan: "+(r.error?.message||String(r.error))
          : "Profil gagal disimpan: "+(r.error?.message||String(r.error)));
      }
      await load();
      if($("#profileAvatarFile"))$("#profileAvatarFile").value="";
      $("#profileEditor").hidden=true;
      if(window.showAdminToast)window.showAdminToast("Profil tersimpan","Profil admin berhasil diperbarui.");
    }catch(x){
      e.textContent="Gagal menyimpan profil: "+(x?.message||String(x));
    }finally{
      b.disabled=false;b.textContent="💾 Simpan Profil";
    }
  }
  function init(){
    $("#editProfileBtn")?.addEventListener("click",()=>{ $("#profileEditor").hidden=false;load();$("#profileEditor").scrollIntoView({behavior:"smooth",block:"center"});});
    $("#closeProfileEditorBtn")?.addEventListener("click",()=>$("#profileEditor").hidden=true);
    $("#profileNameInput")?.addEventListener("input",preview);
    $("#profileUsernameInput")?.addEventListener("input",preview);
    $("#profileAvatarFile")?.addEventListener("change",()=>{
      const file=$("#profileAvatarFile").files?.[0];
      if(file){
        if(file.size > 5*1024*1024){ $("#profileFormError").textContent="Ukuran foto maksimal 5 MB."; return; }
        const reader=new FileReader();
        reader.onload=()=>{ 
          const av=$("#profileEditorAvatar");
          if(av){av.innerHTML='<img src="'+esc(reader.result)+'" alt="">';av.classList.add("has-image");}
        };
        reader.readAsDataURL(file);
      }
    });
    $("#profileAvatarInput")?.addEventListener("input",preview);
    $("#saveProfileBtn")?.addEventListener("click",save);
  }
  init();
})();