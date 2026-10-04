CAMXD STORE V2
Upload index.html, style.css, script.js, README.txt ke repository GitHub Pages.

PENTING:
1. Buka script.js.
2. Cari const STORE_WA="628XXXXXXXXXX";
3. Ganti dengan nomor WhatsApp toko, format 62... tanpa +, spasi, atau tanda -.
4. Commit perubahan.
5. GitHub Pages akan memperbarui website.

Produk/harga bisa diubah pada array products di script.js.

Versi V2 ini sudah memiliki katalog, filter kategori, checkout WhatsApp, dan tampilan mobile.
Pembayaran otomatis belum terhubung karena membutuhkan akun/payment gateway dan kredensial API.


PEMBAYARAN CAMXD STORE
- Alur: Website -> WhatsApp -> GoPay Merchant QRIS -> konfirmasi pembayaran.
- Nomor WhatsApp toko sudah diatur di script.js: 6282133942994
- Website ini belum memverifikasi pembayaran otomatis. Admin tetap mengecek transaksi di GoPay Merchant.
- Jangan menaruh PIN, password, atau data rahasia GoPay di GitHub.
