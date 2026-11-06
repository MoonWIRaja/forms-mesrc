// Public, non-secret configuration only (embedded in the static bundle).
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://uvjwepsawrbrhpywabdu.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_tOTyPAnkxDdNP9UDOBIbWA_JzoPEL3t";
export const APP_NAME = "Forms MESRC";