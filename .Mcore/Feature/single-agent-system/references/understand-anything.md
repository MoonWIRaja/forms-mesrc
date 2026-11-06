# Understand-Anything — Egonex-AI

Sumber: https://github.com/Egonex-AI/Understand-Anything

## Peran dalam Single Agent System

Understand-Anything adalah framework untuk memahami kod dan konteks secara dalam. Digunakan oleh **Analis persona** sebelum sebarang perubahan kod:

- Menilai fail yang terlibat
- Mengidentifikasi fungsi dan baris yang perlu diubah
- Mengumpulkan bukti tentang kod sedia ada
- Memahami dependency dan impact analysis

## Cara Guna

1. Baca fail target dengan Understand-Anything principles
2. Documentkan apa yang dipahami dalam pre-change log (`target_lines`, `change_plan`)
3. Sertakan bukti kod sedia ada dalam reason_why
4. Simpan konteks dalam `memory.json` untuk rujukan AI berikutnya

## Peraturan

- Jangan ubah kod sebelum memahami sepenuhnya konteks
- Semua asumsi mesti ditandai dalam pre-change log
- Konteks mesti cukup untuk AI lain boleh teruskan tanpa memulakan semula
