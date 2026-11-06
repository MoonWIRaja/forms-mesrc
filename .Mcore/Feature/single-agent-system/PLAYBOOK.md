# PLAYBOOK.md — Single Agent System

## 1. The Goal

Satu agen utama yang mampu segala bidang, tanpa login, tanpa sub-agen, sokongan pelbagai pengguna. Memori dan diari terperinci untuk penyerbakan antara pengemudi AI (Claude, Codex, dll). Setiap tugas code change mesti didokumentasikan sebelum dan selepas ubah.

## 2. The Steps in Order

### Step 1: Resolve User (Tanpa Login)
```
.\.Mcore\tools\Setup-SimpleUser.ps1 -Action Resolve
```
Atau tambah pengguna baru:
```
.\.Mcore\tools\Setup-SimpleUser.ps1 -Action Add -UserId <id> -UserName <nama>
```

### Step 2: Pilih Wajah Berpikir
Berdasarkan jenis tugas, aktifkan wajah yang sesuai:
1. **Analis** — memahami tugas, identify fail & fungsi
2. **Pembangun** — tulis kod, buat perubahan
3. **Penguji** — tulis ujian, validate
4. **Keselamatan** — semak risiko, injection
5. **Penyusun** — ringkasan akhir, nota penyerbakan

### Step 3: Pre-Change Memory Log (Sebelum Ubah Kod)
Sebelum sentuh kod, tulis ke `memory.json` dan `diary.json`:
- task, target_folder, target_file, target_function, target_lines
- change_plan (step-by-step)
- reason_why (mengapa ubah)
- persona_used
- status: `planning`

### Step 4: Lakukan Ubah Kod
Gunakan Ponytail 4-Rung Ladder:
1. 0-line config / native / delete
2. Reuse toolbox/ or repo
3. stdlib
4. Minimal code

### Step 5: Post-Change Memory Log (Selepas Ubah Kod)
Kemas kini memori & diari:
- changes_made, files_changed, lines_before, lines_after
- tests_run, security_checked
- status: `completed` or `blocked`
- handoff_notes (untuk AI berikutnya)

### Step 6: Penyerbakan Antara AI
Bila tukar AI (Claude → Codex):
1. Baca `memory.json` dan `diary.json` terakhir
2. Teruskan dari status terakhir, tidak memulakan semula

## 3. The Rules

- Tiada sub-agen, tiada multi-agent swarm
- Tiada login, tiada GitHub, tiada vault, tiada DPAPI
- Setiap pengguna punya fail tersendiri di `.Mcore/users/<user_id>/`
- Code change mesti ada pre-change dan post-change log
- Gunakan semua 5 wajah berpikir untuk tugas besar
- Serap semua skills (agent-delegation, Agency-Roles, agent-core, design-taste-frontend, Hallmark-Design, harness2, Understand-Anything, andrej-karpathy-skills) sebagai wajah berpikir inline

## 4. What Done Looks Like

- `.Mcore/.simple-login.json` wujud dengan user_id terkini
- `.Mcore/users/<user_id>/agents/<agent_id>/memory.json` ada `code_changes` array
- Setiap code change ada entri pre-change dan post-change di `diary.json`
- Boleh tukar AI pengemudi tanpa kehilangan konteks
- Boleh tukar pengguna tanpa kata laluan
