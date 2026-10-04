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

  allOrders = data || [];

  updateStats();
  renderOrders();
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

  $("#statDone").textContent = done.length;

  $("#statRevenue").textContent =
    rupiah(
      done.reduce(
        (s,o) => s + Number(o.total || 0),
        0
      )
    );
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

  const filter =
    $("#statusFilter").value;

  const orders =
    filter === "all"
      ? allOrders
      : allOrders.filter(
          o => o.status === filter
        );

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
      <article class="order-card">

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

showDashboard();
