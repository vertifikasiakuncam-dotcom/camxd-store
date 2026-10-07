// Always open CAMXD Store at the dashboard top unless a specific section/hash was requested.
try{history.scrollRestoration="manual";}catch(e){}
function resetStoreScroll(){
  if(window.location.hash)return;
  const top=()=>window.scrollTo({top:0,left:0,behavior:"auto"});
  top();
  requestAnimationFrame(top);
  setTimeout(top,0);
  setTimeout(top,100);
  setTimeout(top,300);
  setTimeout(top,700);
}
window.addEventListener("pageshow",resetStoreScroll,{passive:true});
window.addEventListener("load",resetStoreScroll,{passive:true});
document.addEventListener("DOMContentLoaded",resetStoreScroll,{passive:true});

const STORE_WA="6282133942994";
let storeWebMusic=null;
let storeWebMusicStarted=false;
let storeWebMusicMuted=false;

function initStoreWebMusic(){
  try{
    try{storeWebMusicMuted=localStorage.getItem("camxdMusicMuted")==="1";}catch(e){storeWebMusicMuted=false;}
    if(window.CAMXDMusic&&typeof window.CAMXDMusic.setMuted==="function") return;

    storeWebMusic=new Audio("camxd-store-music.mp3?v=20261007-4");
    storeWebMusic.loop=true;
    storeWebMusic.preload="auto";
    storeWebMusic.volume=0.25;

    // Start silently when possible. This lets the first real tap unmute
    // the already-playing audio instead of requiring a second tap.
    const startSilent=()=>{
      if(!storeWebMusic||storeWebMusicStarted)return;
      try{
        storeWebMusic.muted=true;
        const p=storeWebMusic.play();
        if(p&&typeof p.then==="function"){
          p.then(()=>{storeWebMusicStarted=true;}).catch(()=>{});
        }else{
          storeWebMusicStarted=true;
        }
      }catch(e){}
    };

    const enableSound=()=>{
      if(!storeWebMusic||storeWebMusicMuted)return;
      try{
        if(!storeWebMusicStarted){
          storeWebMusic.muted=true;
          const p=storeWebMusic.play();
          if(p&&typeof p.then==="function"){
            p.then(()=>{
              storeWebMusicStarted=true;
              storeWebMusic.muted=false;
              storeWebMusic.volume=0.25;
            }).catch(()=>{});
          }else{
            storeWebMusicStarted=true;
            storeWebMusic.muted=false;
          }
        }else{
          storeWebMusic.muted=false;
          storeWebMusic.volume=0.25;
          const p=storeWebMusic.play();
          if(p&&typeof p.catch==="function")p.catch(()=>{});
        }
      }catch(e){}
    };

    if(storeWebMusicMuted){
      storeWebMusic.muted=true;
    }else{
      startSilent();
    }

    // One real pointer gesture is enough to unmute/play.
    // Keep this listener isolated from normal link/click handling so audio
    // cannot interfere with anchor navigation or page scrolling.
    const unlock=()=>{
      if(!storeWebMusicMuted)enableSound();
    };
    document.addEventListener("pointerup",unlock,{passive:true});

    window.addEventListener("pageshow",()=>{
      if(!storeWebMusicMuted)startSilent();
    },{passive:true});

    document.addEventListener("visibilitychange",()=>{
      if(document.visibilityState==="visible"&&!storeWebMusicMuted){
        startSilent();
      }
    });

    storeWebMusic.addEventListener("canplay",()=>{
      if(!storeWebMusicMuted)startSilent();
    });
  }catch(error){
    console.warn("Musik website tidak tersedia:",error);
  }
}
function setStoreWebMusicMuted(muted){
  storeWebMusicMuted=!!muted;
  try{localStorage.setItem("camxdMusicMuted",storeWebMusicMuted?"1":"0");}catch(e){}
  if(!storeWebMusic)return;
  try{
    storeWebMusic.muted=storeWebMusicMuted;
    storeWebMusic.volume=storeWebMusicMuted?0:0.25;
    if(!storeWebMusicMuted){
      const p=storeWebMusic.play();
      if(p&&typeof p.catch==="function")p.catch(()=>{});
      storeWebMusicStarted=true;
    }
  }catch(e){}
}

function hasNativeStoreMusic(){
  return !!(window.CAMXDMusic&&typeof window.CAMXDMusic.setMuted==="function");
}

function syncMusicButton(){
  const btn=$("#musicBtn");
  if(!btn)return;
  const muted=hasNativeStoreMusic()?false:storeWebMusicMuted;
  btn.dataset.muted=muted?"1":"0";
  btn.textContent=muted?"🔇":"🔊";
  btn.setAttribute("aria-label",muted?"Nyalakan musik":"Matikan musik");
  btn.title=muted?"Nyalakan musik":"Matikan musik";
}
let sb=null;
try{
  if(window.supabase && typeof SUPABASE_URL!=="undefined" && typeof SUPABASE_PUBLISHABLE_KEY!=="undefined"){
    sb=window.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY);
  }
}catch(error){
  console.warn("Supabase tidak tersedia, menggunakan katalog lokal:",error);
}

let products=[];
let activeSort="default";
let productSalesStats={};

const FALLBACK_PRODUCTS=[
 {id:"ktv",name:"KTV Premium",desc:"Akses KTV Premium",category:"premium",image:"ktv-premium.jpg",badge:"BEST SELLER",plans:[["1 Bulan",65000],["3 Bulan",95000],["6 Bulan",150000],["1 Tahun",200000]],detail:"Akses KTV Premium dengan pilihan durasi fleksibel. Setelah pembayaran diverifikasi, pesanan diproses oleh admin."},
 {id:"youtube",name:"YouTube Premium",desc:"YouTube Premium",category:"premium",image:"youtube-premium.jpg",badge:"POPULER",plans:[["1 Bulan",15000],["3 Bulan",40000],["6 Bulan",70000],["1 Tahun",120000]],detail:"Nikmati YouTube Premium sesuai paket yang kamu pilih. Detail akun/paket dikonfirmasi melalui WhatsApp."},
 {id:"netflix",name:"Netflix Sharing",desc:"Netflix sharing",category:"premium",image:"netflix-sharing.jpg",badge:"POPULER",plans:[["1 Bulan",33000],["3 Bulan",90000],["6 Bulan",165000],["1 Tahun",300000]],detail:"Paket Netflix sharing dengan durasi pilihan. Silakan cek ketentuan akun dengan admin sebelum proses."},
 {id:"capcut",name:"CapCut Pro",desc:"CapCut Premium",category:"premium",image:"capcut-pro.jpg",badge:"POPULER",plans:[["1 Bulan",35000],["3 Bulan",90000],["6 Bulan",160000],["1 Tahun",300000]],detail:"Paket CapCut Pro untuk kebutuhan editing. Pilih durasi lalu lanjutkan ke keranjang."},
 {id:"canva",name:"Canva Premium",desc:"Canva Premium",category:"premium",image:"canva-premium.jpg",badge:"POPULER",plans:[["1 Bulan",30000],["3 Bulan",75000],["6 Bulan",140000],["1 Tahun",250000]],detail:"Canva Premium untuk kebutuhan desain. Paket dan proses akan dikonfirmasi oleh admin."},
 {id:"spotify",name:"Spotify Premium",desc:"Spotify Premium",category:"premium",image:"spotify-premium.jpg",badge:"POPULER",plans:[["1 Bulan",25000],["3 Bulan",65000],["6 Bulan",120000],["1 Tahun",220000]],detail:"Spotify Premium dengan pilihan durasi. Pilih paket yang sesuai kebutuhanmu."},
 {id:"topup",name:"Top Up All Games",desc:"Top up game & kebutuhan digital",category:"topup",image:"top-up-all-games.jpg",badge:"CEPAT",plans:[["Top Up",0]],detail:"Top up game dan kebutuhan digital. Nominal mengikuti kebutuhan pembeli dan dikonfirmasi melalui WhatsApp."},
 {id:"payment",name:"Pembayaran Digital",desc:"Pulsa, tagihan & pembayaran",category:"topup",image:"pembayaran-digital.jpg",badge:"MUDAH",plans:[["Pembayaran",0]],detail:"Bantuan pembayaran digital, pulsa, tagihan, dan kebutuhan lainnya. Nominal disesuaikan dengan pesanan."},
 {id:"certificate",name:"Jasa Pembuatan Sertifikat",desc:"Jasa pembuatan sertifikat",category:"jasa",image:"jasa-sertifikat.jpg",badge:"JASA",plans:[["1 Sertifikat",20000],["1 Sertifikat + Laminating",25000]],detail:"Jasa pembuatan sertifikat. Laminating tersedia sebagai pilihan tambahan sesuai paket."}
];

products=FALLBACK_PRODUCTS;

async function loadProducts(){
  const featuredBox=$("#featuredProducts");

  if(!sb) return;

  try{
    const queryPromise=Promise.all([
      sb.from("products")
        .select("id,product_key,name,description,category,image_url,badge,detail,sort_order,voucher_code,voucher_discount_type,voucher_discount_value,voucher_valid_from,voucher_valid_until,voucher_usage_limit,voucher_usage_count,voucher_active")
        .eq("is_active",true)
        .order("sort_order",{ascending:true}),
      sb.from("product_plans")
        .select("product_id,plan_name,price,sort_order")
        .eq("is_active",true)
        .order("sort_order",{ascending:true})
    ]);

    const timeoutPromise=new Promise((_,reject)=>
      setTimeout(()=>reject(new Error("Supabase timeout")),7000)
    );

    const [productResult,planResult]=await Promise.race([queryPromise,timeoutPromise]);

    if(productResult.error) throw productResult.error;
    if(planResult.error) throw planResult.error;

    const plansByProduct={};
    (planResult.data||[]).forEach(row=>{
      if(!plansByProduct[row.product_id]) plansByProduct[row.product_id]=[];
      plansByProduct[row.product_id].push([row.plan_name,Number(row.price||0)]);
    });

    const remoteProducts=(productResult.data||[]).map(p=>({
      id:p.product_key,
      dbId:p.id,
      name:p.name,
      desc:p.description,
      category:p.category,
      image:p.image_url,
      badge:p.badge,
      plans:plansByProduct[p.id]||[],
      detail:p.detail,voucher_code:p.voucher_code,voucher_discount_type:p.voucher_discount_type,voucher_discount_value:p.voucher_discount_value,voucher_valid_from:p.voucher_valid_from,voucher_valid_until:p.voucher_valid_until,voucher_usage_limit:p.voucher_usage_limit,voucher_usage_count:p.voucher_usage_count,voucher_active:p.voucher_active
    })).filter(p=>p.plans.length);

    // Ganti katalog lokal hanya jika database benar-benar mengembalikan data.
    if(remoteProducts.length){
      products=remoteProducts;
      render();
      renderFeaturedProducts();
      renderSavedProducts();
      renderRecentProducts();
      loadProductFeatureMeta();
    }
  }catch(error){
    console.warn("Katalog Supabase gagal dimuat, memakai katalog lokal:",error);
  }finally{
  }
}


async function loadProductFeatureMeta(){
  if(!sb||!products.length)return;
  try{
    const [metaResult,salesResult]=await Promise.all([
      sb.from("products").select("product_key,stock_quantity,voucher_code,transaction_proof_url,voucher_discount_type,voucher_discount_value,voucher_valid_from,voucher_valid_until,voucher_usage_limit,voucher_usage_count,voucher_active"),
      sb.rpc("get_product_sales_stats")
    ]);
    if(!metaResult.error){
      const metaByKey={};
      (metaResult.data||[]).forEach(row=>{metaByKey[String(row.product_key)]=row;});
      products.forEach(p=>{
        const meta=metaByKey[String(p.id)];
        if(meta){
          p.stock_quantity=meta.stock_quantity==null?null:Number(meta.stock_quantity);
          p.voucher_code=String(meta.voucher_code||"").trim();
          p.transaction_proof_url=String(meta.transaction_proof_url||"").trim();p.voucher_discount_type=String(meta.voucher_discount_type||"percent");p.voucher_discount_value=Number(meta.voucher_discount_value||0);p.voucher_valid_from=meta.voucher_valid_from||null;p.voucher_valid_until=meta.voucher_valid_until||null;p.voucher_usage_limit=meta.voucher_usage_limit==null?null:Number(meta.voucher_usage_limit);p.voucher_usage_count=Number(meta.voucher_usage_count||0);p.voucher_active=meta.voucher_active!==false;
        }
      });
    }
    if(!salesResult.error){
      productSalesStats={};
      (salesResult.data||[]).forEach(row=>{productSalesStats[String(row.product_key)]=Number(row.sold_count||0);});
      products.forEach(p=>{p.sold_count=Number(productSalesStats[String(p.id)]||0);});
    }
    render();
    renderFeaturedProducts();
  }catch(error){
    console.warn("Fitur stok/voucher/bukti produk belum tersedia:",error);
  }
}

function productStockLabel(p){
  if(p.stock_quantity==null)return "Stok belum diatur";
  const n=Math.max(0,Number(p.stock_quantity)||0);
  return n===0?"Stok habis":"Stok "+n;
}

function productVoucherHtml(p){
  const code=String(p.voucher_code||"").trim();
  return code ? '<span class="product-feature voucher">🎟️ Voucher: <b>'+escapeHtml(code)+'</b></span>' : "";
}

function productMetaHtml(p){
  return '<div class="product-features">'
    + '<span class="product-feature sold">🛍️ Terjual '+Number(p.sold_count||0)+'</span>'
    + '<span class="product-feature stock">📦 '+escapeHtml(productStockLabel(p))+'</span>'
    + productVoucherHtml(p)
    + '</div>';
}
function escapeHtml(value){
  return String(value ?? "").replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
  }[ch]));
}

function renderFeaturedProducts(){
 const box=$("#featuredProducts");
 if(!box) return;
 const list=products.filter(p=>p.plans&&p.plans.length).slice(0,3);
 if(!list.length){box.innerHTML='<div class="featured-loading">Belum ada produk unggulan.</div>';return;}
 box.innerHTML=list.map(p=>{
   const price=p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan";
   return `<article class="featured-card">
     <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
     <div class="featured-card-body">
       <span class="featured-card-badge">⭐ ${escapeHtml(p.badge||"UNGGULAN")}</span>
       <h3>${escapeHtml(p.name)}</h3>
       <p>${escapeHtml(p.desc||"Produk digital CAMXD Store")}</p>
       <div class="featured-price">${price}</div>
       <button type="button" class="featured-buy" data-featured-id="${escapeHtml(p.id)}">🛒 Beli Sekarang</button>
     </div>
   </article>`;
 }).join("");
 box.querySelectorAll("[data-featured-id]").forEach(btn=>btn.onclick=()=>{
   const p=products.find(x=>x.id===btn.dataset.featuredId);
   if(!p) return;
   selectedProduct=p;
   selectedPlan=p.plans[0];
   const item={productId:p.id,plan:selectedPlan[0],price:selectedPlan[1],name:p.name,image:p.image};
   const existing=cart.find(x=>x.productId===item.productId&&x.plan===item.plan);
   if(existing) existing.qty++; else cart.push({...item,qty:1});
   updateCart();
   openCart();
 });
}

const rupiah=n=>"Rp "+Number(n).toLocaleString("id-ID");
const $=s=>document.querySelector(s);
let activeFilter="all", selectedProduct=null, selectedPlan=null, cart=[];
function saveCart(){try{localStorage.setItem("camxd_cart_v1",JSON.stringify(cart));}catch(e){}}
function restoreCart(){try{const raw=localStorage.getItem("camxd_cart_v1");const saved=raw?JSON.parse(raw):[];if(Array.isArray(saved))cart=saved.filter(x=>x&&x.productId&&x.plan&&Number(x.qty)>0).map(x=>({...x,qty:Number(x.qty)}));}catch(e){cart=[];}}

function render(){
 const q=$("#search").value.trim().toLowerCase();
 let list=products.filter(p=>(activeFilter==="all"||p.category===activeFilter)&&(!q||(`${p.name} ${p.desc}`).toLowerCase().includes(q)));
 const priceOf=p=>Number(p?.plans?.[0]?.[1]||0);
 if(activeSort==="low") list.sort((a,b)=>priceOf(a)-priceOf(b));
 else if(activeSort==="high") list.sort((a,b)=>priceOf(b)-priceOf(a));
 else if(activeSort==="az") list.sort((a,b)=>String(a.name).localeCompare(String(b.name),"id"));
 else if(activeSort==="za") list.sort((a,b)=>String(b.name).localeCompare(String(a.name),"id"));
 $("#productCount").textContent=q ? `${list.length} hasil` : `${list.length} produk`;
 const miniNote=$("#catalogMiniNote");
 if(miniNote) miniNote.hidden=list.length===0;
 $("#empty").hidden=list.length>0;
 $("#products").innerHTML=list.map(p=>`
  <article class="product">
   <span class="badge">${escapeHtml(p.badge)}</span>
   <div class="product-image"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy"></div>
   <div class="product-body">
    <h3>${escapeHtml(p.name)}</h3><p>${escapeHtml(p.desc)}</p>
    <div class="price-row"><div><small>Mulai dari</small><div class="price">${p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan"}</div></div><button class="choose" data-id="${escapeHtml(p.id)}">Lihat Detail →</button></div>
    ${productMetaHtml(p)}
   </div>
  </article>`).join("");
 document.querySelectorAll(".choose").forEach(b=>b.onclick=()=>openDetail(b.dataset.id));
}

function renderRelatedProducts(){
  const box=$("#relatedProducts");
  if(!box||!selectedProduct)return;
  const same=products.filter(p=>p.id!==selectedProduct.id&&p.category===selectedProduct.category&&p.plans&&p.plans.length);
  const other=products.filter(p=>p.id!==selectedProduct.id&&p.plans&&p.plans.length&&!same.some(x=>x.id===p.id));
  const list=[...same,...other].slice(0,3);
  box.innerHTML=list.map(p=>{
    const price=p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan";
    return `<article class="related-card">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div class="related-card-body">
        <span class="featured-card-badge">${escapeHtml(p.badge||"PILIHAN")}</span>
        <h4>${escapeHtml(p.name)}</h4>
        <strong>${price}</strong>
        <button type="button" class="choose" data-related-id="${escapeHtml(p.id)}">Lihat →</button>
      </div>
    </article>`;
  }).join("");
  box.querySelectorAll("[data-related-id]").forEach(btn=>{
    btn.onclick=()=>openDetail(btn.dataset.relatedId);
  });
}

function openDetail(id){
 selectedProduct=products.find(p=>p.id===id); if(!selectedProduct)return; selectedPlan=selectedProduct.plans[0];
 addRecentProduct(selectedProduct.id);
 $("#detailImage").src=selectedProduct.image; $("#detailImage").alt=selectedProduct.name;
 $("#detailBadge").textContent=selectedProduct.badge; $("#detailTitle").textContent=selectedProduct.name; $("#detailDesc").textContent=selectedProduct.detail;
 updateFavoriteButton();
 const detailMeta=$("#detailProductMeta");
 if(detailMeta) detailMeta.innerHTML=productMetaHtml(selectedProduct);
 const proof=$("#detailTransactionProof");
 if(proof){
   const proofUrl=String(selectedProduct.transaction_proof_url||"").trim();
   proof.hidden=!proofUrl;
   proof.innerHTML=proofUrl
     ? '<div class="detail-proof-head"><span>🧾 Bukti Transaksi</span><a href="'+escapeHtml(proofUrl)+'" target="_blank" rel="noopener">Buka</a></div><img src="'+escapeHtml(proofUrl)+'" alt="Bukti transaksi '+escapeHtml(selectedProduct.name)+'" loading="lazy">'
     : "";
 }
 $("#detailPlans").innerHTML=selectedProduct.plans.map((p,i)=>`<button class="plan ${i===0?"selected":""}" data-i="${i}"><span>${p[0]}</span><strong>${p[1]?rupiah(p[1]):"Sesuai kebutuhan"}</strong></button>`).join("");
 document.querySelectorAll("#detailPlans .plan").forEach(b=>b.onclick=()=>{selectedPlan=selectedProduct.plans[Number(b.dataset.i)];document.querySelectorAll("#detailPlans .plan").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");});
 $("#detailModal").hidden=false; document.body.style.overflow="hidden";
}
function closeDetail(){ $("#detailModal").hidden=true; document.body.style.overflow=""; }

async function shareProduct(){
  if(!selectedProduct) return;
  const url=new URL(window.location.href);
  url.searchParams.set("product",selectedProduct.id);
  url.hash="produk";
  const shareData={
    title:selectedProduct.name+" — CAMXD Store",
    text:selectedProduct.desc||"Lihat produk di CAMXD Store",
    url:url.toString()
  };
  try{
    if(navigator.share){
      await navigator.share(shareData);
      return;
    }
    await navigator.clipboard.writeText(url.toString());
    alert("Link produk berhasil disalin.");
  }catch(error){
    if(error&&error.name==="AbortError") return;
    try{
      await navigator.clipboard.writeText(url.toString());
      alert("Link produk berhasil disalin.");
    }catch(e){
      prompt("Salin link produk ini:",url.toString());
    }
  }
}

function openSharedProduct(){
  const id=new URLSearchParams(window.location.search).get("product");
  if(!id) return;
  const product=products.find(p=>p.id===id);
  if(product) openDetail(id);
}

function getFavorites(){
  try{
    const raw=localStorage.getItem("camxd_favorites_v1");
    const saved=raw?JSON.parse(raw):[];
    return Array.isArray(saved)?saved.filter(Boolean):[];
  }catch(e){return [];}
}

function saveFavorites(list){
  try{localStorage.setItem("camxd_favorites_v1",JSON.stringify(list));}catch(e){}
}

function isFavorite(id){
  return getFavorites().includes(id);
}

function updateFavoriteButton(){
  const btn=$("#favoriteProduct");
  if(!btn||!selectedProduct)return;
  const active=isFavorite(selectedProduct.id);
  btn.textContent=active?"♥ Tersimpan":"♡ Simpan Produk";
  btn.setAttribute("aria-pressed",String(active));
}

function getRecentProducts(){
  try{
    const raw=localStorage.getItem("camxd_recent_v1");
    const saved=raw?JSON.parse(raw):[];
    return Array.isArray(saved)?saved.filter(Boolean):[];
  }catch(e){return [];}
}

function saveRecentProducts(list){
  try{localStorage.setItem("camxd_recent_v1",JSON.stringify(list.slice(0,6)));}catch(e){}
}

function addRecentProduct(id){
  if(!id)return;
  const list=getRecentProducts().filter(x=>x!==id);
  list.unshift(id);
  saveRecentProducts(list);
  renderRecentProducts();
}

function renderRecentProducts(){
  const section=$("#terakhir-dilihat"), box=$("#recentProducts");
  if(!section||!box)return;
  const list=getRecentProducts().map(id=>products.find(p=>p.id===id)).filter(Boolean);
  section.hidden=!list.length;
  if(!list.length){box.innerHTML="";return;}
  box.innerHTML=list.map(p=>{
    const price=p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan";
    return `<article class="recent-card">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div class="recent-card-body">
        <span class="featured-card-badge">◷ TERAKHIR DILIHAT</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.desc||"Produk digital CAMXD Store")}</p>
        <div class="saved-card-bottom"><strong>${price}</strong><button type="button" class="choose" data-recent-id="${escapeHtml(p.id)}">Lihat →</button></div>
      </div>
    </article>`;
  }).join("");
  box.querySelectorAll("[data-recent-id]").forEach(btn=>btn.onclick=()=>openDetail(btn.dataset.recentId));
}

function renderSavedProducts(){
  const section=$("#tersimpan"), box=$("#savedProducts");
  if(!section||!box)return;
  const ids=getFavorites();
  const list=ids.map(id=>products.find(p=>p.id===id)).filter(Boolean);
  section.hidden=!list.length;
  if(!list.length){box.innerHTML="";return;}
  box.innerHTML=list.map(p=>{
    const price=p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan";
    return `<article class="saved-card">
      <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" loading="lazy">
      <div class="saved-card-body">
        <span class="featured-card-badge">♥ TERSIMPAN</span>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.desc||"Produk digital CAMXD Store")}</p>
        <div class="saved-card-bottom"><strong>${price}</strong><button type="button" class="choose" data-saved-id="${escapeHtml(p.id)}">Lihat →</button></div>
      </div>
    </article>`;
  }).join("");
  box.querySelectorAll("[data-saved-id]").forEach(btn=>btn.onclick=()=>openDetail(btn.dataset.savedId));
}

function toggleFavorite(){
  if(!selectedProduct)return;
  const list=getFavorites();
  const index=list.indexOf(selectedProduct.id);
  if(index>=0){
    list.splice(index,1);
  }else{
    list.push(selectedProduct.id);
  }
  saveFavorites(list);
  updateFavoriteButton();
  renderSavedProducts();
}

function addToCart(){
 const item={productId:selectedProduct.id,plan:selectedPlan[0],price:selectedPlan[1],name:selectedProduct.name,image:selectedProduct.image};
 const existing=cart.find(x=>x.productId===item.productId&&x.plan===item.plan);
 if(existing) existing.qty++; else cart.push({...item,qty:1});
 closeDetail(); updateCart(); openCart();
}
function removeCart(index){cart.splice(index,1);updateCart();}
function changeQty(index,delta){cart[index].qty=Math.max(1,cart[index].qty+delta);updateCart();}
function cartTotal(){return cart.reduce((s,x)=>s+(x.price*x.qty),0);}
function updateCart(){
 saveCart();
 const count=cart.reduce((s,x)=>s+x.qty,0);$("#cartCount").textContent=count;
 $("#cartItems").innerHTML=cart.length?cart.map((x,i)=>{const lineTotal=x.price*x.qty;return `<div class="cart-item"><img src="${escapeHtml(x.image)}" alt=""><div class="cart-item-main"><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.plan)}</small><b>${x.price?rupiah(lineTotal):"Sesuai kebutuhan"}</b><div class="qty"><button data-q="-" data-i="${i}">−</button><span>${x.qty}</span><button data-q="+" data-i="${i}">+</button><button class="remove" data-remove="${i}">Hapus</button></div></div></div>`;}).join(""):"<div class='cart-empty'>Keranjang masih kosong.<br>Pilih produk untuk mulai berbelanja.</div>";
 if(appliedVoucher&&!cart.some(x=>x.productId===appliedVoucher.productKey)){appliedVoucher=null;const vi=$("#cartVoucher"),vm=$("#voucherMessage");if(vi)vi.value="";if(vm)vm.textContent="";}const subtotal=cartTotal(),discount=cartDiscountAmount(),finalTotal=cartFinalTotal();$("#cartTotal").textContent=cart.some(x=>!x.price)?"Cek nominal":rupiah(finalTotal);const subtotalEl=$("#cartSubtotal"),discountEl=$("#cartDiscount");if(subtotalEl)subtotalEl.textContent=rupiah(subtotal);if(discountEl)discountEl.textContent=discount>0?"- "+rupiah(discount):"Rp 0";renderVoucherSummary();
 document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.i),b.dataset.q==="+"?1:-1));document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeCart(Number(b.dataset.remove)));$("#checkoutCart").disabled=!cart.length;
}
function openCart(){$("#cartDrawer").classList.add("open");$("#cartBackdrop").hidden=false;}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#cartBackdrop").hidden=true;}

let pendingOrder=null;
let appliedVoucher=null;
function voucherProductForCode(code){const n=String(code||"").trim().toUpperCase();if(!n)return null;return products.find(p=>p.voucher_code&&String(p.voucher_code).trim().toUpperCase()===n)||null;}
function voucherDiscountForProduct(p,subtotal){if(!appliedVoucher||!p||p.id!==appliedVoucher.productKey)return 0;const base=Math.max(0,Number(subtotal)||0),value=Math.max(0,Number(appliedVoucher.discountValue)||0);return appliedVoucher.discountType==="percent"?Math.min(base,Math.round(base*value/100)):Math.min(base,value);}
function cartDiscountAmount(){if(!appliedVoucher)return 0;return cart.reduce((sum,x)=>{const line=Math.max(0,Number(x.price)||0)*Math.max(1,Number(x.qty)||1);return sum+voucherDiscountForProduct(products.find(p=>p.id===x.productId),line);},0);}
function cartFinalTotal(){return Math.max(0,cartTotal()-cartDiscountAmount());}
function renderVoucherSummary(){const box=$("#cartVoucherSummary");if(!box)return;if(!appliedVoucher){box.hidden=true;box.innerHTML="";return;}const discount=cartDiscountAmount();box.hidden=false;box.innerHTML='<div><span>🎟️ Voucher <b>'+escapeHtml(appliedVoucher.code)+'</b></span><strong>- '+rupiah(discount)+'</strong></div><small>'+escapeHtml(appliedVoucher.message||"Voucher berhasil digunakan.")+'</small>';}
async function applyVoucher(){const input=$("#cartVoucher"),button=$("#applyVoucherBtn"),msg=$("#voucherMessage");if(!input||!sb)return;const code=input.value.trim().toUpperCase();if(!code){appliedVoucher=null;renderVoucherSummary();if(msg)msg.textContent="Masukkan kode voucher.";return;}const product=voucherProductForCode(code);if(!product){if(msg)msg.textContent="Voucher tidak ditemukan atau tidak berlaku untuk produk di keranjang.";return;}if(!cart.some(x=>x.productId===product.id)){if(msg)msg.textContent="Voucher ini hanya berlaku untuk produk: "+product.name+".";return;}if(button){button.disabled=true;button.textContent="Memeriksa…";}try{const {data,error}=await sb.rpc("check_product_voucher",{p_product_key:product.id,p_code:code});if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row?.valid)throw new Error(row?.message||"Voucher tidak valid.");appliedVoucher={code,productKey:product.id,discountType:row.discount_type,discountValue:Number(row.discount_value||0),message:row.message||"Voucher berhasil digunakan."};if(msg){msg.textContent="✓ Voucher berhasil digunakan.";msg.classList.add("success");}renderVoucherSummary();updateCart();}catch(error){appliedVoucher=null;renderVoucherSummary();if(msg){msg.classList.remove("success");msg.textContent=error?.message||"Voucher tidak dapat digunakan."}}finally{if(button){button.disabled=false;button.textContent="Gunakan Voucher";}}}
function clearVoucher(){appliedVoucher=null;const input=$("#cartVoucher"),msg=$("#voucherMessage");if(input)input.value="";if(msg){msg.textContent="";msg.classList.remove("success");}renderVoucherSummary();updateCart();}

async function checkoutCart(){
 if(!cart.length)return;
 const name=$("#cartName").value.trim(), wa=$("#cartWa").value.trim();
 if(!name||!wa){alert("Silakan isi nama lengkap dan nomor WhatsApp terlebih dahulu.");return;}
 const button=$("#checkoutCart");
 if(button.disabled)return;
 const originalText=button.textContent;
 button.disabled=true;
 button.setAttribute("aria-busy","true");
 button.textContent="Memproses pesanan…";
 try{
  const orderId="CX"+Date.now().toString().slice(-8);
  const lines=cart.map((x,i)=>(i+1)+". "+x.name+" — "+x.plan+" x"+x.qty+" = "+(x.price?rupiah(x.price*x.qty):"Sesuai kebutuhan")).join("\n");
  const subtotal=cartTotal();const discountAmount=cartDiscountAmount();const finalTotal=cartFinalTotal();const total=cart.some(x=>!x.price)?"Sesuai kebutuhan / konfirmasi admin":rupiah(finalTotal);
  const orderItems=cart.map(x=>({product_id:x.productId,name:x.name,plan:x.plan,price:Number(x.price||0),qty:Number(x.qty||1)}));if(appliedVoucher){const {data:voucherData,error:voucherError}=await sb.rpc("redeem_product_voucher",{p_product_key:appliedVoucher.productKey,p_code:appliedVoucher.code});if(voucherError)throw voucherError;const voucherRow=Array.isArray(voucherData)?voucherData[0]:voucherData;if(!voucherRow?.valid)throw new Error(voucherRow?.message||"Voucher sudah tidak tersedia.");}
  closeCart();
  if(!navigator.onLine) throw new Error("iPhone sedang tidak terhubung ke internet.");
  const insertPromise=sb.from("orders").insert({order_id:orderId,customer_name:name,customer_wa:wa,items:orderItems,total:finalTotal,total_label:total,status:"Menunggu Pembayaran",voucher_code:appliedVoucher?.code||null,discount_amount:discountAmount});
  const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Koneksi ke server terlalu lama. Silakan cek internet iPhone lalu coba lagi.")),12000));
  const {error}=await Promise.race([insertPromise,timeoutPromise]);
  if(error)throw error;
  pendingOrder={orderId,name,wa,lines,total,voucherCode:appliedVoucher?.code||"",discountAmount};appliedVoucher=null;
  closeCart();
  $("#paymentOrderId").textContent=orderId;
  $("#paymentTotal").textContent=total;
  $("#cartDrawer").classList.remove("open");
  $("#cartBackdrop").hidden=true;
  $("#paymentModal").hidden=false;
  $("#paymentModal").scrollTop=0;
  document.body.style.overflow="hidden";
  const reported=$("#paymentReported");
  const proofButton=$("#sendProof");
  if(reported){
   reported.hidden=true;
   reported.classList.remove("paid");
  }
  if(proofButton){
   proofButton.disabled=false;
   proofButton.textContent="Saya Sudah Bayar — Kirim Bukti →";
  }
  const proofFile=$("#paymentProofFile");
  const proofPreview=$("#paymentProofPreview");
  const proofError=$("#paymentProofError");
  if(proofFile) proofFile.value="";
  if(proofPreview){proofPreview.hidden=true;proofPreview.innerHTML="";}
  if(proofError) proofError.textContent="";
  startPaymentStatusWatch();
 }catch(error){
  console.error("Checkout CAMXD:",error);
  alert("Checkout belum berhasil. Periksa koneksi internet lalu coba lagi.\n\nDetail: "+(error&&error.message?error.message:"Terjadi kesalahan saat menyimpan pesanan."));
 }finally{
  button.disabled=false;
  button.textContent=originalText;
  button.removeAttribute("aria-busy");
 }
}

let paymentStatusTimer=null;
let paymentStatusBusy=false;

function stopPaymentStatusWatch(){
 if(paymentStatusTimer){
  clearInterval(paymentStatusTimer);
  paymentStatusTimer=null;
 }
 paymentStatusBusy=false;
}

function showPaymentStatus(status){
 const s=String(status||"").toLowerCase();
 const reported=$("#paymentReported");
 const proofButton=$("#sendProof");
 if(!reported)return;

 const paid=s.includes("sudah dibayar")||s.includes("lunas")||s.includes("selesai");
 const verified=s.includes("menunggu verifikasi")||s.includes("verifikasi");
 if(paid){
  reported.hidden=false;
  reported.classList.add("paid");
  reported.innerHTML='<div class="payment-reported-icon">✓</div><div><strong>Pembayaran SUDAH DIBAYAR / LUNAS</strong><p>Pembayaran telah diverifikasi admin. Pesanan dapat diproses.</p></div>';
  if(proofButton){
   proofButton.disabled=true;
   proofButton.textContent="✓ Pembayaran Lunas";
  }
  stopPaymentStatusWatch();
 }else if(verified){
  reported.hidden=false;
  reported.classList.remove("paid");
  reported.innerHTML='<div class="payment-reported-icon">✓</div><div><strong>Pembayaran telah dilaporkan</strong><p>Pesanan sedang menunggu verifikasi admin. Status akan diperbarui otomatis setelah admin memverifikasi.</p></div>';
 }
}

async function checkPaymentStatus(){
 if(!pendingOrder||paymentStatusBusy)return;
 paymentStatusBusy=true;
 try{
  const {data,error}=await sb.rpc("check_order",{p_order_id:pendingOrder.orderId,p_customer_wa:pendingOrder.wa});
  if(!error&&data) showPaymentStatus(data.status);
 }catch(error){
  console.warn("Pemantauan status pembayaran:",error);
 }finally{
  paymentStatusBusy=false;
 }
}

function startPaymentStatusWatch(){
 stopPaymentStatusWatch();
 checkPaymentStatus();
 paymentStatusTimer=setInterval(checkPaymentStatus,4000);
}

function closePayment(){
 stopPaymentStatusWatch();
 $("#paymentModal").hidden=true;
 document.body.style.overflow="";
}

async function uploadPaymentProof(file, orderId, customerWa){
 if(!file) throw new Error("Pilih screenshot bukti pembayaran terlebih dahulu.");
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)) throw new Error("Format bukti harus JPG, PNG, atau WebP.");
 if(file.size>5*1024*1024) throw new Error("Ukuran bukti maksimal 5 MB.");
 if(!sb) throw new Error("Koneksi database belum tersedia.");

 const ext=(file.name.split(".").pop()||"jpg").toLowerCase().replace(/[^a-z0-9]/g,"")||"jpg";
 const path=orderId+"/"+Date.now()+"-"+crypto.randomUUID()+"."+ext;

 const {error:uploadError}=await sb.storage.from("payment-proofs").upload(path,file,{contentType:file.type,upsert:false});
 if(uploadError) throw uploadError;

 // Customer tidak lagi melakukan UPDATE orders langsung.
 // Supabase RPC memverifikasi ID Pesanan + nomor WhatsApp sebelum mengubah status.
 const {data:updateOk,error:updateError}=await sb.rpc("submit_payment_proof",{
   p_order_id:orderId,
   p_customer_wa:customerWa,
   p_payment_proof_path:path
 });

 if(updateError || updateOk !== true){
   try{await sb.storage.from("payment-proofs").remove([path]);}catch{}
   throw updateError || new Error("Bukti pembayaran gagal dicatat.");
 }

 return path;
}

async function sendProof(){
 if(!pendingOrder)return;
 const o=pendingOrder;
 const file=$("#paymentProofFile")?.files?.[0];
 const proofButton=$("#sendProof");
 const errorBox=$("#paymentProofError");
 if(errorBox) errorBox.textContent="";
 if(proofButton){proofButton.disabled=true;proofButton.textContent="⏳ Mengunggah bukti…";}
 try{
   await uploadPaymentProof(file,o.orderId,o.wa);
   showPaymentStatus("Menunggu Verifikasi");
   if(proofButton) proofButton.textContent="✓ Bukti Terkirim";
   const msg="🛍️ CAMXD STORE\n🆔 ID Pesanan: "+o.orderId+"\n💰 Total: "+o.total+"\n✅ Pembayaran sudah dilakukan. Bukti pembayaran sudah diupload ke CAMXD Store.\nMohon dicek dan diproses.";
   window.location.href="https://wa.me/"+STORE_WA+"?text="+encodeURIComponent(msg);
 }catch(error){
   if(errorBox) errorBox.textContent="Gagal mengirim bukti: "+(error?.message||"Silakan coba lagi.");
   if(proofButton){proofButton.disabled=false;proofButton.textContent="Saya Sudah Bayar — Kirim Bukti →";}
 }
}
function normalizeWa(value){
 return String(value||"").replace(/\\D/g,"");
}

function statusClass(status){
 const s=String(status||"").toLowerCase();
 if(s.includes("selesai")||s.includes("sudah dibayar")||s.includes("lunas")) return "done";
 if(s.includes("batal")) return "cancel";
 if(s.includes("verifikasi")||s.includes("proses")) return "process";
 return "waiting";
}

function renderOrderTimeline(status){
 const current=String(status||"Menunggu Pembayaran");
 if(current.includes("Dibatalkan")) return '<div class="order-timeline cancelled"><div class="timeline-step active"><i>×</i><span>Pesanan dibatalkan</span></div></div>';
 const steps=["Menunggu Pembayaran","Menunggu Verifikasi","Sudah Dibayar","Sedang Diproses","Selesai"];
 let idx=steps.findIndex(x=>current===x); if(idx<0) idx=steps.findIndex(x=>current.includes(x)); if(idx<0) idx=0;
 return '<div class="order-timeline">'+steps.map((step,i)=>'<div class="timeline-step '+(i<=idx?"active":"")+'"><i>'+(i<idx?"✓":(i===idx?"•":"○"))+'</i><span>'+step+'</span></div>').join("")+'</div>';
}

function renderOrderCheck(order){
 const result=$("#orderCheckResult");
 const items=Array.isArray(order.items)?order.items:[];
 const itemHtml=items.length?items.map(x=>`<div class="order-result-item"><span>${escapeHtml(x.name||"Produk")} — ${escapeHtml(x.plan||"")} ×${Number(x.qty||1)}</span><strong>${Number(x.price||0)?rupiah(Number(x.price||0)*Number(x.qty||1)):"Konfirmasi admin"}</strong></div>`).join(""):"<div class='order-result-item'><span>Detail produk</span><strong>-</strong></div>";
 result.innerHTML=`
  <div class="order-result-head">
   <div><span class="eyebrow">PESANAN DITEMUKAN</span><h3>${escapeHtml(order.order_id)}</h3></div>
   <span class="order-status ${statusClass(order.status)}">${escapeHtml(order.status||"Menunggu Pembayaran")}</span>
  </div>
  <div class="order-result-meta"><span>Nama</span><strong>${escapeHtml(order.customer_name||"-")}</strong></div>
  <div class="order-result-meta"><span>Dibuat</span><strong>${new Date(order.created_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}</strong></div>
  <div class="order-result-items">${itemHtml}</div>
  <div class="order-result-total"><span>Total</span><strong>${order.total_label||rupiah(order.total||0)}</strong></div>
  ${order.delivery_details?`<div class="delivery-box"><b>📦 Detail Pesanan</b><p>${String(order.delivery_details).replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\r?\n/g,"<br>")}</p></div>`:"<p class='order-result-note'>Detail pengiriman akan muncul setelah pesanan selesai diproses admin.</p>"}
 `;
 result.hidden=false;
}

async function checkOrder(event){
  event.preventDefault();

  const id=$("#checkOrderId").value.trim().toUpperCase();
  const wa=$("#checkOrderWa").value.trim();

  const result=$("#orderCheckResult");
  const btn=$("#checkOrderBtn");

  if(!id || !wa) return;

  btn.disabled=true;
  btn.textContent="Mengecek...";

  result.hidden=false;
  result.innerHTML="<p class='order-loading'>⏳ Sedang mengecek pesanan...</p>";

  try{
    const {data,error}=await sb.rpc("check_order",{
      p_order_id:id,
      p_customer_wa:wa
    });

    if(error) throw error;

    if(!data){
      result.innerHTML=
        "<div class='order-not-found'>" +
        "<strong>Pesanan tidak ditemukan.</strong>" +
        "<p>Pastikan ID pesanan dan nomor WhatsApp sama seperti saat checkout.</p>" +
        "</div>";
      return;
    }

    renderOrderCheck(data);

  }catch(error){

    console.error(error);

    result.innerHTML=
      "<div class='order-not-found'>" +
      "<strong>Gagal mengecek pesanan.</strong>" +
      "<p>Silakan coba lagi beberapa saat.</p>" +
      "</div>";

  }finally{

    btn.disabled=false;
    btn.textContent="🔎 Cek Pesanan";

  }
}

async function copyOrderId(){
 const id=$("#paymentOrderId").textContent;
 try{await navigator.clipboard.writeText(id); $("#copyOrderId").textContent="Tersalin ✓";}catch(e){alert("ID Pesanan: "+id);}
 setTimeout(()=>$("#copyOrderId").textContent="Salin",1600);
}

document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});
$("#search").addEventListener("input",render);
$("#sortProducts")?.addEventListener("change",e=>{activeSort=e.target.value;render();});
$("#closeDetail").onclick=closeDetail; $("#detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")closeDetail();});
$("#addToCart").onclick=addToCart;
$("#shareProduct")?.addEventListener("click",shareProduct);
$("#favoriteProduct")?.addEventListener("click",toggleFavorite);
$("#mobileCart")?.addEventListener("click",openCart);
const backTop=$("#backTop");
window.addEventListener("scroll",()=>{
  if(backTop) backTop.classList.toggle("show",window.scrollY>500);
},{passive:true});
backTop?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

$("#cartBtn").onclick=openCart; $("#closeCart").onclick=closeCart; $("#cartBackdrop").onclick=closeCart;
$("#checkoutCart")?.addEventListener("click",checkoutCart);
$("#applyVoucherBtn")?.addEventListener("click",applyVoucher);
$("#cartVoucher")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();applyVoucher();}});
$("#musicBtn")?.addEventListener("click",()=>{
  const btn=$("#musicBtn");
  const muted=btn.dataset.muted==="1";
  const next=!muted;
  if(hasNativeStoreMusic()){
    window.CAMXDMusic.setMuted(next);
  }else{
    setStoreWebMusicMuted(next);
  }
  btn.dataset.muted=next?"1":"0";
  btn.textContent=next?"🔇":"🔊";
  btn.setAttribute("aria-label",next?"Nyalakan musik":"Matikan musik");
  btn.title=next?"Nyalakan musik":"Matikan musik";
});
$("#closePayment").onclick=closePayment; $("#sendProof").onclick=sendProof; $("#copyOrderId").onclick=copyOrderId;
$("#paymentProofFile")?.addEventListener("change",e=>{
 const file=e.target.files?.[0],box=$("#paymentProofPreview"),err=$("#paymentProofError");
 if(err) err.textContent="";
 if(!file){
   if(box){box.hidden=true;box.innerHTML="";}
   return;
 }
 if(!["image/jpeg","image/png","image/webp"].includes(file.type)||file.size>5*1024*1024){
   if(err) err.textContent="File harus JPG/PNG/WebP dan maksimal 5 MB.";
   e.target.value="";
   if(box){box.hidden=true;box.innerHTML="";}
   return;
 }
 if(box){
   box.hidden=false;
   box.innerHTML='<span class="proof-selected-icon">✓</span><span><strong>Upload berhasil</strong><small>'+escapeHtml(file.name)+'</small></span>';
 }
});
$("#orderCheckForm").addEventListener("submit",checkOrder);
$("#paymentModal").addEventListener("click",e=>{if(e.target.id==="paymentModal")closePayment();});
$("#menuBtn").onclick=()=>$("#navMenu").classList.toggle("open");
document.querySelectorAll("nav a").forEach(a=>a.onclick=()=>$("#navMenu").classList.remove("open"));
initStoreWebMusic();
syncMusicButton();
restoreCart();
updateCart();
render();
renderFeaturedProducts();
openSharedProduct();
renderSavedProducts();
renderRecentProducts();
loadProducts();


