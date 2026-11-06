# MemoryCore entry for AI agents

The canonical rules and all project memory are in `.Mcore/`. Before doing any task, read [`../rules.md`](../rules.md) at the project root first, then run `.Mcore/tools/Setup-SimpleUser.ps1 -Action Resolve` to identify the current user (no login required). For code changes, always use `.Mcore/tools/Log-CodeChange.ps1` for pre-change and post-change logging.

Use the registered AI agent name and call `RecordTurn` after every user instruction. Do not create provider-specific folders in this project for MemoryCore.
