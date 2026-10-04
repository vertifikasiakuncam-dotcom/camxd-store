const STORE_WA="6282133942994";

const products=[
 {id:"ktv",name:"KTV Premium",desc:"Akses KTV Premium",category:"premium",image:"ktv-premium.jpg",badge:"BEST SELLER",plans:[["1 Bulan",65000],["3 Bulan",95000],["6 Bulan",150000],["1 Tahun",200000]]},
 {id:"youtube",name:"YouTube Premium",desc:"YouTube Premium",category:"premium",image:"youtube-premium.jpg",badge:"POPULER",plans:[["1 Bulan",15000],["3 Bulan",40000],["6 Bulan",70000],["1 Tahun",120000]]},
 {id:"netflix",name:"Netflix Sharing",desc:"Netflix sharing",category:"premium",image:"netflix-sharing.jpg",badge:"POPULER",plans:[["1 Bulan",33000],["3 Bulan",90000],["6 Bulan",165000],["1 Tahun",300000]]},
 {id:"capcut",name:"CapCut Pro",desc:"CapCut Premium",category:"premium",image:"capcut-pro.jpg",badge:"POPULER",plans:[["1 Bulan",35000],["3 Bulan",90000],["6 Bulan",160000],["1 Tahun",300000]]},
 {id:"canva",name:"Canva Premium",desc:"Canva Premium",category:"premium",image:"canva-premium.jpg",badge:"POPULER",plans:[["1 Bulan",30000],["3 Bulan",75000],["6 Bulan",140000],["1 Tahun",250000]]},
 {id:"spotify",name:"Spotify Premium",desc:"Spotify Premium",category:"premium",image:"spotify-premium.jpg",badge:"POPULER",plans:[["1 Bulan",25000],["3 Bulan",65000],["6 Bulan",120000],["1 Tahun",220000]]},
 {id:"topup",name:"Top Up All Games",desc:"Top up game & kebutuhan digital",category:"topup",image:"top-up-all-games.jpg",badge:"CEPAT",plans:[["Top Up",0]]},
 {id:"payment",name:"Pembayaran Digital",desc:"Pulsa, tagihan & pembayaran",category:"topup",image:"pembayaran-digital.jpg",badge:"MUDAH",plans:[["Pembayaran",0]]},
 {id:"certificate",name:"Jasa Pembuatan Sertifikat",desc:"Jasa pembuatan sertifikat",category:"jasa",image:"jasa-sertifikat.jpg",badge:"JASA",plans:[["1 Sertifikat",20000],["+ Laminating",25000]]}
];

const rupiah=n=>"Rp "+Number(n).toLocaleString("id-ID");
const $=s=>document.querySelector(s);
let activeFilter="all", selectedProduct=null, selectedPlan=null;

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
        <div class="price-row">
          <div><small>Mulai dari</small><div class="price">${rupiah(p.plans[0][1])}</div></div>
          <button class="choose" data-id="${p.id}">Pilih Paket →</button>
        </div>
      </div>
    </article>`).join("");
  document.querySelectorAll(".choose").forEach(b=>b.onclick=()=>openModal(b.dataset.id));
}

function openModal(id){
  selectedProduct=products.find(p=>p.id===id);
  selectedPlan=selectedProduct.plans[0];
  $("#modalTitle").textContent=selectedProduct.name;
  $("#modalDesc").textContent=selectedProduct.desc;
  $("#modalImage").src=selectedProduct.image;
  $("#modalImage").alt=selectedProduct.name;
  $("#plans").innerHTML=selectedProduct.plans.map((p,i)=>`<button class="plan ${i===0?"selected":""}" data-i="${i}"><span>${p[0]}</span><strong>${p[1]?rupiah(p[1]):"Sesuai kebutuhan"}</strong></button>`).join("");
  document.querySelectorAll(".plan").forEach(b=>b.onclick=()=>{selectedPlan=selectedProduct.plans[Number(b.dataset.i)];document.querySelectorAll(".plan").forEach(x=>x.classList.remove("selected"));b.classList.add("selected");updateTotal();});
  updateTotal();
  $("#modalBackdrop").hidden=false;
  document.body.style.overflow="hidden";
}
function updateTotal(){ $("#totalPrice").textContent=selectedPlan[1]?rupiah(selectedPlan[1]):"Sesuai kebutuhan"; }
function closeModal(){ $("#modalBackdrop").hidden=true;document.body.style.overflow=""; }

function sendOrder(){
  const name=$("#customerName").value.trim(), wa=$("#customerWa").value.trim();
  if(!name||!wa){alert("Silakan isi nama lengkap dan nomor WhatsApp terlebih dahulu.");return;}
  const orderId="CX"+Date.now().toString().slice(-8);
  const total=selectedPlan[1]?rupiah(selectedPlan[1]):"Sesuai kebutuhan";
  const msg=`Halo CAMXD Store 👋%0A%0ASaya ingin order:%0AID Pesanan: ${orderId}%0AProduk: ${selectedProduct.name}%0ADurasi/Paket: ${selectedPlan[0]}%0ATotal: ${total}%0ANama: ${name}%0ANomor WA: ${wa}%0A%0ASaya sudah melakukan pembayaran melalui QRIS CAMXD Store.%0ASaya lampirkan bukti pembayaran pada chat ini.%0AMohon dicek dan diproses. Terima kasih 🙏`;
  window.open(`https://wa.me/${STORE_WA}?text=${msg}`,"_blank");
}

document.querySelectorAll(".filter").forEach(b=>b.onclick=()=>{activeFilter=b.dataset.filter;document.querySelectorAll(".filter").forEach(x=>x.classList.remove("active"));b.classList.add("active");render();});
$("#search").addEventListener("input",render);
$("#sendOrder").onclick=sendOrder;
$("#closeModal").onclick=closeModal;
$("#modalBackdrop").addEventListener("click",e=>{if(e.target.id==="modalBackdrop")closeModal();});
$("#menuBtn").onclick=()=>$("#navMenu").classList.toggle("open");
document.querySelectorAll("nav a").forEach(a=>a.onclick=()=>$("#navMenu").classList.remove("open"));
render();
