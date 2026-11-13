# CHEAT PB MOBILE SAVE

Ekstensi untuk memainkan PBMobile melalui **Brave di komputer**. Unduh ZIP, ekstrak, lalu pasang folder hasil ekstrak sebagai ekstensi.

## Fitur

- **Skeleton ESP:** 
- **Chams**
- **anti-deteksi**

Versi 0.6.3 mempertahankan sesi persiapan bundle setelah match pertama, sehingga match berikutnya tetap diproses tanpa menekan **Siapkan** lagi. Lapisan `acflag` di sisi browser tidak menjamin akun bebas dari deteksi server.

Versi 0.6.4 mengenali gate `window.G` pada bundle game terbaru yang berubah menjadi `!1&&(window.G=`.

Versi 0.7.0 dibuat ulang dari kode Brave Full: `stealth.js` sama persis, preboot Full dipakai, alur worker Full dipakai dengan patch bundle terbatas pada akses visual `G`/`RND`, dan gambar Skeleton/Chams diambil dari implementasi Full. Paket tidak memuat skrip fitur lain. Deteksi server tetap mungkin terjadi dan belum diuji dalam match.

## Cara pakai di komputer

1. Unduh `pemburuhs-brave-skeleton-v4.zip` dari repo ini, lalu **ekstrak ZIP**. Pastikan ada folder `pemburuhs-brave-skeleton-v4` yang berisi `manifest.json`.
2. Buka Brave dan ketik `brave://extensions` pada bilah alamat.
3. Aktifkan **Developer mode**, klik **Load unpacked**, lalu pilih folder `pemburuhs-brave-skeleton-v4` hasil ekstrak. Pilih **foldernya**, bukan file ZIP.
4. Buka `https://pbmobile.app/` di Brave. Jika ada ekstensi PemburuHS lain, nonaktifkan dulu agar tidak bentrok.
5. Saat berada di lobby, klik ikon ekstensi **CHEAT PB MOBILE SAVE** dan tekan **Siapkan**. Tab akan dimuat ulang. Izinkan peringatan debugger dari Brave jika muncul.
6. Masuk ke match. Setelah match berjalan, gunakan menu yang muncul di halaman game untuk menyalakan **Skeleton ESP** atau **Chams**. Semua fitur mulai dalam keadaan **OFF** setelah reload.
7. Untuk mematikan persiapan otomatis, klik ikon ekstensi lalu tekan **Batal**.

#Cheat ini bersifat opensource 
#bebas untuk di edit atau ditambah fitur
#pakai dengan bijak
