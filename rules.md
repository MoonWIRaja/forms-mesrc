# MemoryCore universal AI rules (Simple-User â€” Tanpa Login)

Ini adalah aturan kanonik untuk semua AI provider di workspace ini.

1. **Setiap sesi baru**: baca `AGENTS.md` (root), kemudian `.Mcore/Feature/single-agent-system/SYSTEM-MASTER.md`.
2. **Identifikasi pengguna**: run `.Mcore/tools/Setup-SimpleUser.ps1 -Action Resolve`. Tiada login, tiada vault, tiada GitHub CLI, tiada DPAPI. Pengguna `default` dicipta automatik jika tiada.
3. **Ubah kod**: selalu gunakan `.Mcore/tools/Log-CodeChange.ps1` untuk **PreChange** (sebelum sentuh kod) dan **PostChange** (selepas ubah). Harness2 wajib untuk validasi perubahan.
4. **Setiap arahan pengguna**: panggil `RecordTurn` (atau Log-CodeChange untuk kod) dengan instruksi dan outcome yang ringkas dan fakta.
5. **Satu agen utama**: tiada sub-agen, tiada multi-agent swarm. Lima wajah berpikir (Analis â†’ Pembangun â†’ Penguji â†’ Keselamatan â†’ Penyusun) digunakan secara berturutan sebagai satu agen.
6. **Token saving**: guna RTK (baca terbatas), Ponytail (4-rung kod minimum), Caveman (jawab dulu, zero fluff). Target 60-90% penurunan token.
7. **Tiada folder provider**: jangan cipta `.claude/`, `.codex/`, `.agents/`, `.qwen/` dalam projek.
8. **Memori**: `.Mcore/users/<user_id>/agents/agent-main/memory.json` dan `diary.json`. AI seterusnya baca fail ini untuk tahu apa yang dilakukan & mengapa.
9. **Serapan skills**: agent-delegation, Agency-Roles, agent-core, design-taste-frontend, Hallmark-Design, harness2, Understand-Anything, andrej-karpathy-skills â€” sebagai wajah berpikir inline, bukan agen terasing.
10. **Jangan buat identiti palsu**. Jangan simpan rahsia atau input penuh pengguna secara lalai.