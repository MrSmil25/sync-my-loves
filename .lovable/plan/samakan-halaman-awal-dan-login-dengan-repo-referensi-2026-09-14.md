# Samakan halaman awal dan login dengan repo referensi

## Hasil
- Halaman `/` mengikuti alur repo referensi: pengguna yang belum masuk langsung menuju `/login`, sedangkan pengguna aktif menuju `/dashboard`.
- Halaman `/login` memakai tampilan, susunan, gerakan logo, transisi partikel, kartu formulir, dan perilaku interaksi yang sama persis dengan `MrSmil25/sweetheart-sync-hub`.
- Login, pendaftaran, lupa password, konfirmasi email, pesan kesalahan, dan tujuan `/dashboard` tetap memakai koneksi Supabase project ini.

## Perubahan
- Salin implementasi referensi untuk `MyRoomAuth`, stylesheet halaman, dan motion engine.
- Pertahankan shell HTML dan model animasi yang sudah identik dengan repo referensi.
- Samakan konfigurasi route `/` dan `/login`, termasuk metadata serta preload logo.
- Jangan mengubah dashboard, sidebar, database, RLS, atau halaman lain.

## Validasi
- Periksa `/` untuk redirect sesuai status login.
- Uji `/login`: klik layar, drag logo, transisi partikel, tombol Kembali, Escape, Login, Daftar, dan Lupa password.
- Periksa tampilan desktop dan ponsel.
- Jalankan typecheck dan cek hasil build preview.

## Detail teknis
- Sumber yang disalin: branch `main` repo privat `MrSmil25/sweetheart-sync-hub` melalui GitHub connector.
- File target: `src/components/MyRoomAuth.tsx`, `src/components/MyRoomAuth.css`, `src/components/my-room/engine.ts`, `src/routes/index.tsx`, dan `src/routes/login.tsx`.
- `src/lib/supabase-external.ts` tidak diubah.
