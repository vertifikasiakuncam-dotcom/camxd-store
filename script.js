const STORE_WA="6282133942994";
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

let products=[];

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

async function loadProducts(){
  const {data: productRows, error: productError}=await sb
    .from("products")
    .select("id,product_key,name,description,category,image_url,badge,detail,sort_order")
    .eq("is_active",true)
    .order("sort_order",{ascending:true});

  if(productError){
    console.error("Gagal mengambil produk dari Supabase:",productError);
    products=FALLBACK_PRODUCTS;
    render();
    renderFeaturedProducts();
    return;
  }

  const {data: planRows, error: planError}=await sb
    .from("product_plans")
    .select("product_id,plan_name,price,sort_order")
    .eq("is_active",true)
    .order("sort_order",{ascending:true});

  if(planError){
    console.error("Gagal mengambil paket produk dari Supabase:",planError);
    products=FALLBACK_PRODUCTS;
    render();
    return;
  }

  const plansByProduct={};
  (planRows||[]).forEach(row=>{
    if(!plansByProduct[row.product_id]) plansByProduct[row.product_id]=[];
    plansByProduct[row.product_id].push([
      row.plan_name,
      Number(row.price||0)
    ]);
  });

  products=(productRows||[]).map(p=>({
    id:p.product_key,
    dbId:p.id,
    name:p.name,
    desc:p.description,
    category:p.category,
    image:p.image_url,
    badge:p.badge,
    plans:plansByProduct[p.id]||[],
    detail:p.detail
  })).filter(p=>p.plans.length);

  render();
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

function render(){
 const q=$("#search").value.trim().toLowerCase();
 const list=products.filter(p=>(activeFilter==="all"||p.category===activeFilter)&&(!q||(`${p.name} ${p.desc}`).toLowerCase().includes(q)));
 $("#productCount").textContent=`${list.length} produk`;
 $("#empty").hidden=list.length>0;
 $("#products").innerHTML=list.map(p=>`
  <article class="product">
   <span class="badge">${p.badge}</span>
   <div class="product-image"><img src="${p.image}" alt="${p.name}" loading="lazy"></div>
   <div class="product-body">
    <h3>${p.name}</h3><p>${p.desc}</p>
    <div class="price-row"><div><small>Mulai dari</small><div class="price">${p.plans[0][1]?rupiah(p.plans[0][1]):"Sesuai kebutuhan"}</div></div><button class="choose" data-id="${p.id}">Lihat Detail →</button></div>
   </div>
  </article>`).join("");
 document.querySelectorAll(".choose").forEach(b=>b.onclick=()=>openDetail(b.dataset.id));
}

function openDetail(id){
 selectedProduct=products.find(p=>p.id===id); selectedPlan=selectedProduct.plans[0];
 $("#detailImage").src=selectedProduct.image; $("#detailImage").alt=selectedProduct.name;
 $("#detailBadge").textContent=selectedProduct.badge; $("#detailTitle").textContent=selectedProduct.name; $("#detailDesc").textContent=selectedProduct.detail;
 $("#detailPlans").innerHTML=selectedProduct.plans.map((p,i)=>`<button class="plan ${i===0?"selected":""}" data-i="${i}"><span>${p[0]}</span><strong>${p[1]?rupiah(p[1]):"Sesuai kebutuhan"}</strong></button>`).join("");
 document.querySelectorAll("#detailPlans .plan").forEach(b=>b.onclick=()=>{selectedPlan=selectedProduct.plans[Number(b.dataset.i)];document.querySelectorAll("#detailPlans .plan").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");});
 $("#detailModal").hidden=false; document.body.style.overflow="hidden";
}
function closeDetail(){ $("#detailModal").hidden=true; document.body.style.overflow=""; }

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
 const count=cart.reduce((s,x)=>s+x.qty,0); $("#cartCount").textContent=count; $("#cartItems").innerHTML=cart.length?cart.map((x,i)=>`<div class="cart-item"><img src="${x.image}" alt=""><div class="cart-item-main"><strong>${x.name}</strong><small>${x.plan}</small><b>${x.price?rupiah(x.price):"Sesuai kebutuhan"}</b><div class="qty"><button data-q="-" data-i="${i}">−</button><span>${x.qty}</span><button data-q="+" data-i="${i}">+</button><button class="remove" data-remove="${i}">Hapus</button></div></div></div>`).join(""):"<div class='cart-empty'>Keranjang masih kosong.<br>Pilih produk untuk mulai berbelanja.</div>";
 $("#cartTotal").textContent=cart.some(x=>!x.price)?"Cek nominal":""+rupiah(cartTotal());
 document.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>changeQty(Number(b.dataset.i),b.dataset.q==="+"?1:-1));
 document.querySelectorAll("[data-remove]").forEach(b=>b.onclick=()=>removeCart(Number(b.dataset.remove)));
 $("#checkoutCart").disabled=!cart.length;
}
function openCart(){$("#cartDrawer").classList.add("open");$("#cartBackdrop").hidden=false;}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#cartBackdrop").hidden=true;}

let pendingOrder=null;

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
  const total=cart.some(x=>!x.price)?"Sesuai kebutuhan / konfirmasi admin":rupiah(cartTotal());
  const orderItems=cart.map(x=>({product_id:x.productId,name:x.name,plan:x.plan,price:Number(x.price||0),qty:Number(x.qty||1)}));
  closeCart();
  if(!navigator.onLine) throw new Error("iPhone sedang tidak terhubung ke internet.");
  const insertPromise=sb.from("orders").insert({order_id:orderId,customer_name:name,customer_wa:wa,items:orderItems,total:cartTotal(),total_label:total,status:"Menunggu Pembayaran"});
  const timeoutPromise=new Promise((_,reject)=>setTimeout(()=>reject(new Error("Koneksi ke server terlalu lama. Silakan cek internet iPhone lalu coba lagi.")),12000));
  const {error}=await Promise.race([insertPromise,timeoutPromise]);
  if(error)throw error;
  pendingOrder={orderId,name,wa,lines,total};
  closeCart();
  $("#paymentOrderId").textContent=orderId;
  $("#paymentTotal").textContent=total;
  $("#cartDrawer").classList.remove("open");
  $("#cartBackdrop").hidden=true;
  $("#paymentModal").hidden=false;
  $("#paymentModal").scrollTop=0;
  document.body.style.overflow="hidden";
 }catch(error){
  console.error("Checkout CAMXD:",error);
  alert("Checkout belum berhasil. Periksa koneksi internet lalu coba lagi.\n\nDetail: "+(error&&error.message?error.message:"Terjadi kesalahan saat menyimpan pesanan."));
 }finally{
  button.disabled=false;
  button.textContent=originalText;
  button.removeAttribute("aria-busy");
 }
}

function closePayment(){
 $("#paymentModal").hidden=true;
 document.body.style.overflow="";
}

function sendProof(){
 if(!pendingOrder)return;

 const o=pendingOrder;
 const lines=String(o.lines||"").split(/\r?\n/).filter(Boolean);

 const msg=[
  "🛍️ *CAMXD STORE*",
  "━━━━━━━━━━━━━━━━━━━━",
  "🧾 *KONFIRMASI PEMBAYARAN*",
  "",
  "🆔 *ID Pesanan*",
  o.orderId,
  "",
  "📦 *Detail Pesanan*",
  ...lines,
  "",
  "💰 *Total Pembayaran*",
  o.total,
  "",
  "👤 *Data Pemesan*",
  "Nama: "+o.name,
  "WhatsApp: "+o.wa,
  "",
  "💳 *Metode Pembayaran*",
  "QRIS CAMXD Store",
  "",
  "✅ Saya sudah melakukan pembayaran.",
  "📎 Bukti pembayaran saya lampirkan di chat ini.",
  "",
  "Mohon dicek dan diproses.",
  "Terima kasih 🙏",
  "━━━━━━━━━━━━━━━━━━━━"
 ].join("\n");

 window.open(
  `https://wa.me/${STORE_WA}?text=${encodeURIComponent(msg)}`,
  "_blank"
 );
}

function normalizeWa(value){
 return String(value||"").replace(/\\D/g,"");
}

function statusClass(status){
 const s=String(status||"").toLowerCase();
 if(s.includes("selesai")) return "done";
 if(s.includes("batal")) return "cancel";
 if(s.includes("verifikasi")||s.includes("proses")) return "process";
 return "waiting";
}

function renderOrderCheck(order){
 const result=$("#orderCheckResult");
 const items=Array.isArray(order.items)?order.items:[];
 const itemHtml=items.length?items.map(x=>`<div class="order-result-item"><span>${x.name||"Produk"} — ${x.plan||""} ×${x.qty||1}</span><strong>${Number(x.price||0)?rupiah(Number(x.price||0)*Number(x.qty||1)):"Konfirmasi admin"}</strong></div>`).join(""):"<div class='order-result-item'><span>Detail produk</span><strong>-</strong></div>";
 result.innerHTML=`
  <div class="order-result-head">
   <div><span class="eyebrow">PESANAN DITEMUKAN</span><h3>${order.order_id}</h3></div>
   <span class="order-status ${statusClass(order.status)}">${order.status||"Menunggu Pembayaran"}</span>
  </div>
  <div class="order-result-meta"><span>Nama</span><strong>${order.customer_name||"-"}</strong></div>
  <div class="order-result-meta"><span>Dibuat</span><strong>${new Date(order.created_at).toLocaleString("id-ID",{dateStyle:"medium",timeStyle:"short"})}</strong></div>
  <div class="order-result-items">${itemHtml}</div>
  <div class="order-result-total"><span>Total</span><strong>${order.total_label||rupiah(order.total||0)}</strong></div>
  ${order.delivery_details?`<div class="delivery-box"><b>📦 Detail Pesanan</b><p>${String(order.delivery_details).replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/\\n/g,"<br>")}</p></div>`:"<p class='order-result-note'>Detail pengiriman akan muncul setelah pesanan selesai diproses admin.</p>"}
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
$("#closeDetail").onclick=closeDetail; $("#detailModal").addEventListener("click",e=>{if(e.target.id==="detailModal")closeDetail();});
$("#addToCart").onclick=addToCart;
$("#mobileCart")?.addEventListener("click",openCart);
const backTop=$("#backTop");
window.addEventListener("scroll",()=>{
  if(backTop) backTop.classList.toggle("show",window.scrollY>500);
},{passive:true});
backTop?.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

$("#cartBtn").onclick=openCart; $("#closeCart").onclick=closeCart; $("#cartBackdrop").onclick=closeCart;
$("#closePayment").onclick=closePayment; $("#sendProof").onclick=sendProof; $("#copyOrderId").onclick=copyOrderId;
$("#orderCheckForm").addEventListener("submit",checkOrder);
$("#paymentModal").addEventListener("click",e=>{if(e.target.id==="paymentModal")closePayment();});
$("#menuBtn").onclick=()=>$("#navMenu").classList.toggle("open");
document.querySelectorAll("nav a").forEach(a=>a.onclick=()=>$("#navMenu").classList.remove("open"));
updateCart(); loadProducts();
