SAMARINDA TOKEN GENERATOR - FREE WEB VERSION

Tujuan:
Aplikasi dapat dibuka langsung di Chrome melalui URL Cloudflare Pages/Workers,
tanpa menjalankan Node.js di HP/PC.

Cara deploy gratis:
1. Buat akun Cloudflare.
2. Buat Pages/Workers project dari folder ini.
3. Upload/deploy folder ini menggunakan Cloudflare Wrangler atau dashboard.
4. Setelah deploy, Cloudflare memberikan URL *.workers.dev.
5. Buka URL tersebut di Chrome:
   https://NAMA_PROJECT.workers.dev/?hwid=Test

Catatan:
- Versi ini tetap bergantung pada server upstream. Hosting gratis hanya menggantikan
  Node.js lokal/proxy.
- Jika server upstream menolak koneksi dari Cloudflare atau endpoint berubah,
  respons token tetap gagal.
- Jangan masukkan API key/password rahasia ke frontend.
