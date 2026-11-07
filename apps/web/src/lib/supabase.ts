import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

let browserClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return browserClient;
}

export type AppRole = "maintenance" | "admin" | "user";

export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: AppRole;
  is_active: boolean;
  created_at: string;
}

export interface SystemSetupState {
  needs_first_maintenance: boolean;
  bootstrap_email_pending_otp: boolean;
  setup_wizard_completed: boolean;
}

/**
 * Resolves a 4-digit OTP code against the Supabase backend and verifies the session.
 */
export async function verifyFourDigitOtp(email: string, code4: string) {
  const supabase = getSupabase();
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code4.replace(/\D/g, "").slice(0, 4);

  if (cleanCode.length !== 4) {
    throw new Error("Please enter the 4-digit verification code.");
  }

  let tokenToVerify = cleanCode;
  const { data: resolvedToken, error: rpcErr } = await supabase.rpc("resolve_4digit_otp", {
    p_email: normalizedEmail,
    p_code4: cleanCode,
  });

  if (!rpcErr && typeof resolvedToken === "string" && resolvedToken.length >= 4) {
    tokenToVerify = resolvedToken;
  } else if (rpcErr && !rpcErr.message.includes("Could not find the function")) {
    throw new Error(rpcErr.message);
  }

  const { data, error: verifyErr } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: tokenToVerify,
    type: "email",
  });
  if (verifyErr) throw verifyErr;
  return data;
}