const STORE_WA="6282133942994"; // GANTI dengan nomor WhatsApp toko

const products=[
{name:"KTV Premium",cat:"Premium",icon:"K",desc:"Akses KTV Premium",durations:[["1 Bulan",65000],["3 Bulan",95000],["6 Bulan",150000],["1 Tahun",200000]]},
{name:"YouTube Premium",cat:"Premium",icon:"▶",desc:"YouTube Premium",durations:[["1 Bulan",15000]]},
{name:"Netflix Sharing",cat:"Premium",icon:"N",desc:"Netflix sharing",durations:[["1 Bulan",33000]]},
{name:"CapCut Pro",cat:"Premium",icon:"C",desc:"CapCut Pro sharing",durations:[["1 Bulan",35000]]},
{name:"Canva Premium",cat:"Premium",icon:"Ca",desc:"Canva Premium",durations:[["1 Bulan",25000]]},
{name:"Spotify Premium",cat:"Premium",icon:"S",desc:"Spotify Premium",durations:[["1 Bulan",25000]]},
{name:"Top Up All Games",cat:"Top Up",icon:"★",desc:"Top up berbagai game",durations:[["Mulai dari",10000]]},
{name:"Pembayaran Digital",cat:"Jasa",icon:"Rp",desc:"Bantuan pembayaran digital",durations:[["Mulai dari",5000]]},
{name:"Jasa Pembuatan Sertifikat",cat:"Jasa",icon:"✓",desc:"Sertifikat digital",durations:[["1 Sertifikat",20000],["Laminating +",5000]]}
];

let current=null,selected=0;
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function renderFilters(){const cats=["Semua",...new Set(products.map(p=>p.cat))];document.getElementById("filters").innerHTML=cats.map((c,i)=>`<button class="${i===0?"active":""}" onclick="filter('${c}',this)">${c}</button>`).join("")}
function render(list=products){document.getElementById("count").textContent=`${list.length} produk`;document.getElementById("products").innerHTML=list.map(p=>`<article class="product"><div class="phead"><div class="picon">${p.icon}</div><div><h3>${p.name}</h3><div class="desc">${p.desc}</div></div></div><div class="pfoot"><span class="price">${rupiah(p.durations[0][1])}</span><button class="buy" onclick="openModal(${products.indexOf(p)})">Pilih →</button></div></article>`).join("")}
function filter(cat,el){document.querySelectorAll(".filters button").forEach(x=>x.classList.remove("active"));el.classList.add("active");render(cat==="Semua"?products:products.filter(p=>p.cat===cat))}
function openModal(i){current=products[i];selected=0;document.getElementById("mTitle").textContent=current.name;document.getElementById("mDesc").textContent=current.desc;document.getElementById("durations").innerHTML=current.durations.map((d,j)=>`<div class="duration ${j===0?"selected":""}" onclick="selectDuration(${j},this)"><span>${d[0]}</span><b>${rupiah(d[1])}</b></div>`).join("");document.getElementById("modal").classList.add("show")}
function selectDuration(i,el){selected=i;document.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")}
function closeModal(){document.getElementById("modal").classList.remove("show")}
function orderWhatsApp(){const name=document.getElementById("buyerName").value.trim(),wa=document.getElementById("buyerWa").value.trim();if(!name||!wa)return alert("Silakan isi nama dan nomor WhatsApp.");if(STORE_WA.includes("XXXXXXXX"))return alert("Nomor WhatsApp toko belum diatur. Buka script.js dan ganti STORE_WA.");const d=current.durations[selected];const msg=`Halo CAMXD Store,%0A%0ASaya ingin order:%0AProduk: ${current.name}%0ADurasi: ${d[0]}%0AHarga: ${rupiah(d[1])}%0ANama: ${name}%0ANomor WA: ${wa}`;window.open(`https://wa.me/${STORE_WA}?text=${msg}`,"_blank")}
function contactGeneral(){if(STORE_WA.includes("XXXXXXXX"))return alert("Nomor WhatsApp toko belum diatur di script.js.");window.open(`https://wa.me/${STORE_WA}?text=Halo%20CAMXD%20Store,%20saya%20ingin%20bertanya%20tentang%20produk.`,"_blank")}
renderFilters();render();