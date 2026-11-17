"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import ProfileSheetModal from "@/components/ProfileSheetModal";
import { getSupabase, type UserProfile } from "@/lib/supabase";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;

        const { data } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        if (!active) return;
        setProfile((data as UserProfile | null) ?? null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <ChunkLoader title="User Profile" subtitle="Loading account profile..." />;
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Sign In Required</h1>
          <p className="notice">Please sign in to view your profile.</p>
          <div className="row-actions">
            <Link href="/sign-in/" className="pixel-paper-btn primary">
              Sign In
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <ProfileSheetModal
      profile={profile}
      onClose={() => router.push("/")}
      onUpdated={(next) => setProfile(next)}
    />
  );
}
