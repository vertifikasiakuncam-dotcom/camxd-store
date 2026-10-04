const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
const $ = (s) => document.querySelector(s);

const STATUSES = [
  "Menunggu Pembayaran",
  "Menunggu Verifikasi",
  "Sudah Dibayar",
  "Selesai",
  "Dibatalkan"
];

let allOrders = [];

const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");
const escapeHtml = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
}[c]));

function statusClass(status){
  if(status === "Selesai" || status === "Sudah Dibayar") return "done";
  if(status === "Menunggu Verifikasi") return "verify";
  if(status === "Dibatalkan") return "cancel";
  return "waiting";
}

function formatDate(v){
  try { return new Date(v).toLocaleString("id-ID", {dateStyle:"medium", timeStyle:"short"}); }
  catch { return v; }
}

function itemsText(items){
  if(!Array.isArray(items)) return "";
  return items.map(x => `${x.name} — ${x.plan} x${x.qty}`).join("\n");
}

async function loadOrders(){
  const {data, error} = await sb
    .from("orders")
    .select("*")
    .order("created_at", {ascending:false});

  if(error){
    console.error(error);
    $("#ordersList").innerHTML = `<div class="empty">Gagal mengambil pesanan: ${escapeHtml(error.message)}</div>`;
    return;
  }

  allOrders = data || [];
  updateStats();
  renderOrders();
}

function updateStats(){
  const done = allOrders.filter(o => o.status === "Selesai" || o.status === "Sudah Dibayar");
  $("#statTotal").textContent = allOrders.length;
  $("#statWaiting").textContent = allOrders.filter(o => o.status === "Menunggu Pembayaran").length;
  $("#statVerify").textContent = allOrders.filter(o => o.status === "Menunggu Verifikasi").length;
  $("#statDone").textContent = done.length;
  $("#statRevenue").textContent = rupiah(done.reduce((s,o)=>s+Number(o.total||0),0));
}

function renderOrders(){
  const filter = $("#statusFilter").value;
  const orders = filter === "all" ? allOrders : allOrders.filter(o => o.status === filter);

  if(!orders.length){
    $("#ordersList").innerHTML = `<div class="empty">Belum ada pesanan pada filter ini.</div>`;
    return;
  }

  $("#ordersList").innerHTML = orders.map(o => {
    const items = Array.isArray(o.items) ? o.items : [];
    const wa = String(o.customer_wa || "").replace(/\D/g, "");
    const waUrl = wa ? `https://wa.me/${wa.startsWith("62") ? wa : ("62"+wa.replace(/^0/,""))}` : "#";
    return `
      <article class="order-card">
        <div class="order-top">
          <div>
            <strong class="order-id">${escapeHtml(o.order_id)}</strong>
            <span class="date">${escapeHtml(formatDate(o.created_at))}</span>
          </div>
          <span class="status ${statusClass(o.status)}">${escapeHtml(o.status)}</span>
        </div>

        <div class="customer">
          <strong>${escapeHtml(o.customer_name)}</strong>
          <span>${escapeHtml(o.customer_wa)}</span>
        </div>

        <div class="items">
          ${items.map(x => `
            <div class="item-line">
              <span>${escapeHtml(x.name)} — ${escapeHtml(x.plan)} × ${Number(x.qty||1)}</span>
              <b>${Number(x.price||0) ? rupiah(Number(x.price||0)*Number(x.qty||1)) : "Konfirmasi admin"}</b>
            </div>
          `).join("")}
        </div>

        <div class="order-bottom">
          <div>
            <small>Total</small>
            <strong>${escapeHtml(o.total_label || rupiah(o.total))}</strong>
          </div>
          <div class="actions">
            <a class="btn wa" target="_blank" rel="noopener" href="${waUrl}">WhatsApp</a>
            <select class="status-select" data-id="${o.id}">
              ${STATUSES.map(s => `<option ${s===o.status?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>
      </article>`;
  }).join("");

  document.querySelectorAll(".status-select").forEach(el => {
    el.addEventListener("change", () => updateStatus(Number(el.dataset.id), el.value));
  });
}

async function updateStatus(id, status){
  const {error} = await sb.from("orders").update({status}).eq("id", id);
  if(error){
    alert("Gagal mengubah status: " + error.message);
    await loadOrders();
    return;
  }
  await loadOrders();
}

async function login(e){
  e.preventDefault();
  $("#loginError").textContent = "";
  const email = $("#email").value.trim();
  const password = $("#password").value;

  const {error} = await sb.auth.signInWithPassword({email, password});
  if(error){
    $("#loginError").textContent = error.message;
    return;
  }
  await showDashboard();
}

async function showDashboard(){
  const {data:{user}} = await sb.auth.getUser();
  if(!user){
    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;
    return;
  }

  const {data: admin, error} = await sb
    .from("admin_users")
    .select("user_id,email,role")
    .eq("user_id", user.id)
    .maybeSingle();

  if(error || !admin){
    await sb.auth.signOut();
    $("#loginError").textContent = "Akun ini belum memiliki akses admin.";
    $("#loginView").hidden = false;
    $("#dashboardView").hidden = true;
    return;
  }

  $("#adminEmail").textContent = admin.email || user.email || "";
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

$("#loginForm").addEventListener("submit", login);
$("#logoutBtn").addEventListener("click", logout);
$("#refreshBtn").addEventListener("click", loadOrders);
$("#statusFilter").addEventListener("change", renderOrders);

sb.auth.onAuthStateChange((_event, _session) => {
  // Session changes are handled by showDashboard after login/logout.
});

showDashboard();
