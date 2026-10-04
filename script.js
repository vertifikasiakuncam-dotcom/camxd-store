const products = [
 {name:"KTV Premium",cat:"Premium",desc:"Akses KTV Premium",icon:"K",durations:[["1 Bulan",65000],["3 Bulan",95000],["6 Bulan",150000],["1 Tahun",200000]]},
 {name:"YouTube Premium",cat:"Premium",desc:"YouTube tanpa iklan",icon:"▶",durations:[["1 Bulan",15000]]},
 {name:"Netflix Sharing",cat:"Premium",desc:"Akun Netflix sharing",icon:"N",durations:[["1 Bulan",33000]]},
 {name:"CapCut Pro",cat:"Premium",desc:"Fitur Pro CapCut",icon:"C",durations:[["1 Bulan",35000]]},
 {name:"Jasa Pembuatan Sertifikat",cat:"Jasa",desc:"Pembuatan sertifikat digital",icon:"S",durations:[["1 Sertifikat",20000],["+ Laminating",5000]]}
];

let current=null, selected=0;
const rupiah=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(n);
function renderFilters(){
 const cats=["Semua",...new Set(products.map(p=>p.cat))];
 document.getElementById("filters").innerHTML=cats.map((c,i)=>`<button class="${i===0?'active':''}" onclick="filter('${c}',this)">${c}</button>`).join("");
}
function render(list=products){
 document.getElementById("products").innerHTML=list.map((p,i)=>`<article class="card">
 <div class="card-top"><div class="icon">${p.icon}</div><div><h3>${p.name}</h3><p>${p.desc}</p></div></div>
 <div><span class="price">${rupiah(p.durations[0][1])}</span><button class="buy" onclick="openModal(${products.indexOf(p)})">Pilih →</button></div>
 </article>`).join("");
}
function filter(cat,el){
 document.querySelectorAll(".filter button").forEach(x=>x.classList.remove("active"));el.classList.add("active");
 render(cat==="Semua"?products:products.filter(p=>p.cat===cat));
}
function openModal(i){
 current=products[i];selected=0;
 document.getElementById("modalTitle").textContent=current.name;
 document.getElementById("durations").innerHTML=current.durations.map((d,j)=>`<label class="duration ${j===0?'selected':''}" onclick="selectDuration(${j},this)"><span>${d[0]}</span><b>${rupiah(d[1])}</b></label>`).join("");
 document.getElementById("modal").classList.add("show");
}
function selectDuration(i,el){selected=i;document.querySelectorAll(".duration").forEach(x=>x.classList.remove("selected"));el.classList.add("selected")}
function closeModal(){document.getElementById("modal").classList.remove("show")}
function orderWhatsApp(){
 const name=document.getElementById("buyerName").value.trim();
 const wa=document.getElementById("buyerWa").value.trim();
 if(!name||!wa)return alert("Silakan isi nama dan nomor WhatsApp.");
 const d=current.durations[selected];
 const message=`Halo CAMXD Store,%0A%0ASaya ingin membeli:%0AProduk: ${current.name}%0ADurasi: ${d[0]}%0AHarga: ${rupiah(d[1])}%0ANama: ${name}%0ANomor WA: ${wa}`;
 const storeWA="628XXXXXXXXXX"; // GANTI dengan nomor WhatsApp toko
 window.open(`https://wa.me/${storeWA}?text=${message}`,"_blank");
}
function toggleNav(){document.querySelector("nav").classList.toggle("open")}
renderFilters();render();
