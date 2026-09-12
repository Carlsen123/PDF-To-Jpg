# Paperworks — PDF ke JPG

Alat sederhana untuk mengubah tiap halaman PDF menjadi gambar JPG, dengan tampilan dan branding sendiri (berbeda dari layanan sejenis seperti iLovePDF).

## Cara kerja
- Backend Node.js/Express memakai `pdftoppm` (dari paket `poppler-utils`) untuk merender tiap halaman PDF jadi JPG.
- Karena butuh `poppler-utils` di level sistem (bukan cuma library Node), project ini **wajib di-deploy pakai Docker**, bukan lewat build command Node biasa.

## Menjalankan di komputer sendiri
```
docker build -t paperworks .
docker run -p 3000:3000 paperworks
```
Buka `http://localhost:3000`.

## Publish ke Render
1. Push seluruh folder ini (termasuk `Dockerfile`) ke repo GitHub baru.
2. Di dashboard Render, klik **New +** → **Web Service**.
3. Hubungkan ke repo GitHub kamu.
4. Pada bagian **Language/Runtime**, pilih **Docker** (bukan Node) — Render akan otomatis mendeteksi `Dockerfile` di root repo.
5. Klik **Create Web Service** dan tunggu proses build selesai (build Docker biasanya lebih lama dari build Node biasa karena harus install `poppler-utils`).
6. Setelah live, buka URL yang diberikan Render dan coba upload PDF.

## Kustomisasi
- Ubah nama, warna, dan teks di `public/index.html` (variabel warna ada di bagian `:root` pada `<style>`).
- Batas ukuran file diatur di `server.js` pada baris `limits: { fileSize: 100 * 1024 * 1024 }` (saat ini 100 MB).
- Kualitas gambar diatur lewat resolusi `-r 150` pada perintah `pdftoppm` di `server.js` — naikkan angka itu untuk gambar lebih tajam (ukuran file juga lebih besar).

## Troubleshooting: error "Unexpected end of JSON input" atau proses macet lama
Ini biasanya terjadi karena **server kehabisan memori (RAM)** saat memproses file besar, terutama di paket gratis Render (umumnya dibatasi ~512 MB RAM). File PDF ditulis langsung ke disk (bukan ditampung penuh di RAM) untuk mengurangi risiko ini, dan proses konversi otomatis dihentikan setelah 90 detik supaya tidak menggantung selamanya. Kalau masih sering terjadi pada file besar:
- Cek tab **Logs** di dashboard Render saat error terjadi — pesan seperti `Killed` atau `JavaScript heap out of memory` menandakan kehabisan RAM.
- Pertimbangkan upgrade paket Render ke instance dengan RAM lebih besar untuk file besar/berhalaman banyak.
- Turunkan resolusi `-r 150` menjadi misalnya `-r 100` untuk mengurangi pemakaian memori per halaman.
