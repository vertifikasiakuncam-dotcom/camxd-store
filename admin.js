function updateAdminConnectionStatus(online, polling=false){
  const box=$("#adminConnectionStatus");
  if(!box) return;
  box.classList.toggle("online", !!online);
  box.classList.toggle("offline", !online);
  box.classList.toggle("polling", !!polling);
  const label=box.querySelector(".connection-label");
  if(label) label.textContent = online ? (polling ? "Online • Auto cek aktif" : "Online") : "Offline";
}

function normalizeRefreshButton(){
  const btn=$("#refreshBtn");
  if(!btn) return;
  btn.innerHTML='<span class="refresh-icon" aria-hidden="true">↻</span> <span class="refresh-label">Refresh</span>';
  btn.classList.remove("is-working");
  btn.dataset.working="0";
}
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s) => document.querySelector(s);

function showAdminToast(title, message){
  let toast = document.getElementById("adminToast");
  if(!toast){
    toast = document.createElement("div");
    toast.id = "adminToast";
    toast.className = "admin-toast";
    document.body.appendChild(toast);
  }
  toast.innerHTML =
    '<strong>' + escapeHtml(title) + '</strong>' +
    '<span>' + escapeHtml(message) + '</span>';
  toast.classList.add("show");
  clearTimeout(showAdminToast.timer);
  showAdminToast.timer = setTimeout(() => toast.classList.remove("show"), 4500);
}

const STATUSES = [
  "Menunggu Pembayaran",
  "Menunggu Verifikasi",
  "Sudah Dibayar",
  "Sedang Diproses",
  "Selesai",
  "Dibatalkan"
];

let allOrders = [];
let selectedOrderIds = new Set();

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
  const markBtn = $("#markOrdersReadBtn");
  if(!alert || !count) return;

  count.textContent = pending.length;
  alert.hidden = false;

  if(markBtn){
    markBtn.hidden = false;
    markBtn.disabled = pending.length === 0;
    markBtn.setAttribute("aria-disabled", pending.length === 0 ? "true" : "false");
    markBtn.onclick = () => {
      if(!pending.length) return;
      pending.forEach(o => unreadOrderIds.delete(String(o.id)));
      updateNewOrderAlert();
    };
  }

  alert.onclick = () => {
    if(!pending.length) return;
    $("#statusFilter").value = "all";
    renderOrders();
    const first = pending[0];
    if(first){
      const el = document.querySelector('[data-order-id="' + CSS.escape(String(first.order_id)) + '"]');
      el?.scrollIntoView({behavior:"smooth",block:"center"});
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

function playNewOrderAlert(){
  try{
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if(!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const playTone = (start, frequency) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    };
    if(ctx.state === "suspended") ctx.resume().catch(()=>{});
    const start = ctx.currentTime + 0.03;
    playTone(start, 880);
    playTone(start + 0.25, 1175);
    setTimeout(()=>ctx.close().catch(()=>{}), 800);
  }catch{}
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
    const newlyArrived = nextOrders.filter(o => !previousIds.has(String(o.id)));
    newlyArrived.forEach(o => unreadOrderIds.add(String(o.id)));

    if(newlyArrived.length){
      const pendingNew = newlyArrived.filter(o =>
        o.status === "Menunggu Pembayaran" ||
        o.status === "Menunggu Verifikasi"
      );
      if(pendingNew.length){
        showAdminToast(
          "🔔 Pesanan baru masuk",
          pendingNew.length === 1
            ? (pendingNew[0].order_id + " • " + (pendingNew[0].customer_name || "Pelanggan"))
            : pendingNew.length + " pesanan baru perlu diperiksa"
        );

        if("vibrate" in navigator){
          try{ navigator.vibrate([120,60,120]); }catch{}
        }
        playNewOrderAlert();

        if("Notification" in window && Notification.permission === "granted"){
          try{
            new Notification("CAMXD Store — Pesanan Baru", {
              body: pendingNew.length === 1
                ? pendingNew[0].order_id + " • " + (pendingNew[0].customer_name || "Pelanggan")
                : pendingNew.length + " pesanan baru perlu diperiksa"
            });
          }catch{}
        }
      }
    }
  }

  allOrders = nextOrders;
  updateAdminConnectionStatus(true, true);

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

  const todayKey = new Date().toLocaleDateString("en-CA");
  const todayOrders = allOrders.filter(o => String(o.created_at || "").slice(0,10) === todayKey);
  const todayRevenue = todayOrders
    .filter(o => o.status === "Selesai")
    .reduce((s,o) => s + Number(o.total || 0), 0);
  if($("#statToday")) $("#statToday").textContent = todayOrders.length;
  if($("#statTodayRevenue")) $("#statTodayRevenue").textContent = rupiah(todayRevenue);

  const completedRate = allOrders.length
    ? Math.round((done.length / allOrders.length) * 100)
    : 0;
  if($("#statCompletion")) $("#statCompletion").textContent = completedRate + "%";

  const pendingValue = allOrders
    .filter(o => !["Selesai","Dibatalkan"].includes(o.status))
    .reduce((s,o) => s + Number(o.total || 0), 0);
  if($("#statPendingValue")) $("#statPendingValue").textContent = rupiah(pendingValue);

  renderOverview();
  updateNewOrderAlert();
}

function getFilteredOrders(){
  const q=($("#orderSearch")?.value||"").trim().toLowerCase();
  const from=$("#dateFrom")?.value||"";
  const to=$("#dateTo")?.value||"";
  return allOrders.filter(o=>{
    const text=[o.order_id,o.customer_name,o.customer_wa,...(Array.isArray(o.items)?o.items.map(x=>x.name||""):[])].join(" ").toLowerCase();
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

  const wa = String(order.customer_wa || "").replace(/\D/g, "");
  if(!wa) return "#";

  const number = wa.startsWith("62") ? wa : ("62" + wa.replace(/^0/,""));
  const items = Array.isArray(order.items) ? order.items : [];
  const itemText = items.map((x,i) =>
    "   " + (i+1) + ". " + (x.name || "Produk") + " — " + (x.plan || "Paket") + " ×" + Number(x.qty || 1)
  ).join("\n");

  const message = [
    "Halo " + (order.customer_name || "Kak") + " \u{1F44B}",
    "",
    "==================",
    "\u{1F6CD}\u{FE0F} CAMXD STORE",
    "\u{1F4E6} PESANAN SELESAI",
    "==================",
    "",
    "\u{1F194} ID Pesanan : " + order.order_id,
    "\u{1F4CC} Status     : Selesai \u{2705}",
    "",
    "\u{1F6D2} DETAIL PESANAN",
    itemText || "   1. Pesanan CAMXD Store",
    "",
    "\u{1F4B0} TOTAL PEMBAYARAN",
    "   " + (order.total_label || rupiah(order.total)),
    "",
    "\u{1F510} DETAIL PRODUK / AKUN",
    details || "Email: -\nPassword: -\nKode: -\nMasa aktif: -",
    "",
    "==================",
    "\u{1F4CC} Mohon simpan informasi akun/kode ini dengan baik.",
    "",
    "Terima kasih telah berbelanja di CAMXD Store \u{1F64F}",
    "Jika ada kendala, silakan hubungi admin kami.",
    "",
    "— CAMXD STORE —"
  ].join("\n");

  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}

function updateBulkDeleteUi(){
  const btn=$("#bulkDeleteOrdersBtn");
  const selectAll=$("#selectAllOrdersBtn");
  if(btn){
    btn.disabled=selectedOrderIds.size===0;
    btn.textContent="🗑️ Hapus Terpilih ("+selectedOrderIds.size+")";
  }
  if(selectAll){
    const eligible=allOrders.filter(o=>!["Selesai"].includes(o.status)).length;
    selectAll.disabled=eligible===0;
    selectAll.textContent=eligible && selectedOrderIds.size===eligible ? "☑️ Batalkan Pilih Semua" : "☑️ Pilih Semua (kecuali Selesai)";
  }
}

async function bulkDeleteOrders(){
  const ids=[...selectedOrderIds].map(Number);
  if(!ids.length) return;
  const orders=allOrders.filter(o=>ids.includes(Number(o.id)) && o.status!=="Selesai");
  if(!orders.length) return;
  const ok=confirm("HAPUS "+orders.length+" PESANAN SECARA PERMANEN?\n\nPesanan yang dipilih (kecuali Selesai) akan dihapus dari database.\nTindakan ini tidak bisa dibatalkan.");
  if(!ok) return;

  const btn=$("#bulkDeleteOrdersBtn");
  if(btn){btn.disabled=true;btn.textContent="⏳ Menghapus...";}
  const results=await Promise.all(orders.map(async o=>{
    const {data,error}=await sb.rpc("delete_orders_admin_bulk",{p_order_ids:[Number(o.id)]});
    return {o,data,error};
  }));
  const failed=results.filter(r=>r.error || Number(r.data)!==1);
  const deletedIds=results.filter(r=>!r.error && Number(r.data)===1).map(r=>String(r.o.id));
  selectedOrderIds=new Set([...selectedOrderIds].filter(id=>!deletedIds.includes(String(id))));
  allOrders=allOrders.filter(o=>!deletedIds.includes(String(o.id)));
  if(failed.length) alert("Sebagian pesanan gagal dihapus: "+failed.length+" pesanan.");
  else alert(orders.length+" pesanan berhasil dihapus.");
  updateStats();
  renderOrders();
}

function renderOrders(){

  const filter=$("#statusFilter").value;
  const base=filter==="all"?allOrders:allOrders.filter(o=>o.status===filter);
  const query=($("#orderSearch")?.value||"").trim().toLowerCase();
  const from=$("#dateFrom")?.value||"";
  const to=$("#dateTo")?.value||"";
  const orders=base.filter(o=>{
    const text=[o.order_id,o.customer_name,o.customer_wa,...(Array.isArray(o.items)?o.items.map(x=>x.name||""):[])].join(" ").toLowerCase();
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
      <article class="order-card" data-order-id="${escapeHtml(o.order_id)}">\n        <label class="order-select">\n          <input type="checkbox" class="order-check" data-id="${o.id}" ${o.status !== "Selesai" ? "" : "disabled"} ${selectedOrderIds.has(String(o.id)) ? "checked" : ""}>\n          <span>${o.status !== "Selesai" ? "Pilih untuk dihapus" : "Pesanan Selesai tidak dapat dihapus"}</span>\n        </label>

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

        <div class="customer order-customer">
          <div class="customer-avatar">
            ${escapeHtml((o.customer_name || "?").trim().charAt(0).toUpperCase())}
          </div>
          <div class="customer-main">
            <strong>${escapeHtml(o.customer_name)}</strong>
            <span>📱 ${escapeHtml(o.customer_wa)}</span>
          </div>
          <div class="order-item-count">
            ${items.length} produk
          </div>
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

        <details class="delivery-details" ${o.delivery_details ? "open" : ""}>
          <summary>
            <span>\u{1F510} Detail Produk / Akun</span>
            <small>${o.delivery_details ? "Tersimpan" : "Belum diisi"}</small>
          </summary>

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


        </details>
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

            <button
              class="btn danger delete-order"
              data-id="${o.id}">
              🗑️ Hapus
            </button>

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

  document.querySelectorAll(".order-check").forEach(el=>{ el.addEventListener("change",()=>{ const id=String(el.dataset.id); if(el.checked) selectedOrderIds.add(id); else selectedOrderIds.delete(id); updateBulkDeleteUi(); }); });

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
    .querySelectorAll(".delete-order")
    .forEach(el => {
      el.addEventListener("click", () => deleteOrder(Number(el.dataset.id)));
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

      el.addEventListener("click", () => {
        const order = allOrders.find(o => Number(o.id) === Number(el.dataset.id));
        if(!order) return;

        const ok = confirm(
          "Kirim pesanan melalui WhatsApp?\n\n" +
          "ID: " + (order.order_id || "-") + "\n" +
          "Pelanggan: " + (order.customer_name || "-") + "\n" +
          "Status akan diubah menjadi Selesai."
        );

        if(ok){
          saveDelivery(Number(el.dataset.id), true);
        }
      });

    });
}

async function deleteOrder(id){
  const order=allOrders.find(o=>Number(o.id)===Number(id));
  if(!order) return;

  if(order.status!=="Dibatalkan"){
    alert("Untuk keamanan, hanya pesanan dengan status Dibatalkan yang bisa dihapus. Ubah status pesanan menjadi Dibatalkan terlebih dahulu.");
    return;
  }

  const ok=confirm(
    "HAPUS PESANAN SECARA PERMANEN?\n\n"+
    "ID: "+(order.order_id||"-")+"\n"+
    "Pelanggan: "+(order.customer_name||"-")+"\n\n"+
    "Data pesanan akan hilang dari database dan tidak bisa dikembalikan."
  );
  if(!ok) return;

  const {data: deleted, error}=await sb.rpc("delete_order_admin", {p_order_id: id});
  if(error){
    alert("Gagal menghapus pesanan: " + error.message);
    return;
  }

  if(deleted !== true){
    alert("Pesanan tidak dihapus. Pastikan statusnya Dibatalkan dan akun ini adalah admin.");
    return;
  }

  allOrders=allOrders.filter(o=>Number(o.id)!==Number(id));
  unreadOrderIds.delete(String(id));
  alert("Pesanan "+(order.order_id||"")+" berhasil dihapus.");
  updateStats();
  renderOrders();
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

function setOrderActionBusy(id, busy, mode="save"){
  const selectors = [
    `.save-detail[data-id="${id}"]`,
    `.send-wa[data-id="${id}"]`,
    `.delete-order[data-id="${id}"]`
  ];
  selectors.forEach(sel=>{
    const btn=document.querySelector(sel);
    if(!btn) return;
    if(busy){
      if(btn.dataset.originalText===undefined) btn.dataset.originalText=btn.textContent;
      btn.disabled=true;
      btn.classList.add("is-busy");
      btn.textContent = mode==="send" ? "⏳ Mengirim..." : mode==="delete" ? "⏳ Menghapus..." : "⏳ Menyimpan...";
    }else{
      btn.disabled=false;
      btn.classList.remove("is-busy");
      if(btn.dataset.originalText!==undefined){
        btn.textContent=btn.dataset.originalText;
        delete btn.dataset.originalText;
      }
    }
  });
}

async function saveDelivery(id, sendAfter){
  const details = getDeliveryValue(id);
  const order = allOrders.find(o => Number(o.id) === Number(id));
  if(!order) return;

  const busyMode = sendAfter ? "send" : "save";
  const guard = document.querySelector(`.save-detail[data-id="${id}"]`)?.dataset.busy === "1" ||
                document.querySelector(`.send-wa[data-id="${id}"]`)?.dataset.busy === "1";
  if(guard) return;
  document.querySelectorAll(`.save-detail[data-id="${id}"], .send-wa[data-id="${id}"]`).forEach(btn=>btn.dataset.busy="1");
  setOrderActionBusy(id,true,busyMode);

  try{
    if(details){
      const {error: detailError} = await sb.from("orders").update({
        delivery_details: details,
        delivered_at: new Date().toISOString()
      }).eq("id", id);

      if(detailError){
        alert("Gagal menyimpan detail: " + detailError.message);
        return;
      }
    }

    if(sendAfter){
      const {error: statusError} = await sb.from("orders").update({
        status: "Selesai"
      }).eq("id", id);

      if(statusError){
        alert("Detail sudah tersimpan, tetapi status gagal diubah: " + statusError.message);
        return;
      }

      order.delivery_details = details;
      order.delivered_at = new Date().toISOString();
      order.status = "Selesai";

      const url = buildWhatsAppUrl(order, details);
      if(url === "#"){
        alert("Detail sudah disimpan dan status menjadi Selesai, tetapi nomor WhatsApp pelanggan tidak valid.");
        await loadOrders();
        return;
      }

      await loadOrders();
      window.location.href = url;
      return;
    }

    order.delivery_details = details;
    order.delivered_at = new Date().toISOString();
    alert("Detail produk berhasil disimpan.");
    renderOrders();
  }finally{
    document.querySelectorAll(`.save-detail[data-id="${id}"], .send-wa[data-id="${id}"]`).forEach(btn=>delete btn.dataset.busy);
    setOrderActionBusy(id,false);
  }
}

async function deleteOrder(id){
  const order=allOrders.find(o=>Number(o.id)===Number(id));
  if(!order) return;

  const btn=document.querySelector(`.delete-order[data-id="${id}"]`);
  if(btn?.dataset.busy==="1") return;

  if(order.status!=="Dibatalkan"){
    alert("Untuk keamanan, hanya pesanan dengan status Dibatalkan yang bisa dihapus. Ubah status pesanan menjadi Dibatalkan terlebih dahulu.");
    return;
  }

  const ok=confirm(
    "HAPUS PESANAN SECARA PERMANEN?\n\n"+
    "ID: "+(order.order_id||"-")+"\n"+
    "Pelanggan: "+(order.customer_name||"-")+"\n\n"+
    "Data pesanan akan hilang dari database dan tidak bisa dikembalikan."
  );
  if(!ok) return;

  if(btn) btn.dataset.busy="1";
  setOrderActionBusy(id,true,"delete");

  try{
    const {data: deleted, error}=await sb.rpc("delete_order_admin", {p_order_id: id});
    if(error){
      alert("Gagal menghapus pesanan: " + error.message);
      return;
    }

    if(deleted !== true){
      alert("Pesanan tidak dihapus. Pastikan statusnya Dibatalkan dan akun ini adalah admin.");
      return;
    }

    allOrders=allOrders.filter(o=>Number(o.id)!==Number(id));
    unreadOrderIds.delete(String(id));
    alert("Pesanan "+(order.order_id||"")+" berhasil dihapus.");
    updateStats();
    renderOrders();
  }finally{
    if(btn) delete btn.dataset.busy;
    setOrderActionBusy(id,false);
  }
}

async function updateStatus(id, status){
  const order = allOrders.find(o => Number(o.id) === Number(id));
  if(!order) return;

  const select = document.querySelector(`.status-select[data-id="${id}"]`);
  if(select?.dataset.updating === "1") return;
  if(select) {
    select.dataset.updating = "1";
    select.disabled = true;
    select.classList.add("is-updating");
  }

  const important = status === "Selesai" || status === "Dibatalkan";
  if(important && order.status !== status){
    const action = status === "Selesai"
      ? "menyelesaikan"
      : "membatalkan";
    const ok = confirm(
      "Konfirmasi perubahan status\n\n" +
      "ID: " + (order.order_id || "-") + "\n" +
      "Pelanggan: " + (order.customer_name || "-") + "\n\n" +
      "Yakin ingin " + action + " pesanan ini?"
    );
    if(!ok){
      renderOrders();
      return;
    }
  }

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

  const meta = user.user_metadata || {};
  const profileName =
    meta.full_name ||
    meta.display_name ||
    meta.name ||
    "Admin CAMXD Store";
  const profileRole = admin.role || meta.role || "Administrator";
  const profileEmail = admin.email || user.email || "";
  const avatarUrl = meta.avatar_url || meta.picture || "";

  $("#adminEmail").textContent = profileEmail;

  const profile = $("#adminProfile");
  const avatar = $("#adminAvatar");
  if(profile){
    profile.hidden = false;
    $("#adminName").textContent = profileName;
    $("#adminRole").textContent = profileRole;
    $("#adminProfileEmail").textContent = profileEmail;

    if(avatarUrl){
      avatar.innerHTML = '<img src="' + escapeHtml(avatarUrl) + '" alt="">';
      avatar.classList.add("has-image");
    }else{
      const initials = String(profileName)
        .trim()
        .split(/\s+/)
        .slice(0,2)
        .map(x => x[0])
        .join("")
        .toUpperCase() || "A";
      avatar.textContent = initials;
      avatar.classList.remove("has-image");
    }
  }

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
  .addEventListener("click", async ()=>{
    const btn=$("#refreshBtn");
    if(!btn || btn.dataset.working==="1") return;
    btn.dataset.working="1";
    btn.classList.add("is-working");
    const label=btn.querySelector(".refresh-label");
    if(label) label.textContent="Memuat...";
    try{
      await loadOrders();
    }finally{
      btn.dataset.working="0";
      btn.classList.remove("is-working");
      if(label) label.textContent="Refresh";
    }
  });

$("#statusFilter")
  .addEventListener(
    "change",
    renderOrders
  );

// Pastikan kalender native Android/Chrome terbuka saat kolom tanggal disentuh.
function openAdminDatePicker(input){
  if(!input) return;
  try{
    if(typeof input.showPicker === "function") input.showPicker();
  }catch{}
}

document.querySelectorAll('input[type="date"]').forEach(input => {
  input.addEventListener("pointerdown", () => openAdminDatePicker(input));
});

sb.auth.onAuthStateChange(
  (_event, _session) => {
    // Session changes are handled
    // by showDashboard after login/logout.
  }
);

let orderPollingTimer = null;

function startOrderPolling(){
  clearInterval(orderPollingTimer);
  updateAdminConnectionStatus(true, true);
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
  $("#productsBtn").textContent = "\u{1F6CD}\u{FE0F} Produk Aktif";
  loadProductsAdmin();
  window.scrollTo({top:0,behavior:"smooth"});
}

function showOrdersPanel(){
  $("#productsPanel").hidden = true;
  $(".orders-panel").hidden = false;
  $("#productsBtn").textContent = "\u{1F6CD}\u{FE0F} Kelola Produk";
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

function exportOrdersXlsx(){
  const orders=getFilteredOrders();
  if(!orders.length){ alert("Tidak ada pesanan untuk diekspor."); return; }

  const rows=[["ID Pesanan","Tanggal","Nama","WhatsApp","Status","Produk","Total","Detail Pengiriman"]];
  orders.forEach(o=>{
    const items=Array.isArray(o.items)?o.items:[];
    const products=items.map(x=>(x.name||"Produk")+" - "+(x.plan||"")+" x"+Number(x.qty||1)).join(" | ");
    const d=new Date(o.created_at);
    const date=Number.isNaN(d.getTime())?(o.created_at||""):d.toLocaleString("id-ID",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",hour12:false});
    rows.push([String(o.order_id||""),date,String(o.customer_name||""),String(o.customer_wa||""),String(o.status||""),products,o.total_label||rupiah(o.total),String(o.delivery_details||"")]);
  });

  const xmlEsc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  const colName=n=>{let s="";while(n){let r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26);}return s;};
  const sheetRows=rows.map((row,ri)=>"<row r=\""+(ri+1)+"\">"+row.map((v,ci)=>"<c r=\""+colName(ci+1)+(ri+1)+"\" t=\"inlineStr\"><is><t xml:space=\"preserve\">"+xmlEsc(v)+"</t></is></c>").join("")+"</row>").join("");
  const widths=[18,20,22,18,22,38,18,48];
  const cols=widths.map((w,i)=>"<col min=\""+(i+1)+"\" max=\""+(i+1)+"\" width=\""+w+"\" customWidth=\"1\"/>").join("");
  const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>'+cols+"</cols><sheetData>"+sheetRows+"</sheetData><autoFilter ref=\"A1:H"+rows.length+"\"/></worksheet>";

  const files={
    "[Content_Types].xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    "_rels/.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    "xl/workbook.xml":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Pesanan CAMXD" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels":'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml":sheet
  };

  const enc=new TextEncoder(), crcTable=(()=>{const t=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);t[n]=c>>>0;}return t;})();
  const crc32=u8=>{let c=0xffffffff;for(const b of u8)c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
  const parts=[];let offset=0;
  const u16=n=>new Uint8Array([n&255,(n>>>8)&255]),u32=n=>new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]);
  const join=arrs=>{let n=arrs.reduce((s,a)=>s+a.length,0),o=new Uint8Array(n);let p=0;for(const a of arrs){o.set(a,p);p+=a.length;}return o;};
  const central=[];
  Object.entries(files).forEach(([name,text])=>{
    const data=enc.encode(text), nameU=enc.encode(name), crc=crc32(data);
    const local=join([new Uint8Array([80,75,3,4,20,0,0,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(nameU.length),u16(0),nameU,data]);
    parts.push(local);
    central.push(join([new Uint8Array([80,75,1,2,20,0,20,0,0,0,0,0,0,0]),u32(crc),u32(data.length),u32(data.length),u16(nameU.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),nameU]));
    offset+=local.length;
  });
  const cd=join(central), body=join(parts), end=join([new Uint8Array([80,75,5,6,0,0,0,0]),u16(central.length),u16(central.length),u32(cd.length),u32(body.length),u16(0)]);
  const blob=new Blob([body,cd,end],{type:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"});
  const url=URL.createObjectURL(blob),link=document.createElement("a");
  link.href=url;link.download="CAMXD-Store-Laporan-"+new Date().toISOString().slice(0,10)+".xlsx";
  document.body.appendChild(link);link.click();link.remove();URL.revokeObjectURL(url);
}
$("#exportXlsxBtn")?.addEventListener("click",exportOrdersXlsx);
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


document.addEventListener("DOMContentLoaded",()=>{
  normalizeRefreshButton();
  $("#selectAllOrdersBtn")?.addEventListener("click",()=>{
    const eligible=allOrders.filter(o=>!["Selesai"].includes(o.status)).map(o=>String(o.id));
    if(eligible.length && eligible.every(id=>selectedOrderIds.has(id))) eligible.forEach(id=>selectedOrderIds.delete(id));
    else eligible.forEach(id=>selectedOrderIds.add(id));
    renderOrders();
    updateBulkDeleteUi();
  });
  $("#bulkDeleteOrdersBtn")?.addEventListener("click",bulkDeleteOrders);
  updateBulkDeleteUi();
});


function requestAdminNotifications(){
  if(!("Notification" in window)) return;
  if(Notification.permission==="default"){
    Notification.requestPermission().catch(()=>{});
  }
}

document.addEventListener("DOMContentLoaded",()=>{
  const markBtn=$("#markOrdersReadBtn");
  markBtn?.addEventListener("click",()=>updateNewOrderAlert());
  document.addEventListener("click",e=>{
    if(e.target.closest("#newOrderAlert")) requestAdminNotifications();
  });
  requestAdminNotifications();
});
