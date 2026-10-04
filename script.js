const STORE_WA="6282133942994";
const products=[
{name:"KTV Premium",image:"ktv-premium.jpg",cat:"Premium",icon:"KTV",badge:"BEST SELLER",desc:"Akses KTV Premium",durations:[["1 Bulan",65000],["3 Bulan",95000],["6 Bulan",150000],["1 Tahun",200000]]},
{name:"YouTube Premium",image:"youtube-premium.jpg",cat:"Premium",icon:"▶",badge:"POPULER",desc:"YouTube Premium",durations:[["1 Bulan",15000]]},
{name:"Netflix Sharing",image:"netflix-sharing.jpg",cat:"Premium",icon:"N",badge:"POPULER",desc:"Netflix sharing",durations:[["1 Bulan",33000]]},
{name:"CapCut Pro",image:"capcut-pro.jpg",cat:"Premium",icon:"CC",badge:"HOT",desc:"CapCut Pro sharing",durations:[["1 Bulan",35000]]},
{name:"Canva Premium",image:"canva-premium.jpg",cat:"Premium",icon:"Ca",badge:"POPULER",desc:"Canva Premium",durations:[["1 Bulan",25000]]},
{name:"Spotify Premium",image:"spotify-premium.jpg",cat:"Premium",icon:"S",badge:"",desc:"Spotify Premium",durations:[["1 Bulan",25000]]},
{name:"Top Up All Games",image:"top-up-all-games.jpg",cat:"Top Up",icon:"🎮",badge:"TOP UP",desc:"Top up berbagai game",durations:[["Mulai dari",10000]]},
{name:"Pembayaran Digital",image:"pembayaran-digital.jpg",cat:"Jasa",icon:"Rp",badge:"JASA",desc:"Bantuan pembayaran digital",durations:[["Mulai dari",5000]]},
{name:"Jasa Pembuatan Sertifikat",image:"jasa-sertifikat.jpg",cat:"Jasa",icon:"✓",badge:"BEST VALUE",desc:"Sertifikat digital",durations:[["1 Sertifikat",20000],["Laminating +",5000]]}
];
let current=null,selected=0,currentCat="Semua";
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function renderFilters(){const cats=["Semua",...new Set(products.map(p=>p.cat))];document.getElementById("filters").innerHTML=cats.map((c,i)=>`<button class="${i===0?"active":""}" onclick="filter('${c}',this)">${c}</button>`).join("")}
function applyCatalog(){const q=(document.getElementById("search")?.value||"").toLowerCase();let list=products.filter(p=>currentCat==="Semua"||p.cat===currentCat).filter(p=>(p.name+" "+p.desc).toLowerCase().includes(q));render(list)}
function render(list=products){document.getElementById("count").textContent=`${list.length} produk`;document.getElementById("products").innerHTML=list.length?list.map(p=>`<article class="product"><div class="badge">${p.badge||p.cat}</div><div class="product-media"><img src="${p.image}" alt="${p.name}" loading="lazy"></div><div class="phead"><div class="picon">${p.icon}</div><div><h3>${p.name}</h3><div class="desc">${p.desc}</div></div></div><div class="package">Mulai dari <b>${rupiah(p.durations[0][1])}</b></div><div class="pfoot"><span class="price">${rupiah(p.durations[0][1])}</span><button class="buy" onclick="openModal(${products.indexOf(p)})">Pilih Paket →</button></div></article>`).join(""): `<div class="empty">Produk tidak ditemukan.<br><button class="secondary" onclick="resetCatalog()">Tampilkan semua</button></div>`}
function filter(cat,el){currentCat=cat;document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));el.classList.add("active");applyCatalog()}
function resetCatalog(){currentCat="Semua";document.getElementById("search").value="";document.querySelectorAll(".filters button").forEach((x,i)=>x.classList.toggle("active",i===0));render()}
function openModal(i){current=products[i];selected=0;document.getElementById("mTitle").textContent=current.name;document.getElementById("mDesc").textContent=current.desc;document.getElementById("durations").innerHTML=current.durations.map((d,j)=>`<div class="duration ${j===0?"selected":""}" onclick="selectDuration(${j},this)"><span>${d[0]}</span><b>${rupiah(d[1])}</b></div>`).join("");document.getElementById("modal").classList.add("show")}
function selectDuration(i,el){selected=i;document.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")}
function closeModal(){document.getElementById("modal").classList.remove("show")}
function orderWhatsApp(){const name=document.getElementById("buyerName").value.trim(),wa=document.getElementById("buyerWa").value.trim();if(!name||!wa)return alert("Silakan isi nama dan nomor WhatsApp.");const d=current.durations[selected],orderId="CX"+Date.now().toString().slice(-8);const text=["Halo CAMXD Store 👋","","Saya ingin order:",`ID Pesanan: ${orderId}`,`Produk: ${current.name}`,`Durasi/Paket: ${d[0]}`,`Total: ${rupiah(d[1])}`,`Nama: ${name}`,`Nomor WA: ${wa}`,"","Mohon konfirmasi pesanan dan kirim tagihan/QRIS GoPay Merchant sesuai total pesanan ini.","Setelah saya bayar, saya akan kirim bukti pembayaran."].join("\n");window.open(`https://wa.me/${STORE_WA}?text=${encodeURIComponent(text)}`,"_blank")}
function contactGeneral(){window.open(`https://wa.me/${STORE_WA}?text=${encodeURIComponent("Halo CAMXD Store, saya ingin bertanya tentang produk.")}`,"_blank")}
renderFilters();render();
