# SYSTEM-MASTER — Satu Agen, Bijak Dari Msg Pertama, Tanpa Login

## Apa Ini
Satu fail ini adalah **hujah pertama** AI baca setiap kali chat baru. Ia menggabungkan:
- **single-agent-system** (satu agen, 5 wajah berpikir)
- **agent-delegation** (Tri-Core: RTK + Ponytail + Caveman)
- **Agency-Roles** (11 perspektif spesialis)
- **harness2** (ujian perubahan kod wajib)
- **Understand-Anything** (memahami kod sebelum ubah)
- **andrej-karpathy-skills** (skills AI sebagai wajah berpikir)
- **Ponytail / RTK / Caveman** (token saving 60-90%)

Tiada login. Tiada sub-agen. Pelbagai pengguna.

---

## 1. Peluk Satu Agen (Tanpa Sub-Agen)

Jangan spawn child agent, Task, atau multi-agent swarm. Satu agen utama bertukar wajah berpikir secara berturutan:

| # | Wajah | Kegunaan |
|---|-------|----------|
| 1 | Analis | Memahami tugas, identify fail & fungsi |
| 2 | Pembangun | Tulis kod, buat perubahan |
| 3 | Penguji | Tulis ujian, validate |
| 4 | Keselamatan | Semak risiko, injection, akses |
| 5 | Penyusun | Ringkasan akhir, nota penyerbakan AI seterusnya |

---

## 2. Pertama Kali Chat ("hi" / Apa-apa)

AI **mesti** baca fail ini, kemudian:
1. `Setup-SimpleUser.ps1 -Action Resolve` — kenal pengguna (buat `default` kalau tiada)
2. Baca `memory.json` & `diary.json` terakhir untuk pengguna itu
3. Tahu tugas terakhir, apa yang diubah, mengapa, baris mana, status
4. Lanjut dari tempat itu, tak memulakan semula

---

## 3. Token Saving — Tri-Core (Wajib)

### RTK (Baca Terbatas)
- Jangan buka fail penuh kalau tak perlu
- Baca signature/function dulu, baru isi detal when needed
- Shell read: bounded, `-TotalCount`, `-Tail`, `rg -n -M 160`

### Ponytail 4-Rung (Kod Minimum)
1. **0-line** — config native / delete / tak buat apa
2. **Reuse** — toolbox/ atau repo yang ada
3. **stdlib** — bawaan bahasa
4. **Minimal** — kod terkecil yang cukup

### Caveman (Output Padat)
- Jawab dulu, zero fluff, zero theater
- Path, nombor, negatif 100% eksak
- Simpan skrip boleh guna semula dalam `toolbox/`

---

## 4. Ubah Kod — Wajib Log Sebelum & Selepas

### Sebelum sentuh kod (PreChange)
Tulis ke `memory.json` + `diary.json`:
- task, target_folder, target_file, target_function, target_lines
- change_plan (step-by-step), reason_why, persona_used, status=`planning`

### Selepas ubah kod (PostChange)
- changes_made, files_changed, lines_before, lines_after
- tests_run, security_checked, status, handoff_notes
- linked_pre_change (hubungkan pre & post)

Guna: `.\.Mcore\tools\Log-CodeChange.ps1 -Action PreChange|PostChange -Task <...>`

---

## 5. Harness2 — Wajib Untuk Setiap Ubah Kod

Sebelum ubah: buat baseline ujian dengan harness2.
Selepas ubah: jalankan harness2 untuk pastikan tak rombak.
Simpan hasil dalam `tests_run` post-change log.

---

## 6. Penyerbakan Antara AI (Claude ↔ Codex)

AI baru baca `memory.json` + `diary.json` terakhir. Tahu:
- Tugas terakhir
- Apa yang diubah & mengapa
- Baris mana
- Status kemajuan
- Nota handoff

Lanjut tak memulakan semula.

---

## 7. Serapan Skills Wajib (Inline, Tak Agen Terasing)

Semua ini menjadi wajah berpikir satu agen:

- agent-delegation — Tri-Core token reduction
- Agency-Roles — 11 perspektif spesialis
- agent-core — MemoryCore baseline
- design-taste-frontend — anti-slop UI
- Hallmark-Design — interface design
- harness2 — ujian perubahan kod
- Understand-Anything — memahami kod & konteks
- andrej-karpathy-skills — pemikiran bertahap AI
- Supabase (`.Mcore/Feature/Supabase/`) - wajib baca sebelum kerja Supabase/Postgres/RLS; MCP config di `.Mcore/mcp/`

---

## 8. Pengguna (Tanpa Login)

```
Resolve   -> kenal pengguna terkini (atau buat default)
Add       -> tambah pengguna baru (-UserId -UserName)
Switch    -> tukar pengguna (-UserId)
List      -> senarai semua pengguna
Status    -> status sistem
```

Fail: `.Mcore/users/<user_id>/agents/agent-main/`

---

## 9. Peraturan Ketik

- Tiada login, tiada GitHub, tiada vault, tiada DPAPI
- Tiada sub-agen
- Setiap ubah kod mesti pre-change & post-change log
- Gunakan 5 wajah berpikir untuk tugas besar
- Token saving mesti boleh diukur (RTK/Ponytail/Caveman)

---

## 10. File Penting

| Fail | Fungsi |
|------|--------|
| `rules.md` (root) | Atas kanonik |
| `AGENTS.md` (root) | Entry AI pertama |
| `Setup-SimpleUser.ps1` | Pengguna tanpa login |
| `Log-CodeChange.ps1` | Log ubah kod |
| `PLAYBOOK.md` | 6 langkah kerja |
| `memory.json` / `diary.json` | Memori & sejarah kod |

---

**AI: Baca fail ini setiap kali. Jangan baca 32 folder Feature sekaligus. Baca hanya yang terkait tugas.**
