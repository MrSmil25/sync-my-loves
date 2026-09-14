# Optimasi performa halaman login

## Tujuan
Membuat halaman awal dan login terasa lebih lancar, terutama di ponsel dan perangkat dengan GPU terbatas, tanpa mengubah desain atau autentikasi.

## Perubahan
- Batasi resolusi canvas berdasarkan ukuran layar dan kemampuan perangkat.
- Kurangi jumlah partikel, titik latar, dan kualitas antialias secara adaptif pada layar kecil/perangkat lambat.
- Batasi animasi idle ke laju gambar yang lebih hemat, tetapi tetap responsif saat drag dan transisi.
- Hentikan render yang tidak diperlukan saat tab tersembunyi, halaman tidak terlihat, animasi dijeda, atau kartu login sudah diam.
- Kurangi efek blur mahal pada perangkat kecil sambil mempertahankan tampilan kartu.
- Pertahankan logo WebGL, drag, partikel, tombol jeda, kembali/Escape, dan seluruh fungsi Supabase Auth.

## Validasi
- Uji intro, drag logo, transisi partikel, kartu login, kembali/Escape, serta mode login/daftar/lupa password.
- Uji tampilan desktop dan ponsel.
- Periksa error runtime, typecheck, lint file terkait, dan hasil build preview.

## Teknis
Perubahan hanya menyentuh mesin animasi dan stylesheet halaman My Room. Tidak ada perubahan pada dashboard, sidebar, database, RLS, atau alur autentikasi.
