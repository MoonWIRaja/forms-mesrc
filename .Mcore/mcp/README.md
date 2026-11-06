# MCP configs (MemoryCore)

Single place for MCP client configs. Do not create `.vscode/`, `.claude/`, `.codex/` or `.agents/` in this project.

- `supabase.mcp.json` - hosted Supabase MCP for project `uvjwepsawrbrhpywabdu` (docs, account, database, debugging, development, functions, branching, feedback).
- Contains NO secrets. Auth is OAuth sign-in by the Supabase account owner in the MCP client. Never put access tokens, service-role keys or DB passwords in this folder.
- Copy this file's `servers` block into your client's MCP settings to connect.
- Security: this MCP can modify the database. Prefer a development project or add `&read_only=true` to the URL when only inspecting.