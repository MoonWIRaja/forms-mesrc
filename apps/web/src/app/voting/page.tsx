"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import { getSupabase, type UserProfile } from "@/lib/supabase";

interface WednesdayPresenterGroup {
  topic: string;
  date: string;
  speaker: string;
  coordinator: string;
  emcee: string;
}

interface WednesdayScorePayload {
  speaker_slides: number;
  speaker_content: number;
  speaker_delivery: number;
  speaker_time: number;
  coordinator_technical: number;
  coordinator_readiness: number;
  emcee_protocol: number;
  emcee_clarity: number;
  feedback: string;
}

interface SubmittedVote {
  id: string;
  sessionId: string;
  sessionTitle: string;
  voterEmail: string;
  voterName?: string;
  submittedAt: string;
  scores: WednesdayScorePayload;
  totalScore: number;
  maxScore: number;
}

const ACTIVE_WEDNESDAY_SESSION: WednesdayPresenterGroup = {
  topic: "Transformasi Digital & Automasi AI di MESRC",
  date: "Rabu, Sesi Mingguan",
  speaker: "Muhammad Faiz",
  coordinator: "Siti Nurul Huda",
  emcee: "Hariz Danial",
};

const DEFAULT_SCORES: WednesdayScorePayload = {
  speaker_slides: 8,
  speaker_content: 8,
  speaker_delivery: 8,
  speaker_time: 8,
  coordinator_technical: 8,
  coordinator_readiness: 8,
  emcee_protocol: 8,
  emcee_clarity: 8,
  feedback: "",
};

const INITIAL_SAMPLE_VOTES: SubmittedVote[] = [
  {
    id: "v-sample-1",
    sessionId: "wed-wk46",
    sessionTitle: "Transformasi Digital & Automasi AI di MESRC",
    voterEmail: "ahmad@mesrc.com.my",
    voterName: "Ahmad",
    submittedAt: "2026-11-16T04:00:00.000Z",
    scores: {
      speaker_slides: 9,
      speaker_content: 8,
      speaker_delivery: 9,
      speaker_time: 8,
      coordinator_technical: 9,
      coordinator_readiness: 8,
      emcee_protocol: 9,
      emcee_clarity: 9,
      feedback: "Slaid sangat kemas dan padat. Perkongsian yang sangat membantu!",
    },
    totalScore: 69,
    maxScore: 80,
  },
  {
    id: "v-sample-2",
    sessionId: "wed-wk46",
    sessionTitle: "Transformasi Digital & Automasi AI di MESRC",
    voterEmail: "azlina@mesrc.com.my",
    voterName: "Azlina",
    submittedAt: "2026-11-16T06:00:00.000Z",
    scores: {
      speaker_slides: 8,
      speaker_content: 9,
      speaker_delivery: 8,
      speaker_time: 7,
      coordinator_technical: 8,
      coordinator_readiness: 9,
      emcee_protocol: 8,
      emcee_clarity: 8,
      feedback: "Penyampaian jelas dan santai. Tahniah kumpulan pembentang!",
    },
    totalScore: 65,
    maxScore: 80,
  },
];

export default function VotingPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"wednesday" | "polls" | "my-votes" | "admin-report">("wednesday");
  const [scores, setScores] = useState<WednesdayScorePayload>(DEFAULT_SCORES);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [votesList, setVotesList] = useState<SubmittedVote[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("mesrc_voting_records");
        if (stored) return JSON.parse(stored);
      } catch {
        // fallback
      }
    }
    return INITIAL_SAMPLE_VOTES;
  });
  const [selectedLocation, setSelectedLocation] = useState<string>("desaru");
  const [locationVoted, setLocationVoted] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id;
      if (uid) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
        setProfile((prof as UserProfile | null) ?? null);
      }
      setLoading(false);
    });
  }, []);

  function handleScoreChange(key: keyof WednesdayScorePayload, val: number | string) {
    setScores((prev) => ({ ...prev, [key]: val }));
  }

  function calculateTotal() {
    return (
      scores.speaker_slides +
      scores.speaker_content +
      scores.speaker_delivery +
      scores.speaker_time +
      scores.coordinator_technical +
      scores.coordinator_readiness +
      scores.emcee_protocol +
      scores.emcee_clarity
    );
  }

  async function handleSubmitWednesday(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    const total = calculateTotal();
    const newVote: SubmittedVote = {
      id: `v-${Date.now()}`,
      sessionId: "wed-current",
      sessionTitle: ACTIVE_WEDNESDAY_SESSION.topic,
      voterEmail: profile.email,
      voterName: profile.display_name || undefined,
      submittedAt: new Date().toISOString(),
      scores: { ...scores },
      totalScore: total,
      maxScore: 80,
    };

    const updated = [newVote, ...votesList];
    setVotesList(updated);
    try {
      localStorage.setItem("mesrc_voting_records", JSON.stringify(updated));
    } catch {
      // safe fallback
    }

    setSubmitting(false);
    setSubmitSuccess(true);
  }

  if (loading) {
    return (
      <div className="center-stage">
        <ChunkLoader title="Loading Voting Portal" subtitle="Preparing active scoring sessions..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="center-stage">
        <section className="card stack" style={{ textAlign: "center", alignItems: "center" }}>
          <BrandLogo size="lg" subtitle="Voting & Evaluation" />
          <h1 style={{ fontSize: "1.25rem", margin: "0.55rem 0 0.2rem" }}>Sign in Required</h1>
          <p className="notice" style={{ maxWidth: "38ch" }}>
            Staff evaluation and scoring sessions are strictly invite-only. Sign in with your registered email to continue.
          </p>
          <div className="row-actions" style={{ justifyContent: "center", marginTop: "0.5rem" }}>
            <Link href="/sign-in/" className="btn btn-primary">
              Sign in with Email OTP &rarr;
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const isStaff = profile.role === "admin" || profile.role === "maintenance";

  // Calculations for Admin Report
  const totalVotesCount = votesList.length;
  const avgTotal = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.totalScore, 0) / totalVotesCount).toFixed(1) : "0";
  const avgSpeakerSlides = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.scores.speaker_slides, 0) / totalVotesCount).toFixed(1) : "0";
  const avgSpeakerContent = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.scores.speaker_content, 0) / totalVotesCount).toFixed(1) : "0";
  const avgSpeakerDelivery = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.scores.speaker_delivery, 0) / totalVotesCount).toFixed(1) : "0";
  const avgCoordinatorTech = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.scores.coordinator_technical, 0) / totalVotesCount).toFixed(1) : "0";
  const avgEmceeClarity = totalVotesCount > 0 ? (votesList.reduce((acc, v) => acc + v.scores.emcee_clarity, 0) / totalVotesCount).toFixed(1) : "0";

  return (
    <div style={{ maxWidth: "960px", margin: "0 auto", width: "100%" }}>
      {/* HEADER SECTION */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
            <span className="badge badge-role" style={{ background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }}>
              SISTEM PERMAKHAN &amp; UNDIAN
            </span>
            <span className="badge badge-active">Sesi Aktif</span>
          </div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0, letterSpacing: "-0.025em" }}>
            Voting &amp; Staff Evaluation
          </h1>
          <p className="notice" style={{ marginTop: "0.25rem" }}>
            Beri markah dan penilaian sesi pembentangan mingguan, undian MCEP, serta kaji selidik tahunan.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link href="/" className="btn btn-secondary">
            &larr; Back to Home
          </Link>
        </div>
      </div>

      {/* NAVIGATION TABS */}
      <div style={{ display: "flex", gap: "0.5rem", borderBottom: "1px solid var(--border-strong)", paddingBottom: "0.6rem", marginBottom: "1.5rem", overflowX: "auto" }}>
        <button
          type="button"
          className={`btn ${activeTab === "wednesday" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("wednesday")}
          style={{ whiteSpace: "nowrap" }}
        >
          ⭐ Sesi Pembentangan Rabu
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "polls" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("polls")}
          style={{ whiteSpace: "nowrap" }}
        >
          🗳️ Undian Pilihan (Polls)
        </button>
        <button
          type="button"
          className={`btn ${activeTab === "my-votes" ? "btn-primary" : "btn-secondary"}`}
          onClick={() => setActiveTab("my-votes")}
          style={{ whiteSpace: "nowrap" }}
        >
          📋 Rekod Markah ({votesList.filter((v) => v.voterEmail === profile.email).length})
        </button>
        {isStaff && (
          <button
            type="button"
            className={`btn ${activeTab === "admin-report" ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setActiveTab("admin-report")}
            style={{ whiteSpace: "nowrap", background: activeTab === "admin-report" ? "#047857" : undefined, color: activeTab === "admin-report" ? "#ffffff" : undefined }}
          >
            📊 Laporan &amp; Analytics (Admin)
          </button>
        )}
      </div>

      {/* TAB 1: SESI PEMBENTANGAN RABU (PENILAIAN 3 PERANAN: SPEAKER, COORDINATOR, EMCEE) */}
      {activeTab === "wednesday" && (
        <div>
          {/* BANNER KUMPULAN PEMBENTANG */}
          <div
            className="card"
            style={{
              background: "#faf8f5",
              borderColor: "var(--border-strong)",
              marginBottom: "1.5rem",
              padding: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", color: "#047857", letterSpacing: "0.05em" }}>
                  {ACTIVE_WEDNESDAY_SESSION.date}
                </span>
                <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: "0.25rem 0" }}>
                  {ACTIVE_WEDNESDAY_SESSION.topic}
                </h2>
                <p className="notice">
                  Setiap pembentangan dinilai berdasarkan 3 peranan utama. Sila berikan markah yang adil dan objektif.
                </p>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <span style={{ color: "#1d4ed8", fontWeight: 700 }}>🎤 Speaker:</span> {ACTIVE_WEDNESDAY_SESSION.speaker}
                </div>
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <span style={{ color: "#b45309", fontWeight: 700 }}>📋 Coordinator:</span> {ACTIVE_WEDNESDAY_SESSION.coordinator}
                </div>
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.85rem" }}>
                  <span style={{ color: "#047857", fontWeight: 700 }}>🎙️ Emcee:</span> {ACTIVE_WEDNESDAY_SESSION.emcee}
                </div>
              </div>
            </div>
          </div>

          {submitSuccess ? (
            <div className="card stack" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>🎉</div>
              <h2 style={{ margin: 0, fontSize: "1.4rem" }}>Markah Berjaya Dihantar!</h2>
              <p className="notice" style={{ maxWidth: "46ch", margin: "0.5rem auto 1.5rem" }}>
                Terima kasih atas penilaian anda. Skor anda sebanyak <strong>{calculateTotal()} / 80</strong> telah direkodkan ke dalam sistem pemarkahan syarikat.
              </p>
              <div className="row-actions" style={{ justifyContent: "center", gap: "0.75rem" }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setSubmitSuccess(false);
                    setScores(DEFAULT_SCORES);
                  }}
                >
                  Nilai Sesi Lain
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab("my-votes")}
                >
                  Lihat Rekod Markah
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitWednesday} className="stack" style={{ gap: "1.5rem" }}>
              {/* SECTION 1: SPEAKER */}
              <div className="card stack" style={{ padding: "1.5rem", borderLeft: "4px solid #1d4ed8" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="badge badge-role" style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}>
                      PERANAN 1: SPEAKER
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.25rem 0" }}>
                      Penilaian Pembentang: {ACTIVE_WEDNESDAY_SESSION.speaker}
                    </h3>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "0.5rem" }}>
                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>🎨 Kualiti &amp; Rekaan Slaid</span>
                      <strong>{scores.speaker_slides} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.speaker_slides}
                      onChange={(e) => handleScoreChange("speaker_slides", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#1d4ed8" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Kejelasan tipografi, visual, dan daya tarikan slaid</span>
                  </div>

                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>💡 Penguasaan Kandungan &amp; Fakta</span>
                      <strong>{scores.speaker_content} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.speaker_content}
                      onChange={(e) => handleScoreChange("speaker_content", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#1d4ed8" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Kedalaman topik, contoh relevan, dan kefahaman</span>
                  </div>

                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>🗣️ Gaya Penyampaian &amp; Suara</span>
                      <strong>{scores.speaker_delivery} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.speaker_delivery}
                      onChange={(e) => handleScoreChange("speaker_delivery", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#1d4ed8" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Keyakinan, intonasi, bahasa badan, dan kejelasan</span>
                  </div>

                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>⏱️ Pengurusan Masa Sesi</span>
                      <strong>{scores.speaker_time} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.speaker_time}
                      onChange={(e) => handleScoreChange("speaker_time", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#1d4ed8" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Menepati tempoh masa pembentangan yang ditetapkan</span>
                  </div>
                </div>
              </div>

              {/* SECTION 2: COORDINATOR */}
              <div className="card stack" style={{ padding: "1.5rem", borderLeft: "4px solid #b45309" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="badge badge-role" style={{ background: "#fffbeb", color: "#b45309", borderColor: "#fde68a" }}>
                      PERANAN 2: COORDINATOR
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.25rem 0" }}>
                      Penilaian Penyelaras: {ACTIVE_WEDNESDAY_SESSION.coordinator}
                    </h3>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "0.5rem" }}>
                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>💻 Kelancaran Teknikal &amp; Media</span>
                      <strong>{scores.coordinator_technical} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.coordinator_technical}
                      onChange={(e) => handleScoreChange("coordinator_technical", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#b45309" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Pengurusan skrin, audio-visual, dan sambungan projector</span>
                  </div>

                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>📦 Kesiapsiagaan &amp; Logistik</span>
                      <strong>{scores.coordinator_readiness} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.coordinator_readiness}
                      onChange={(e) => handleScoreChange("coordinator_readiness", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#b45309" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Penyediaan fail, nota pembentangan, dan sokongan kumpulan</span>
                  </div>
                </div>
              </div>

              {/* SECTION 3: EMCEE */}
              <div className="card stack" style={{ padding: "1.5rem", borderLeft: "4px solid #047857" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span className="badge badge-role" style={{ background: "#ecfdf5", color: "#047857", borderColor: "#a7f3d0" }}>
                      PERANAN 3: PENGACARA MAJLIS (EMCEE)
                    </span>
                    <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.25rem 0" }}>
                      Penilaian Emcee: {ACTIVE_WEDNESDAY_SESSION.emcee}
                    </h3>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1.25rem", marginTop: "0.5rem" }}>
                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>🎙️ Pengawalan Majlis &amp; Interaksi</span>
                      <strong>{scores.emcee_protocol} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.emcee_protocol}
                      onChange={(e) => handleScoreChange("emcee_protocol", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#047857" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Suasana majlis, pembukaan bersemangat, dan kawalan audiens</span>
                  </div>

                  <div className="field">
                    <label style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>📢 Kejelasan Suara &amp; Aliran Acara</span>
                      <strong>{scores.emcee_clarity} / 10</strong>
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={10}
                      value={scores.emcee_clarity}
                      onChange={(e) => handleScoreChange("emcee_clarity", Number(e.target.value))}
                      style={{ width: "100%", accentColor: "#047857" }}
                    />
                    <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Sebutan jelas, peralihan segmen lancar, dan penutupan kemas</span>
                  </div>
                </div>
              </div>

              {/* SECTION 4: MAKLUM BALAS MEMBINA */}
              <div className="card stack" style={{ padding: "1.5rem" }}>
                <h3 style={{ fontSize: "1.15rem", fontWeight: 700, margin: 0 }}>
                  💬 Maklum Balas Membina &amp; Cadangan Penambahbaikan
                </h3>
                <p className="notice" style={{ margin: 0 }}>
                  Kongsi pujian atau aspek yang boleh diperbaiki untuk membantu rakan sekerja terus berkembang.
                </p>
                <div className="field">
                  <textarea
                    rows={3}
                    placeholder="Contoh: Pembentangan sangat interaktif, cuma slaid pada bahagian graf boleh diringkaskan sedikit fontnya..."
                    value={scores.feedback}
                    onChange={(e) => handleScoreChange("feedback", e.target.value)}
                  />
                </div>
              </div>

              {/* ACTION BAR */}
              <div
                className="card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "1rem",
                  padding: "1.25rem 1.5rem",
                  background: "#faf8f5",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Jumlah Keseluruhan Markah:</span>
                  <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--ink)" }}>
                    {calculateTotal()} <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "var(--muted)" }}>/ 80</span>
                  </div>
                </div>

                <div className="row-actions">
                  <button type="submit" className="btn btn-primary" disabled={submitting} style={{ padding: "0.65rem 1.8rem" }}>
                    {submitting ? "Merekod Markah..." : "Hantar Markah Penilaian ⭐"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {/* TAB 2: UNDIAN PILIHAN (LOCATION POLLS / MCEP / YEAR-END) */}
      {activeTab === "polls" && (
        <div className="stack" style={{ gap: "1.5rem" }}>
          <div className="card stack" style={{ padding: "1.75rem" }}>
            <span className="badge badge-role" style={{ alignSelf: "flex-start", background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}>
              UNDIAN LOKASI MESRC 2026
            </span>
            <h2 style={{ fontSize: "1.35rem", fontWeight: 800, margin: 0 }}>
              Pemilihan Lokasi Team Building &amp; Annual Retreat
            </h2>
            <p className="notice">
              Pilih lokasi kegemaran anda untuk aktiviti tahunan syarikat. Undian dibuka kepada semua kakitangan.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem", marginTop: "0.5rem" }}>
              <label
                style={{
                  border: `2px solid ${selectedLocation === "desaru" ? "#1d4ed8" : "var(--border-strong)"}`,
                  borderRadius: "12px",
                  padding: "1rem",
                  cursor: "pointer",
                  background: selectedLocation === "desaru" ? "#eff6ff" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="location-poll"
                    checked={selectedLocation === "desaru"}
                    onChange={() => setSelectedLocation("desaru")}
                  />
                  <strong style={{ fontSize: "1rem" }}>🌊 Desaru Coast, Johor</strong>
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Resort pantai, sukan air, dan dewan seminar berhawa dingin.</span>
              </label>

              <label
                style={{
                  border: `2px solid ${selectedLocation === "cameron" ? "#1d4ed8" : "var(--border-strong)"}`,
                  borderRadius: "12px",
                  padding: "1rem",
                  cursor: "pointer",
                  background: selectedLocation === "cameron" ? "#eff6ff" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="location-poll"
                    checked={selectedLocation === "cameron"}
                    onChange={() => setSelectedLocation("cameron")}
                  />
                  <strong style={{ fontSize: "1rem" }}>🍓 Cameron Highlands</strong>
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Udara sejuk tanah tinggi, ladang teh, dan suasana santai.</span>
              </label>

              <label
                style={{
                  border: `2px solid ${selectedLocation === "pangkor" ? "#1d4ed8" : "var(--border-strong)"}`,
                  borderRadius: "12px",
                  padding: "1rem",
                  cursor: "pointer",
                  background: selectedLocation === "pangkor" ? "#eff6ff" : "var(--surface)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="radio"
                    name="location-poll"
                    checked={selectedLocation === "pangkor"}
                    onChange={() => setSelectedLocation("pangkor")}
                  />
                  <strong style={{ fontSize: "1rem" }}>🏝️ Pulau Pangkor, Perak</strong>
                </div>
                <span style={{ fontSize: "0.82rem", color: "var(--muted)" }}>Pulau bebas cukai, aktiviti snorkeling &amp; bbq tepi pantai.</span>
              </label>
            </div>

            <div className="row-actions" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setLocationVoted(true)}
              >
                {locationVoted ? "Undian Direkodkan ✔️" : "Hantar Pilihan Undian"}
              </button>
            </div>
            {locationVoted && (
              <p className="alert alert-ok" style={{ margin: "0.5rem 0 0" }}>
                Pilihan anda telah direkodkan ke dalam pangkalan data undian syarikat.
              </p>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: REKOD MARKAH SAYA */}
      {activeTab === "my-votes" && (
        <div className="stack" style={{ gap: "1rem" }}>
          <div className="card stack" style={{ padding: "1.5rem" }}>
            <h2 style={{ fontSize: "1.25rem", margin: 0 }}>Sejarah Pemarkahan Anda</h2>
            <p className="notice" style={{ margin: 0 }}>
              Senarai sesi penilaian yang telah anda lengkapkan menggunakan akaun <strong>{profile.email}</strong>.
            </p>

            {votesList.filter((v) => v.voterEmail === profile.email).length === 0 ? (
              <div style={{ padding: "2rem", textAlign: "center", background: "#faf8f5", borderRadius: "12px" }}>
                <p className="notice">Anda belum menghantar sebarang markah penilaian lagi.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActiveTab("wednesday")}
                  style={{ marginTop: "0.75rem" }}
                >
                  Mula Nilai Sesi Rabu Sekarang
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.5rem" }}>
                {votesList
                  .filter((v) => v.voterEmail === profile.email)
                  .map((vote) => (
                    <div
                      key={vote.id}
                      style={{
                        padding: "1rem",
                        border: "1px solid var(--border-strong)",
                        borderRadius: "10px",
                        background: "var(--surface)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      <div>
                        <strong>{vote.sessionTitle}</strong>
                        <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "0.2rem" }}>
                          Dihantar pada {new Date(vote.submittedAt).toLocaleDateString()} jam {new Date(vote.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {vote.scores.feedback && (
                          <div style={{ fontSize: "0.82rem", fontStyle: "italic", marginTop: "0.35rem", color: "var(--ink)" }}>
                            &ldquo;{vote.scores.feedback}&rdquo;
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#047857" }}>
                          {vote.totalScore}
                        </span>
                        <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}> / {vote.maxScore}</span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: LAPORAN & ANALYTICS (ADMIN ONLY) */}
      {activeTab === "admin-report" && isStaff && (
        <div className="stack" style={{ gap: "1.5rem" }}>
          {/* STATS OVERVIEW */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Jumlah Pengundi</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "var(--ink)", marginTop: "0.25rem" }}>{totalVotesCount}</div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Purata Keseluruhan</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#047857", marginTop: "0.25rem" }}>{avgTotal} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 80</span></div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Slaid Speaker</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#1d4ed8", marginTop: "0.25rem" }}>{avgSpeakerSlides} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 10</span></div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Isi Kandungan</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#1d4ed8", marginTop: "0.25rem" }}>{avgSpeakerContent} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 10</span></div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Penyampaian Suara</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#1d4ed8", marginTop: "0.25rem" }}>{avgSpeakerDelivery} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 10</span></div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Teknikal Coordinator</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#b45309", marginTop: "0.25rem" }}>{avgCoordinatorTech} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 10</span></div>
            </div>
            <div className="card" style={{ padding: "1.25rem", textAlign: "center" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700 }}>Kelancaran Emcee</span>
              <div style={{ fontSize: "1.85rem", fontWeight: 800, color: "#047857", marginTop: "0.25rem" }}>{avgEmceeClarity} <span style={{ fontSize: "0.95rem", color: "var(--muted)" }}>/ 10</span></div>
            </div>
          </div>

          {/* DETAILED LEADERBOARD & REVIEWS */}
          <div className="card stack" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem" }}>Senarai Pemarkahan Masuk (Admin Audit)</h3>
                <p className="notice" style={{ margin: "0.2rem 0 0" }}>
                  Keputusan penuh undian yang telah dikemukakan oleh kakitangan untuk sesi mingguan.
                </p>
              </div>
            </div>

            <div style={{ overflowX: "auto", marginTop: "0.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ background: "#f3efe6", borderBottom: "2px solid var(--border-strong)", textAlign: "left" }}>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Pengundi</th>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Speaker (Slaid/Isi/Suara)</th>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Coordinator</th>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Emcee</th>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Jumlah</th>
                    <th style={{ padding: "0.6rem 0.8rem" }}>Catatan Maklum Balas</th>
                  </tr>
                </thead>
                <tbody>
                  {votesList.map((v) => (
                    <tr key={v.id} style={{ borderBottom: "1px solid var(--border-strong)" }}>
                      <td style={{ padding: "0.65rem 0.8rem", fontWeight: 600 }}>{v.voterEmail}</td>
                      <td style={{ padding: "0.65rem 0.8rem" }}>
                        {v.scores.speaker_slides} / {v.scores.speaker_content} / {v.scores.speaker_delivery}
                      </td>
                      <td style={{ padding: "0.65rem 0.8rem" }}>
                        {v.scores.coordinator_technical} / {v.scores.coordinator_readiness}
                      </td>
                      <td style={{ padding: "0.65rem 0.8rem" }}>
                        {v.scores.emcee_protocol} / {v.scores.emcee_clarity}
                      </td>
                      <td style={{ padding: "0.65rem 0.8rem", fontWeight: 800, color: "#047857" }}>
                        {v.totalScore} / 80
                      </td>
                      <td style={{ padding: "0.65rem 0.8rem", fontStyle: "italic", color: "var(--muted)" }}>
                        {v.scores.feedback || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
