"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type SystemSetupState, type UserProfile } from "@/lib/supabase";

export default function HomePage() {
  const [setupState, setSetupState] = useState<SystemSetupState | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewChunk, setPreviewChunk] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabase();
        const [{ data: st }, { data: sess }] = await Promise.all([
          supabase.rpc("get_system_setup_state"),
          supabase.auth.getSession(),
        ]);
        setSetupState((st as SystemSetupState | null) ?? null);
        const uid = sess.session?.user?.id;
        if (uid) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", uid)
            .maybeSingle();
          setProfile((prof as UserProfile | null) ?? null);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function triggerChunkPreview() {
    setPreviewChunk(true);
    window.setTimeout(() => setPreviewChunk(false), 1800);
  }

  if (loading || previewChunk) {
    return (
      <ChunkLoader
        title="SPAWNING MESRC JOURNAL CHUNKS..."
        subtitle="Rendering 3D notebook sheets, voxel blocks, and encrypted workspace state"
        variant="both"
      />
    );
  }

  if (setupState?.needs_first_maintenance) {
    return (
      <div className="stack">
        <section className="card stack">
          <div className="paper-tape paper-tape-tl" aria-hidden="true" />
          <div className="paper-tape paper-tape-tr" aria-hidden="true" />

          <div className="journal-hero-banner">
            <div className="stack" style={{ gap: "0.65rem" }}>
              <div className="row-actions">
                <span className="brutal-tag tag-yellow">QUEST #00 &bull; WORLD UNINITIALIZED</span>
                <span className="brutal-tag tag-coral">BOOTSTRAP LOCKED</span>
              </div>
              <h1>Welcome to Forms MESRC</h1>
              <p className="notice" style={{ margin: 0 }}>
                This workspace has not been spawned yet! Before anyone can sign in, complete the
                <strong> First-Time Setup Journal</strong> to claim the initial Maintenance account via
                email OTP and link your company Google Workspace Shared Drive vault.
              </p>
            </div>

            {/* Custom 3D Isometric Voxel Book & Chest Illustration */}
            <div className="voxel-badge" style={{ padding: "0.85rem" }} aria-hidden="true">
              <svg width="86" height="86" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Hard base shadow */}
                <polygon points="46,14 82,32 82,68 46,84 10,68 10,32" fill="#18181b" />
                {/* Isometric Voxel Top (Gold/Paper) */}
                <polygon points="44,10 80,28 44,46 8,28" fill="#facc15" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
                {/* Isometric Left Face (Emerald) */}
                <polygon points="8,28 44,46 44,80 8,62" fill="#4ade80" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
                {/* Isometric Right Face (Diamond Cyan) */}
                <polygon points="44,46 80,28 80,62 44,80" fill="#38bdf8" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
                {/* Voxel Clasp / Lock on the front */}
                <rect x="38" y="40" width="12" height="16" rx="2" fill="#ffffff" stroke="#18181b" strokeWidth="3" />
                <rect x="42" y="46" width="4" height="6" fill="#18181b" />
              </svg>
            </div>
          </div>

          <div className="quest-grid">
            <div className="quest-slot">
              <div className="row-between">
                <span className="quest-slot-num">01</span>
                <span className="brutal-tag tag-yellow">CLAIM</span>
              </div>
              <strong>Register First Maintenance</strong>
              <span className="notice" style={{ fontSize: "0.88rem" }}>
                Enter the primary administrator email to claim world ownership.
              </span>
            </div>

            <div className="quest-slot">
              <div className="row-between">
                <span className="quest-slot-num">02</span>
                <span className="brutal-tag tag-green">OTP CODE</span>
              </div>
              <strong>Verify Email Passcode</strong>
              <span className="notice" style={{ fontSize: "0.88rem" }}>
                Confirm the 6-digit OTP to permanently lock public bootstrap.
              </span>
            </div>

            <div className="quest-slot">
              <div className="row-between">
                <span className="quest-slot-num">03</span>
                <span className="brutal-tag tag-cyan">SHARED DRIVE</span>
              </div>
              <strong>Connect 1 GiB Vault</strong>
              <span className="notice" style={{ fontSize: "0.88rem" }}>
                Link your Google Workspace Shared Drive with guided (i) sticky notes.
              </span>
            </div>
          </div>

          <div className="row-actions">
            <Link href="/setup/" className="btn btn-primary">
              Start First-Time Setup Wizard &rarr;
            </Link>
            <button type="button" className="btn btn-secondary" onClick={triggerChunkPreview}>
              Test Chunk Load Screen
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="stack">
      <section className="card stack">
        <div className="paper-tape paper-tape-tl" aria-hidden="true" />
        <div className="paper-tape paper-tape-tr" aria-hidden="true" />

        <div className="journal-hero-banner">
          <div className="stack" style={{ gap: "0.65rem" }}>
            <div className="row-actions">
              <span className="brutal-tag tag-green">FIELD JOURNAL &bull; ONLINE</span>
              <span className="brutal-tag tag-cyan">INVITE-ONLY ACCESS</span>
            </div>
            <h1>Forms MESRC</h1>
            <p className="notice" style={{ margin: 0 }}>
              Interactive company forms, versioned blueprints, appeals, and atomic support tickets
              crafted inside a tactile 3D paper journal.
            </p>
          </div>

          <div className="voxel-badge" style={{ padding: "0.85rem" }} aria-hidden="true">
            <svg width="80" height="80" viewBox="0 0 88 88" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="46,14 82,32 82,68 46,84 10,68 10,32" fill="#18181b" />
              <polygon points="44,10 80,28 44,46 8,28" fill="#facc15" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
              <polygon points="8,28 44,46 44,80 8,62" fill="#fb7185" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
              <polygon points="44,46 80,28 80,62 44,80" fill="#4ade80" stroke="#18181b" strokeWidth="3.5" strokeLinejoin="round" />
              <rect x="38" y="40" width="12" height="16" rx="2" fill="#ffffff" stroke="#18181b" strokeWidth="3" />
            </svg>
          </div>
        </div>

        <div className="quest-grid">
          <div className="quest-slot">
            <div className="row-between">
              <span className="quest-slot-num">A</span>
              <span className="brutal-tag tag-yellow">BLUEPRINTS</span>
            </div>
            <strong>Versioned Forms</strong>
            <span className="notice" style={{ fontSize: "0.88rem" }}>
              Fill out published forms with draft saving &amp; allowlist security.
            </span>
          </div>

          <div className="quest-slot">
            <div className="row-between">
              <span className="quest-slot-num">B</span>
              <span className="brutal-tag tag-cyan">1 GiB VAULT</span>
            </div>
            <strong>Drive Attachments</strong>
            <span className="notice" style={{ fontSize: "0.88rem" }}>
              Private company Google Workspace Shared Drive storage per submission.
            </span>
          </div>

          <div className="quest-slot">
            <div className="row-between">
              <span className="quest-slot-num">C</span>
              <span className="brutal-tag tag-coral">ATOMIC CLAIM</span>
            </div>
            <strong>Appeals &amp; Tickets</strong>
            <span className="notice" style={{ fontSize: "0.88rem" }}>
              Single-owner ticket claiming, decision history &amp; co-op help requests.
            </span>
          </div>
        </div>

        {profile ? (
          <div className="row-actions">
            <Link href="/forms/" className="btn btn-primary">
              Open Forms Catalog &rarr;
            </Link>
            <Link href="/tickets/" className="btn btn-emerald">
              Appeals &amp; Tickets
            </Link>
            {(profile.role === "admin" || profile.role === "maintenance") && (
              <Link href="/admin/" className="btn btn-secondary">
                Admin Workspace
              </Link>
            )}
            {profile.role === "maintenance" && (
              <>
                <Link href="/maintenance/" className="btn btn-secondary">
                  Maintenance &amp; Invites
                </Link>
                <Link href="/maintenance/settings/" className="btn btn-secondary">
                  Integration Settings
                </Link>
              </>
            )}
            <button type="button" className="btn btn-secondary" onClick={triggerChunkPreview}>
              Replay Chunk Loader
            </button>
          </div>
        ) : (
          <div className="row-actions">
            <Link href="/sign-in/" className="btn btn-primary">
              Sign in with Email OTP &rarr;
            </Link>
            <button type="button" className="btn btn-secondary" onClick={triggerChunkPreview}>
              Preview Chunk Load Screen
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
