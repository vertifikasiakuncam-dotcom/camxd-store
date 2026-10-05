const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s) => document.querySelector(s);

const STATUSES = [
  "Menunggu Pembayaran",
  "Menunggu Verifikasi",
  "Sudah Dibayar",
  "Sedang Diproses",
  "Selesai",
  "Dibatalkan"
];

let allOrders = [];

let seenOrderIds = new Set();
let unreadOrderIds = new Set();
let firstOrderLoad = true;

function updateNewOrderAlert(){
  const pending = allOrders.filter(o =>
    (o.status === "Menunggu Pembayaran" ||
     o.status === "Menunggu Verifikasi") &&
    unreadOrderIds.has(String(o.id))
  );
  const alert = $("#newOrderAlert");
  const count = $("#newOrderCount");
  if(!alert || !count) return;

  count.textContent = pending.length;
  alert.hidden = pending.length === 0;

  alert.onclick = () => {
    $("#statusFilter").value = "all";
    renderOrders();
    pending.forEach(o => unreadOrderIds.delete(String(o.id)));
    alert.hidden = true;
    const first = pending[0];
    if(first){
      const el = document.querySelector('[data-order-id="' + CSS.escape(String(first.order_id)) + '"]');
      el?.scrollIntoView({behavior:"smooth",block:"center"});
    }else{
      window.scrollTo({top: document.querySelector(".panel")?.offsetTop || 0, behavior:"smooth"});
    }
  };
}


const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;",
  "<":"&lt;",
  ">":"&gt;",
  '"':"&quot;",
  "'":"&#039;"
}[c]));

function statusClass(status){
  if(status === "Selesai") return "done";
  if(status === "Sudah Dibayar") return "paid";
  if(status === "Menunggu Verifikasi") return "verify";
  if(status === "Dibatalkan") return "cancel";
  return "waiting";
}

function formatDate(v){
  try {
    return new Date(v).toLocaleString("id-ID", {
      dateStyle:"medium",
      timeStyle:"short"
    });
  } catch {
    return v;
  }
}

async function loadOrders(){
  const {data, error} = await sb
    .from("orders")
    .select("*")
    .order("created_at", {ascending:false});

  if(error){
    console.error(error);

    $("#ordersList").innerHTML =
      `<div class="empty">
        Gagal mengambil pesanan:
        ${escapeHtml(error.message)}
      </div>`;

    return;
  }

  const previousIds = new Set(allOrders.map(o => String(o.id)));
  const nextOrders = data || [];

  if(firstOrderLoad){
    nextOrders.forEach(o => seenOrderIds.add(String(o.id)));
    firstOrderLoad = false;
  }else{
    nextOrders.forEach(o => {
      if(!previousIds.has(String(o.id))){
        unreadOrderIds.add(String(o.id));
      }
    });
  }

  allOrders = nextOrders;

  updateStats();
  renderOrders();
  updateNewOrderAlert();
}

function updateStats(){
  const done = allOrders.filter(
    o => o.status === "Selesai"
  );

  $("#statTotal").textContent = allOrders.length;

  $("#statWaiting").textContent =
    allOrders.filter(
      o => o.status === "Menunggu Pembayaran"
    ).length;

  $("#statVerify").textContent =
    allOrders.filter(
      o => o.status === "Menunggu Verifikasi"
    ).length;

  const process = allOrders.filter(o => o.status === "Sedang Diproses");
  const revenue = done.reduce((s,o) => s + Number(o.total || 0),0);

  $("#statProcess").textContent = process.length;
  $("#statDone").textContent = done.length;
  $("#statRevenue").textContent = rupiah(revenue);
  const average = done.length > 0 ? Math.round(revenue / done.length) : 0;
  $("#statAverage").textContent = rupiah(average);

  renderOverview();
  updateNewOrderAlert();
}

function getFilteredOrders(){
  const q=($("#orderSearch")?.value||"").trim().toLowerCase();
  const from=$("#dateFrom")?.value||"";
  const to=$("#dateTo")?.value||"";
  return allOrders.filter(o=>{
    const text=[o.order_id,o.customer_name,o.customer_wa].join(" ").toLowerCase();
    const day=String(o.created_at||"").slice(0,10);
    return (!q||text.includes(q)) && (!from||day>=from) && (!to||day<=to);
  });
}

function renderOverview(){
  const filtered=getFilteredOrders();
  const done=filtered.filter(o=>o.status==="Selesai");
  const revenue=done.reduce((s,o)=>s+Number(o.total||0),0);
  const seven=document.querySelector("#sevenDayRevenue");
  if(seven) seven.textContent=rupiah(revenue);

  const byProduct={};
  done.forEach(o=>{
    (Array.isArray(o.items)?o.items:[]).forEach(x=>{
      const name=x.name||"Produk";
      byProduct[name]=(byProduct[name]||0)+Number(x.qty||1);
    });
  });
  const top=Object.entries(byProduct).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const topName=document.querySelector("#topProductName");
  if(topName) topName.textContent=top[0]?.[0]||"-";
  const topBox=document.querySelector("#topProducts");
  if(topBox) topBox.innerHTML=top.length?top.map(([name,count],i)=>`<div class="top-product-row"><span><b>${i+1}</b> ${escapeHtml(name)}</span><strong>${count} terjual</strong></div>`).join(""):"<span class='muted'>Belum ada penjualan selesai.</span>";

  const bars=document.querySelector("#revenueBars");
  if(bars){
    const now=new Date();
    const days=[];
    for(let i=6;i>=0;i--){
      const d=new Date(now); d.setHours(0,0,0,0); d.setDate(d.getDate()-i);
      const key=d.toLocaleDateString("en-CA");
      const val=done.filter(o=>{
        const od=new Date(o.created_at);
        return od.toLocaleDateString("en-CA")===key;
      }).reduce((s,o)=>s+Number(o.total||0),0);
      days.push({key,val,label:d.toLocaleDateString("id-ID",{weekday:"short"})});
    }
    const max=Math.max(1,...days.map(x=>x.val));
    bars.innerHTML=days.map(x=>`<div class="bar-wrap" title="${x.label}: ${rupiah(x.val)}"><div class="bar" style="height:${Math.max(5,(x.val/max)*100)}%"></div><span>${x.label}</span></div>`).join("");
  }
}

function buildWhatsAppUrl(order, details){

  const wa = String(
    order.customer_wa || ""
  ).replace(/\D/g, "");

  if(!wa) return "#";

  const number =
    wa.startsWith("62")
      ? wa
      : ("62" + wa.replace(/^0/,""));

  const items =
    Array.isArray(order.items)
      ? order.items
      : [];

  const itemText =
    items.map((x,i) =>
      `${i+1}. ${x.name} — ${x.plan} x${Number(x.qty||1)}`
    ).join("\n");

  const message = [
    `Halo ${order.customer_name || ""},`,
    ``,
    `Pesanan CAMXD Store Anda sudah diproses.`,
    `ID Pesanan: ${order.order_id}`,
    ``,
    `Produk:`,
    itemText,
    ``,
    `Total: ${order.total_label || rupiah(order.total)}`,
    ``,
    `Detail produk/akun:`,
    details || "(detail belum diisi)",
    ``,
    `Terima kasih telah berbelanja di CAMXD Store.`
  ].join("\n");

  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function renderOrders(){

  const filter=$("#statusFilter").value;
  const base=filter==="all"?allOrders:allOrders.filter(o=>o.status===filter);
  const query=($("#orderSearch")?.value||"").trim().toLowerCase();
  const from=$("#dateFrom")?.value||"";
  const to=$("#dateTo")?.value||"";
  const orders=base.filter(o=>{
    const text=[o.order_id,o.customer_name,o.customer_wa].join(" ").toLowerCase();
    const day=String(o.created_at||"").slice(0,10);
    return (!query||text.includes(query)) && (!from||day>=from) && (!to||day<=to);
  });

  if(!orders.length){

    $("#ordersList").innerHTML =
      `<div class="empty">
        Belum ada pesanan pada filter ini.
      </div>`;

    return;
  }

  $("#ordersList").innerHTML =
    orders.map(o => {

      const items =
        Array.isArray(o.items)
          ? o.items
          : [];

      const wa =
        String(o.customer_wa || "")
        .replace(/\D/g, "");

      const waNumber =
        wa.startsWith("62")
          ? wa
          : ("62" + wa.replace(/^0/,""));

      const waUrl =
        wa
          ? `https://wa.me/${waNumber}`
          : "#";

      return `
      <article class="order-card" data-order-id="${escapeHtml(o.order_id)}">

        <div class="order-top">

          <div>
            <strong class="order-id">
              ${escapeHtml(o.order_id)}
            </strong>

            <span class="date">
              ${escapeHtml(formatDate(o.created_at))}
            </span>
          </div>

          <span class="status ${statusClass(o.status)}">
            ${escapeHtml(o.status)}
          </span>

        </div>

        <div class="customer">

          <strong>
            ${escapeHtml(o.customer_name)}
          </strong>

          <span>
            ${escapeHtml(o.customer_wa)}
          </span>

        </div>

        <div class="items">

          ${items.map(x => `

            <div class="item-line">

              <span>
                ${escapeHtml(x.name)}
                —
                ${escapeHtml(x.plan)}
                × ${Number(x.qty||1)}
              </span>

              <b>
                ${
                  Number(x.price||0)
                  ? rupiah(
                      Number(x.price||0) *
                      Number(x.qty||1)
                    )
                  : "Konfirmasi admin"
                }
              </b>

            </div>

          `).join("")}

        </div>

        <div class="delivery-box">

          <label>
            Detail produk / akun / kode
          </label>

          <textarea
            class="delivery-input"
            data-id="${o.id}"
            rows="5"
            placeholder="Contoh:
Email: pelanggan@email.com
Password: ********
Kode: ABCD-EFGH
Masa aktif: 30 hari"
          >${escapeHtml(o.delivery_details || "")}</textarea>

          <div class="delivery-actions">

            <button
              class="btn save-detail"
              data-id="${o.id}">
              💾 Simpan Detail
            </button>

            <a
              class="btn wa"
              target="_blank"
              rel="noopener"
              href="${waUrl}">
              📱 WhatsApp
            </a>

            <button
              class="btn send-wa"
              data-id="${o.id}">
              📤 Simpan & Kirim WhatsApp
            </button>

          </div>

          <small class="delivery-note">
            Simpan detail terlebih dahulu agar data
            tetap tersimpan di pesanan.
          </small>

        </div>

        <div class="order-bottom">

          <div>

            <small>
              Total
            </small>

            <strong>
              ${escapeHtml(
                o.total_label ||
                rupiah(o.total)
              )}
            </strong>

          </div>

          <div class="actions">

            <a
              class="btn wa"
              target="_blank"
              rel="noopener"
              href="${waUrl}">
              WhatsApp
            </a>

            <select
              class="status-select"
              data-id="${o.id}">

              ${STATUSES.map(s =>
                `<option ${
                  s === o.status
                    ? "selected"
                    : ""
                }>${s}</option>`
              ).join("")}

            </select>

          </div>

        </div>

      </article>
      `;

    }).join("");

  document
    .querySelectorAll(".status-select")
    .forEach(el => {

      el.addEventListener(
        "change",
        () =>
          updateStatus(
            Number(el.dataset.id),
            el.value
          )
      );

    });

  document
    .querySelectorAll(".save-detail")
    .forEach(el => {

      el.addEventListener(
        "click",
        () =>
          saveDelivery(
            Number(el.dataset.id),
            false
          )
      );

    });

  document
    .querySelectorAll(".send-wa")
    .forEach(el => {

      el.addEventListener(
        "click",
        () =>
          saveDelivery(
            Number(el.dataset.id),
            true
          )
      );

    });
}

function getDeliveryValue(id){

  const input =
    document.querySelector(
      `.delivery-input[data-id="${id}"]`
    );

  return input
    ? input.value.trim()
    : "";
}

async function saveDelivery(id, sendAfter){

  const details =
    getDeliveryValue(id);

  const order =
    allOrders.find(
      o => Number(o.id) === Number(id)
    );

  if(!order) return;

  if(!details){

    alert(
      "Isi detail produk/akun/kode terlebih dahulu."
    );

    return;
  }

  // Simpan detail produk dan waktu pengiriman
  const {error: detailError} =
    await sb
      .from("orders")
      .update({
        delivery_details: details,
        delivered_at: new Date().toISOString()
      })
      .eq("id", id);

  if(detailError){

    alert(
      "Gagal menyimpan detail: " +
      detailError.message
    );

    return;
  }

  // Jika tombol "Simpan & Kirim WhatsApp" ditekan,
  // otomatis ubah status menjadi Selesai
  if(sendAfter){

    const {error: statusError} =
      await sb
        .from("orders")
        .update({
          status: "Selesai"
        })
        .eq("id", id);

    if(statusError){

      alert(
        "Detail sudah tersimpan, tetapi status gagal diubah: " +
        statusError.message
      );

      return;
    }

    order.delivery_details = details;
    order.delivered_at = new Date().toISOString();
    order.status = "Selesai";

    const url =
      buildWhatsAppUrl(
        order,
        details
      );

    if(url === "#"){

      alert(
        "Detail sudah disimpan dan status menjadi Selesai, tetapi nomor WhatsApp pelanggan tidak valid."
      );

      await loadOrders();
      return;
    }

    // Refresh data sebelum membuka WhatsApp
    await loadOrders();

    // Buka WhatsApp
    window.location.href = url;

    return;
  }

  order.delivery_details = details;
  order.delivered_at = new Date().toISOString();

  alert(
    "Detail produk berhasil disimpan."
  );

  renderOrders();
}

async function updateStatus(id, status){

  const {error} =
    await sb
      .from("orders")
      .update({status})
      .eq("id", id);

  if(error){

    alert(
      "Gagal mengubah status: " +
      error.message
    );

    await loadOrders();

    return;
  }

  await loadOrders();
}

async function login(e){

  e.preventDefault();

  $("#loginError").textContent = "";

  const email =
    $("#email").value.trim();

  const password =
    $("#password").value;

  const {error} =
    await sb.auth.signInWithPassword({
      email,
      password
    });

  if(error){

    $("#loginError").textContent =
      error.message;

    return;
  }

  await showDashboard();
}

async function showDashboard(){

  const {
    data:{user}
  } =
    await sb.auth.getUser();

  if(!user){

    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;

    return;
  }

  const {
    data:admin,
    error
  } =
    await sb
      .from("admin_users")
      .select(
        "user_id,email,role"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if(error || !admin){

    await sb.auth.signOut();

    $("#loginError").textContent =
      "Akun ini belum memiliki akses admin.";

    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;

    return;
  }

  $("#adminEmail").textContent =
    admin.email ||
    user.email ||
    "";

  $("#loginView").hidden = true;
  $("#dashboardView").hidden = false;

  await loadOrders();
}

async function logout(){

  await sb.auth.signOut();

  $("#dashboardView").hidden = true;
  $("#loginView").hidden = false;

  $("#password").value = "";
}

$("#loginForm")
  .addEventListener(
    "submit",
    login
  );

$("#logoutBtn")
  .addEventListener(
    "click",
    logout
  );

$("#refreshBtn")
  .addEventListener(
    "click",
    loadOrders
  );

$("#statusFilter")
  .addEventListener(
    "change",
    renderOrders
  );

sb.auth.onAuthStateChange(
  (_event, _session) => {
    // Session changes are handled
    // by showDashboard after login/logout.
  }
);

let orderPollingTimer = null;

function startOrderPolling(){
  clearInterval(orderPollingTimer);
  orderPollingTimer = setInterval(async()=>{
    if(!document.hidden) await loadOrders();
  }, 30000);
}

showDashboard();
startOrderPolling();


/* ==============================
   PRODUCT MANAGEMENT
============================== */

let allProducts = [];
let editingProductId = null;

function resetProductForm(){
  editingProductId = null;
  $("#productDbId").value = "";
  $("#productKey").value = "";
  $("#productName").value = "";
  $("#productCategory").value = "premium";
  $("#productBadge").value = "";
  $("#productDescription").value = "";
  $("#productImage").value = "";
  $("#productImageFile").value = "";
  selectedProductFile = null;
  $("#productImagePreview").innerHTML = "<span>Belum ada preview</span>";
  $("#productDetail").value = "";
  $("#productSort").value = "10";
  $("#productActive").checked = true;
  $("#editorHeading").textContent = "Tambah Produk";
  $("#productFormError").textContent = "";
  $("#plansEditorList").innerHTML = "";
  addPlanRow("", "", true);
}

function addPlanRow(name="", price="", active=true){
  const wrap = document.createElement("div");
  wrap.className = "plan-edit-row";
  wrap.innerHTML = `
    <input class="plan-name" placeholder="Nama paket" value="${escapeHtml(name)}">
    <input class="plan-price" type="number" min="0" placeholder="Harga" value="${price}">
    <label class="plan-active"><input type="checkbox" class="plan-active-check" ${active ? "checked" : ""}> Aktif</label>
    <button type="button" class="btn danger remove-plan">Hapus</button>
  `;
  wrap.querySelector(".remove-plan").onclick = () => wrap.remove();
  $("#plansEditorList").appendChild(wrap);
}

async function loadProductsAdmin(){
  const {data, error} = await sb
    .from("products")
    .select("*")
    .order("sort_order",{ascending:true})
    .order("name",{ascending:true});

  if(error){
    $("#productsList").innerHTML = `<div class="empty">Gagal mengambil produk: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allProducts = data || [];

  const {data:plans, error:planError} = await sb
    .from("product_plans")
    .select("*")
    .order("sort_order",{ascending:true});

  if(planError){
    $("#productsList").innerHTML = `<div class="empty">Gagal mengambil paket: ${escapeHtml(planError.message)}</div>`;
    return;
  }

  allProducts.forEach(p => {
    p.plans = (plans || []).filter(x => Number(x.product_id) === Number(p.id));
  });

  renderProductsAdmin();
}

function renderProductsAdmin(){
  if(!allProducts.length){
    $("#productsList").innerHTML = '<div class="empty">Belum ada produk.</div>';
    return;
  }

  $("#productsList").innerHTML = allProducts.map(p => {
    const activePlans = (p.plans || []).filter(x=>x.is_active);
    const firstPrice = activePlans.length ? Number(activePlans[0].price||0) : 0;
    return `
      <article class="admin-product-card ${p.is_active ? "" : "inactive"}">
        <div class="admin-product-image">
          <img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" loading="lazy">
        </div>
        <div class="admin-product-main">
          <div class="admin-product-top">
            <div>
              <span class="admin-product-badge">${escapeHtml(p.badge || "PRODUK")}</span>
              <h3>${escapeHtml(p.name)}</h3>
              <p>${escapeHtml(p.description)}</p>
            </div>
            <span class="product-state ${p.is_active ? "on" : "off"}">${p.is_active ? "AKTIF" : "NONAKTIF"}</span>
          </div>
          <div class="admin-product-meta">
            <span>Kunci: <b>${escapeHtml(p.product_key)}</b></span>
            <span>${activePlans.length} paket aktif</span>
            <span>Mulai: <b>${firstPrice ? rupiah(firstPrice) : "Sesuai kebutuhan"}</b></span>
          </div>
          <div class="admin-product-actions">
            <button class="btn edit-product" data-id="${p.id}">✏️ Edit</button>
            <button class="btn toggle-product" data-id="${p.id}" data-active="${p.is_active}">${p.is_active ? "⏸ Nonaktifkan" : "▶ Aktifkan"}</button>
            <button class="btn danger delete-product" data-id="${p.id}">🗑 Hapus</button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  document.querySelectorAll(".edit-product").forEach(b => b.onclick=()=>editProduct(Number(b.dataset.id)));
  document.querySelectorAll(".toggle-product").forEach(b => b.onclick=()=>toggleProduct(Number(b.dataset.id), b.dataset.active !== "true"));
  document.querySelectorAll(".delete-product").forEach(b => b.onclick=()=>deleteProduct(Number(b.dataset.id)));
}

function editProduct(id){
  const p = allProducts.find(x=>Number(x.id)===Number(id));
  if(!p) return;

  editingProductId = Number(id);
  $("#productDbId").value = p.id;
  $("#productKey").value = p.product_key || "";
  $("#productName").value = p.name || "";
  $("#productCategory").value = p.category || "premium";
  $("#productBadge").value = p.badge || "";
  $("#productDescription").value = p.description || "";
  $("#productImage").value = p.image_url || "";
  selectedProductFile = null;
  $("#productImageFile").value = "";
  renderProductImagePreview(p.image_url || "");
  $("#productDetail").value = p.detail || "";
  $("#productSort").value = p.sort_order ?? 0;
  $("#productActive").checked = !!p.is_active;
  $("#editorHeading").textContent = "Edit Produk";
  $("#productFormError").textContent = "";
  $("#plansEditorList").innerHTML = "";

  (p.plans || []).forEach(x=>addPlanRow(x.plan_name, x.price, x.is_active));
  if(!(p.plans || []).length) addPlanRow("", "", true);

  $("#productEditor").hidden = false;
  window.scrollTo({top:0,behavior:"smooth"});
}

function renderProductImagePreview(url){
  const box = $("#productImagePreview");
  if(!url){
    box.innerHTML = "<span>Belum ada preview</span>";
    return;
  }
  box.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview gambar produk">`;
}

async function uploadProductImage(file, productKey){
  if(!file) return null;

  const allowed = ["image/jpeg","image/png","image/webp","image/gif"];
  if(!allowed.includes(file.type)){
    throw new Error("Format gambar harus JPG, PNG, WEBP, atau GIF.");
  }

  if(file.size > 5 * 1024 * 1024){
    throw new Error("Ukuran gambar maksimal 5 MB.");
  }

  const safeKey = productKey.replace(/[^a-z0-9_-]/g,"-");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${safeKey}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

  const {error} = await sb.storage
    .from("product-images")
    .upload(path, file, {
      cacheControl: "31536000",
      upsert: false,
      contentType: file.type
    });

  if(error) throw error;

  const {data} = sb.storage
    .from("product-images")
    .getPublicUrl(path);

  if(!data?.publicUrl){
    throw new Error("URL gambar tidak berhasil dibuat.");
  }

  return data.publicUrl;
}

async function saveProduct(){
  const err = $("#productFormError");
  err.textContent = "";

  const productKey = $("#productKey").value.trim().toLowerCase();
  const name = $("#productName").value.trim();
  const category = $("#productCategory").value;
  const badge = $("#productBadge").value.trim();
  const description = $("#productDescription").value.trim();
  let image_url = $("#productImage").value.trim();
  const detail = $("#productDetail").value.trim();
  const sort_order = Number($("#productSort").value || 0);
  const is_active = $("#productActive").checked;

  if(!productKey || !name){
    err.textContent = "Kunci Produk dan Nama Produk wajib diisi.";
    return;
  }

  const planRows = [...document.querySelectorAll(".plan-edit-row")].map((row,i)=>({
    plan_name: row.querySelector(".plan-name").value.trim(),
    price: Number(row.querySelector(".plan-price").value || 0),
    is_active: row.querySelector(".plan-active-check").checked,
    sort_order: i+1
  })).filter(x=>x.plan_name);

  if(!planRows.length){
    err.textContent = "Tambahkan minimal 1 paket.";
    return;
  }

  $("#saveProductBtn").disabled = true;

  try{
    let productId = editingProductId;

    if(selectedProductFile){
      err.textContent = "Mengupload gambar...";
      image_url = await uploadProductImage(selectedProductFile, productKey);
    }

    const payload = {
      product_key: productKey,
      name,
      description,
      category,
      image_url,
      badge,
      detail,
      is_active,
      sort_order
    };

    if(productId){
      const {error} = await sb.from("products").update(payload).eq("id",productId);
      if(error) throw error;
    }else{
      const {data,error} = await sb.from("products").insert(payload).select("id").single();
      if(error) throw error;
      productId = data.id;
    }

    const {error:deletePlansError} = await sb.from("product_plans").delete().eq("product_id",productId);
    if(deletePlansError) throw deletePlansError;

    const {error:insertPlansError} = await sb.from("product_plans").insert(
      planRows.map(x=>({...x,product_id:productId}))
    );
    if(insertPlansError) throw insertPlansError;

    alert("Produk berhasil disimpan.");
    $("#productEditor").hidden = true;
    resetProductForm();
    await loadProductsAdmin();
  }catch(e){
    console.error(e);
    err.textContent = "Gagal menyimpan: " + e.message;
  }finally{
    $("#saveProductBtn").disabled = false;
  }
}

async function toggleProduct(id, active){
  const p = allProducts.find(x=>Number(x.id)===Number(id));
  if(!p) return;

  const action = active ? "mengaktifkan" : "menonaktifkan";
  if(!confirm(`Yakin ingin ${action} "${p.name}"?`)) return;

  const {error} = await sb.from("products").update({is_active:active}).eq("id",id);
  if(error){
    alert("Gagal: " + error.message);
    return;
  }
  await loadProductsAdmin();
}

async function deleteProduct(id){
  const p = allProducts.find(x=>Number(x.id)===Number(id));
  if(!p) return;

  if(!confirm(`Hapus produk "${p.name}"? Semua paket harga produk ini juga akan dihapus. Pesanan lama tetap aman karena datanya tersimpan di orders.`)) return;

  const {error} = await sb.from("products").delete().eq("id",id);
  if(error){
    alert("Gagal menghapus: " + error.message);
    return;
  }
  alert("Produk berhasil dihapus.");
  await loadProductsAdmin();
}

function showProductsPanel(){
  $("#productsPanel").hidden = false;
  $(".orders-panel").hidden = true;
  $("#productsBtn").textContent = "🛍️ Produk Aktif";
  loadProductsAdmin();
  window.scrollTo({top:0,behavior:"smooth"});
}

function showOrdersPanel(){
  $("#productsPanel").hidden = true;
  $(".orders-panel").hidden = false;
  $("#productsBtn").textContent = "🛍️ Kelola Produk";
  loadOrders();
  window.scrollTo({top:0,behavior:"smooth"});
}

$("#productsBtn").addEventListener("click",showProductsPanel);
$("#backOrdersBtn").addEventListener("click",showOrdersPanel);
$("#newProductBtn").addEventListener("click",()=>{
  resetProductForm();
  $("#productEditor").hidden = false;
  window.scrollTo({top:0,behavior:"smooth"});
});
$("#cancelProductBtn").addEventListener("click",()=>{
  $("#productEditor").hidden = true;
  resetProductForm();
});
$("#addPlanBtn").addEventListener("click",()=>addPlanRow("", "", true));
$("#saveProductBtn").addEventListener("click",saveProduct);

$("#productImageFile").addEventListener("change",(e)=>{
  const file = e.target.files?.[0] || null;
  selectedProductFile = file;

  if(!file){
    renderProductImagePreview($("#productImage").value.trim());
    return;
  }

  if(file.size > 5 * 1024 * 1024){
    alert("Ukuran gambar maksimal 5 MB.");
    e.target.value = "";
    selectedProductFile = null;
    return;
  }

  const url = URL.createObjectURL(file);
  $("#productImagePreview").innerHTML = `<img src="${url}" alt="Preview gambar baru">`;
});

$("#productImage").addEventListener("input",()=>{
  if(!selectedProductFile){
    renderProductImagePreview($("#productImage").value.trim());
  }
});

resetProductForm();


function exportOrdersCsv(){
  const orders=getFilteredOrders();
  if(!orders.length){ alert("Tidak ada pesanan untuk diekspor."); return; }

  const rows=[[
    "ID Pesanan","Tanggal","Nama","WhatsApp","Status","Produk","Total","Detail Pengiriman"
  ]];

  orders.forEach(o=>{
    const items=Array.isArray(o.items)?o.items:[];
    const products=items.map(x =>
      (x.name||"Produk")+" - "+(x.plan||"")+" x"+Number(x.qty||1)
    ).join(" | ");

    const d=new Date(o.created_at);
    const date=Number.isNaN(d.getTime()) ? (o.created_at||"") :
      d.toLocaleString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});

    rows.push([
      String(o.order_id||""),
      date,
      String(o.customer_name||""),
      String(o.customer_wa||""),
      String(o.status||""),
      products,
      o.total_label || rupiah(o.total),
      String(o.delivery_details||"")
    ]);
  });

  const safeText=v=>{
    const value=String(v??"");
    return /^[-+@=]/.test(value) ? "'"+value : value;
  };

  const csv="\ufeff"+rows.map(row=>row.map(v=>{
    const value=safeText(v);
    return "\""+value.replace(/\"/g,"\"\"")+"\"";
  }).join(",")).join("\r\n");

  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob);
  const link=document.createElement("a");
  link.href=url;
  link.download="CAMXD-Store-Laporan-"+new Date().toISOString().slice(0,10)+".csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

$("#exportCsvBtn")?.addEventListener("click",exportOrdersCsv);
$("#orderSearch")?.addEventListener("input",renderOrders);
$("#dateFrom")?.addEventListener("change",renderOrders);
$("#dateTo")?.addEventListener("change",renderOrders);
$("#clearFiltersBtn")?.addEventListener("click",()=>{
  $("#orderSearch").value="";
  $("#dateFrom").value="";
  $("#dateTo").value="";
  renderOrders();
  renderOverview();
});
