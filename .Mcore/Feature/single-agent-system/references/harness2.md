# Harness2 — Google Research Code Change Harness

Sumber: https://github.com/google-research/harness2

## Peran dalam Single Agent System

Harness2 adalah framework untuk menguji perubahan kod secara sistematik. Dalam konteks single-agent ini:

- **Sebelum ubah kod**: Gunakan harness2 untuk menentukan baseline ujian sebelum perubahan
- **Selepas ubah kod**: Jalankan harness2 untuk memastikan perubahan tidak rombak fungsi sedia ada
- **Integrasi**: Hasil ujian daripada harness2 disimpan dalam `tests_run` dalam post-change log

## Cara Guna

1. Identifikasi fungsi yang akan diubah (Analis persona)
2. Buat baseline ujian dengan harness2 sebelum perubahan
3. Buat perubahan kod (Pembangun persona)
4. Jalankan harness2 sekali lagi untuk memvalidasi (Penguji persona)
5. Simpan hasil dalam `memory.json` code_changes dan `diary.json`

## Peraturan

- Jangan install dependensi tanpa kebenaran pengguna
- Hasil ujian mesti direkodkan dalam post-change log
- Tidak boleh claim ujian berjalan jika sebenarnya tidak dijalankan
