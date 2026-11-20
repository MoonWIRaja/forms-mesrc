export type FieldType =
  | "heading"
  | "instructions"
  | "section"
  | "image"
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "date"
  | "time"
  | "date_time"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "star_rating"
  | "linear_scale"
  | "score_wheel"
  | "score_total"
  | "file_upload";

export type FormCategory = "company_forms" | "staff_complaints" | "voting_evaluation";
export type BackgroundPattern = "matboard_dots" | "grid_paper" | "pixel_stars" | "diagonal_craft" | "solid";
export type ProfileAutoFillKey = "display_name" | "phone" | "email";

export interface FormFieldNode {
  id: string;
  type: FieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
  /** For date / time / date_time: pre-populate with live device date/time */
  defaultToNow?: boolean;
  /** For star_rating / linear_scale */
  minRating?: number;
  maxRating?: number;
  ratingLabels?: { low?: string; high?: string };
  /** For score_wheel: configurable maximum marks (e.g. 25, 20, 15, 40, 30) */
  maxMarks?: number;
  /** For score_total: allow judge to manually override the auto-calculated total */
  allowManualOverride?: boolean;
  /** Auto-populate from signed-in user's profile */
  autoFillProfile?: ProfileAutoFillKey;
  /** Pre-filled default static value (e.g. participant name per page) */
  defaultValue?: string;
  /** Lock input as read-only (e.g. fixed company email or participant name) */
  readOnly?: boolean;
  /** Sync value across all pages sharing the same syncKey (e.g. judge_name) */
  syncKey?: string;
  /** For image block */
  imageUrl?: string;
  caption?: string;
}

export interface AdminPermissionsRow {
  profile_id: string;
  can_manage_company_forms: boolean;
  can_view_company_reports: boolean;
  can_manage_complaints: boolean;
  can_view_complaints: boolean;
  receive_complaint_emails: boolean;
  can_manage_voting: boolean;
  can_view_voting_reports: boolean;
  can_manage_users: boolean;
}

export interface FormAdminAccessRow {
  form_id: string;
  admin_id: string;
  can_edit: boolean;
  can_view_reports: boolean;
  notify_on_submit: boolean;
}

export interface FormTheme {
  category?: FormCategory;
  primaryColor?: string;
  backgroundColor?: string;
  backgroundPattern?: BackgroundPattern;
  bannerImageUrl?: string;
  bannerHeight?: "compact" | "medium" | "tall";
  backgroundImageUrl?: string;
  backgroundBlur?: number;
  backgroundOverlayOpacity?: number;
  cardRadius?: "sharp" | "rounded" | "pill";
  density?: "comfortable" | "compact";
  /** When true, card remains visible in user catalog but is locked & unclickable */
  submissionsClosed?: boolean;
  closedReason?: string;
  /** Optional custom title and subtitle for Page 1 in multi-page forms */
  page1Title?: string;
  page1Subtitle?: string;
}

export interface FormPageGroup {
  pageIndex: number;
  pageNumber: number;
  title: string;
  subtitle: string;
  /** The `section` node that starts this page (null for Page 1) */
  breakNode: FormFieldNode | null;
  breakNodeIndex: number | null;
  /** The question/content nodes inside this page along with their index in the flat nodes array */
  items: { node: FormFieldNode; flatIndex: number }[];
}

export function splitNodesIntoPages(
  nodes: FormFieldNode[],
  theme?: FormTheme | null,
): FormPageGroup[] {
  const pages: FormPageGroup[] = [
    {
      pageIndex: 0,
      pageNumber: 1,
      title: theme?.page1Title?.trim() || "Page 1",
      subtitle: theme?.page1Subtitle?.trim() || "",
      breakNode: null,
      breakNodeIndex: null,
      items: [],
    },
  ];

  nodes.forEach((node, flatIndex) => {
    if (node.type === "section") {
      const nextNum = pages.length + 1;
      pages.push({
        pageIndex: pages.length,
        pageNumber: nextNum,
        title: node.label?.trim() || `Page ${nextNum}`,
        subtitle: node.helpText?.trim() || "",
        breakNode: node,
        breakNodeIndex: flatIndex,
        items: [],
      });
    } else {
      pages[pages.length - 1].items.push({ node, flatIndex });
    }
  });

  return pages;
}

export type FormKind = "general" | "appeal_enabled" | "complaint";
export type FormState = "draft" | "published" | "archived";

export interface ServiceRow {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export interface FormRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  kind: FormKind;
  state: FormState;
  allow_save_draft: boolean;
  allow_appeal: boolean;
  current_published_version: number | null;
  latest_version: number;
  created_by?: string;
  restrict_admin_access?: boolean;
  created_at: string;
  updated_at: string;
}

export interface PageScoreSummary {
  total: number;
  maxTotal: number;
  scoredCount: number;
  totalScorable: number;
  pendingCount: number;
}

export function getFieldMaxMarks(node: FormFieldNode): number {
  if (node.type === "score_wheel") return Math.max(1, node.maxMarks ?? 25);
  if (node.type === "star_rating") return Math.max(1, node.maxRating ?? 5);
  if (node.type === "linear_scale") return Math.max(1, node.maxRating ?? 10);
  return 0;
}

export function isScorableField(node: FormFieldNode): boolean {
  return (
    node.type === "score_wheel" ||
    node.type === "star_rating" ||
    node.type === "linear_scale"
  );
}

export function computePageScoreSummary(
  pageNodes: FormFieldNode[],
  answers: Record<string, unknown>,
): PageScoreSummary {
  let total = 0;
  let maxTotal = 0;
  let scoredCount = 0;
  let totalScorable = 0;

  for (const n of pageNodes) {
    if (!isScorableField(n)) continue;
    totalScorable += 1;
    maxTotal += getFieldMaxMarks(n);
    const raw = answers[n.id];
    const hasVal =
      raw !== undefined &&
      raw !== null &&
      raw !== "" &&
      !Number.isNaN(Number(raw)) &&
      (n.type === "score_wheel" ? Number(raw) >= 0 : Number(raw) > 0);
    if (hasVal) {
      scoredCount += 1;
      total += Number(raw);
    }
  }

  return {
    total,
    maxTotal,
    scoredCount,
    totalScorable,
    pendingCount: Math.max(0, totalScorable - scoredCount),
  };
}

export interface FormTemplate {
  key: string;
  name: string;
  category: FormCategory;
  kind: FormKind;
  title: string;
  slug: string;
  description: string;
  allowAppeal: boolean;
  theme?: FormTheme;
  nodes: FormFieldNode[];
}

export const KBM_BRAND_PRIMARY = "#0f5132";
export const KBM_BRAND_GOLD = "#b8862b";
export const KBM_BRAND_BG = "#f4f2ea";

const KBM_ALLOWED_ACCENTS = new Set([
  "#0f5132",
  "#0a3b24",
  "#1b6b45",
  "#14532d",
  "#c59333",
  "#b8862b",
  "#a77922",
  "#9e7220",
  "#12231a",
]);

const KBM_ALLOWED_BGS = new Set([
  "#f4f2ea",
  "#f3efe4",
  "#ebf2ed",
  "#f7f2e3",
  "#fbfaf6",
  "#e4ede7",
  "#edf3ef",
]);

/** Ensures every form button, top accent bar, and card stays aligned with the Kayangan Bumi Medical logo palette. */
export function resolveKbmAccent(rawHex?: string | null, category?: FormCategory): string {
  const norm = rawHex?.trim().toLowerCase();
  if (norm && KBM_ALLOWED_ACCENTS.has(norm)) return norm;
  if (category === "voting_evaluation") return KBM_BRAND_GOLD;
  return KBM_BRAND_PRIMARY;
}

/** Ensures every form background tint harmonizes with Kayangan Bumi Medical Ivory/Sage/Gold cardstock. */
export function resolveKbmBg(rawHex?: string | null): string {
  const norm = rawHex?.trim().toLowerCase();
  if (norm && KBM_ALLOWED_BGS.has(norm)) return norm;
  return KBM_BRAND_BG;
}

export const FORM_CATEGORIES: {
  key: FormCategory;
  label: string;
  subtitle: string;
  defaultDbKind: FormKind;
  accent: string;
}[] = [
  {
    key: "company_forms",
    label: "Company Forms",
    subtitle: "Check-in logs, service requests, HR & official records",
    defaultDbKind: "general",
    accent: "#0f5132",
  },
  {
    key: "staff_complaints",
    label: "Staff Complaints",
    subtitle: "Confidential reports, harassment, misconduct & ticket appeals",
    defaultDbKind: "complaint",
    accent: "#0f5132",
  },
  {
    key: "voting_evaluation",
    label: "Voting & Evaluation",
    subtitle: "Competition judging, Speaker & MC scoring, and rankings",
    defaultDbKind: "general",
    accent: "#b8862b",
  },
];

export function resolveFormCategory(
  form: Pick<FormRow, "kind" | "title" | "slug">,
  theme?: FormTheme | null,
): FormCategory {
  if (
    theme?.category === "company_forms" ||
    theme?.category === "staff_complaints" ||
    theme?.category === "voting_evaluation"
  ) {
    return theme.category;
  }
  if (form.kind === "complaint" || form.kind === "appeal_enabled") {
    return "staff_complaints";
  }
  const haystack = `${form.title} ${form.slug}`.toLowerCase();
  if (haystack.includes("mcep") || haystack.includes("vote") || haystack.includes("judg")) {
    return "voting_evaluation";
  }
  return "company_forms";
}

export function getLocalNowParts(): { date: string; time: string; dateTime: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return { date, time, dateTime: `${date} ${time}` };
}

export function splitDateTimeValue(val: unknown): { date: string; time: string } {
  if (typeof val !== "string" || !val.trim()) {
    return { date: "", time: "" };
  }
  const normalized = val.trim().replace("T", " ");
  const [d, t] = normalized.split(" ");
  return {
    date: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "",
    time: t && /^\d{2}:\d{2}/.test(t) ? t.slice(0, 5) : "",
  };
}

export function getFormBackgroundPatternCss(pattern?: BackgroundPattern): string {
  switch (pattern) {
    case "grid_paper":
      return "linear-gradient(to right, rgba(24, 24, 27, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.05) 1px, transparent 1px)";
    case "pixel_stars":
      return "radial-gradient(rgba(24, 24, 27, 0.16) 1.5px, transparent 1.5px), radial-gradient(rgba(124, 58, 237, 0.15) 1.5px, transparent 1.5px)";
    case "diagonal_craft":
      return "repeating-linear-gradient(45deg, rgba(24, 24, 27, 0.03) 0, rgba(24, 24, 27, 0.03) 1px, transparent 1px, transparent 12px)";
    case "solid":
      return "none";
    case "matboard_dots":
    default:
      return "linear-gradient(to right, rgba(24, 24, 27, 0.035) 1px, transparent 1px), linear-gradient(to bottom, rgba(24, 24, 27, 0.035) 1px, transparent 1px), radial-gradient(rgba(24, 24, 27, 0.12) 1px, transparent 1px)";
  }
}

export function getFormBackgroundPatternSize(pattern?: BackgroundPattern): string {
  switch (pattern) {
    case "grid_paper":
      return "32px 32px";
    case "pixel_stars":
      return "28px 28px";
    case "diagonal_craft":
      return "auto";
    case "solid":
      return "auto";
    case "matboard_dots":
    default:
      return "48px 48px, 48px 48px, 16px 16px";
  }
}

export const PAGE_BG_TINTS: { name: string; hex: string }[] = [
  { name: "KBM Ivory Cream", hex: "#f4f2ea" },
  { name: "KBM Soft Sage", hex: "#ebf2ed" },
  { name: "KBM Champagne Gold", hex: "#f7f2e3" },
  { name: "KBM Pure Cardstock", hex: "#fbfaf6" },
  { name: "KBM Deep Sage Mist", hex: "#e4ede7" },
];

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

export const PRESET_BANNERS: { id: string; name: string; tag: string; url: string }[] = [
  {
    id: "mcep-pixel-stage",
    name: "KBM Gold Trophy Stage",
    tag: "Voting & Judging",
    url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" shape-rendering="crispEdges">
      <rect width="1200" height="300" fill="#0a3b24"/>
      <rect y="210" width="1200" height="90" fill="#0f5132"/>
      <rect x="80" y="50" width="16" height="16" fill="#e5bd67"/>
      <rect x="210" y="90" width="12" height="12" fill="#c59333"/>
      <rect x="960" y="45" width="16" height="16" fill="#e5bd67"/>
      <rect x="1080" y="110" width="12" height="12" fill="#c59333"/>
      <rect x="440" y="180" width="320" height="120" fill="#145f3b"/>
      <rect x="520" y="110" width="160" height="24" fill="#e5bd67"/>
      <rect x="550" y="60" width="100" height="60" fill="#c59333"/>
      <rect x="530" y="70" width="20" height="30" fill="#e5bd67"/>
      <rect x="650" y="70" width="20" height="30" fill="#e5bd67"/>
      <rect x="580" y="134" width="40" height="36" fill="#9e7220"/>
      <rect x="550" y="170" width="100" height="16" fill="#e5bd67"/>
      <rect x="140" y="170" width="220" height="130" fill="#0d472c" opacity="0.8"/>
      <rect x="840" y="160" width="240" height="140" fill="#0d472c" opacity="0.8"/>
    </svg>`),
  },
  {
    id: "mesrc-papercraft-wave",
    name: "KBM Emerald & Gold Waves",
    tag: "Company & Check-In",
    url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300">
      <rect width="1200" height="300" fill="#f4f2ea"/>
      <path d="M0 190 L280 120 L580 210 L920 95 L1200 180 L1200 300 L0 300 Z" fill="#e6f0ea"/>
      <path d="M0 225 L340 160 L680 230 L980 135 L1200 215 L1200 300 L0 300 Z" fill="#c59333"/>
      <path d="M0 258 L420 205 L780 262 L1200 195 L1200 300 L0 300 Z" fill="#0f5132"/>
      <rect x="110" y="55" width="32" height="32" fill="#c59333"/>
      <rect x="110" y="55" width="32" height="32" fill="none" stroke="#12231a" stroke-width="4"/>
      <rect x="1030" y="60" width="24" height="24" fill="#0f5132"/>
      <rect x="1030" y="60" width="24" height="24" fill="none" stroke="#12231a" stroke-width="4"/>
    </svg>`),
  },
  {
    id: "emerald-pixel-meadow",
    name: "KBM Forest Atelier",
    tag: "Operations & Events",
    url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" shape-rendering="crispEdges">
      <rect width="1200" height="300" fill="#e6f2eb"/>
      <rect y="180" width="1200" height="120" fill="#1b6b45"/>
      <rect y="230" width="1200" height="70" fill="#0f5132"/>
      <rect x="120" y="130" width="80" height="80" fill="#7fc09b"/>
      <rect x="240" y="110" width="96" height="110" fill="#1b6b45"/>
      <rect x="920" y="120" width="110" height="90" fill="#7fc09b"/>
      <rect x="1020" y="50" width="48" height="48" fill="#c59333"/>
    </svg>`),
  },
  {
    id: "crimson-kraft-desk",
    name: "KBM Confidential Gold Crest",
    tag: "Complaints & Notice",
    url: svgDataUrl(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 300" shape-rendering="crispEdges">
      <rect width="1200" height="300" fill="#0f5132"/>
      <rect x="60" y="40" width="340" height="260" fill="#0a3b24"/>
      <rect x="440" y="90" width="420" height="210" fill="#145f3b"/>
      <rect x="900" y="30" width="240" height="270" fill="#082e1c"/>
      <rect x="180" y="110" width="24" height="24" fill="#c59333"/>
      <rect x="760" y="140" width="20" height="20" fill="#e5bd67"/>
      <rect y="280" width="1200" height="20" fill="#c59333"/>
    </svg>`),
  },
];

/** Auto-upgrades legacy crimson/blue/purple preset SVG banners to the official KBM Emerald & Gold banners while preserving uploaded photos. */
export function resolveKbmBanner(
  url?: string | null,
  category?: FormCategory,
): string | undefined {
  if (!url) return undefined;
  const decoded = url.startsWith("data:image/svg+xml") ? decodeURIComponent(url) : "";
  const isLegacyPreset =
    decoded.includes("#881337") ||
    decoded.includes("#be123c") ||
    decoded.includes("#9f1239") ||
    decoded.includes("#1e1b4b") ||
    decoded.includes("#1d4ed8") ||
    decoded.includes("#312e81");
  if (!isLegacyPreset) return url;
  if (category === "staff_complaints") return PRESET_BANNERS[3].url;
  if (category === "voting_evaluation") return PRESET_BANNERS[0].url;
  return PRESET_BANNERS[1].url;
}

function buildSpeakerPageNodes(
  prefix: string,
  participantName: string,
  includePageBreak: boolean,
): FormFieldNode[] {
  const nodes: FormFieldNode[] = [];
  if (includePageBreak) {
    nodes.push({
      id: `${prefix}_page_break`,
      type: "section",
      label: participantName,
      helpText: "Speaker — Digital Judges' Scoring Form",
      width: "full",
    });
  }
  nodes.push(
    {
      id: `${prefix}_participant`,
      type: "short_text",
      label: "Participant / Team Name",
      defaultValue: participantName,
      readOnly: true,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_judge_name`,
      type: "short_text",
      label: "Judge's Name",
      placeholder: "Enter judge's full name...",
      helpText: "Auto-filled from your Profile (editable & synced across pages).",
      autoFillProfile: "display_name",
      syncKey: "judge_name",
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_c1_content`,
      type: "score_wheel",
      label: "1. Content Quality & Relevance",
      helpText: "Accuracy, relevance, organisation and depth of information.",
      maxMarks: 25,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_c2_visual`,
      type: "score_wheel",
      label: "2. Visual Presentation & Slide Design",
      helpText: "Slide layout, readability, visual appeal and effective use of graphics.",
      maxMarks: 20,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_c3_verbal`,
      type: "score_wheel",
      label: "3. Verbal Communication & Delivery Skills",
      helpText: "Voice projection, intonation, pronunciation, fluency and confidence.",
      maxMarks: 25,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_c4_engagement`,
      type: "score_wheel",
      label: "4. Audience Engagement & Interaction",
      helpText: "Eye contact, audience involvement and ability to sustain attention.",
      maxMarks: 15,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_c5_qa`,
      type: "score_wheel",
      label: "5. Subject Knowledge & Responsiveness (Q&A)",
      helpText: "Understanding of topic, accuracy of responses and ability to handle questions.",
      maxMarks: 15,
      required: true,
      width: "full",
    },
    {
      id: `${prefix}_final_score`,
      type: "score_total",
      label: "Final Score — Total Marks Obtained",
      helpText: "Automatically calculated from the criteria above.",
      allowManualOverride: false,
      required: false,
      width: "full",
    },
    {
      id: `${prefix}_comments`,
      type: "long_text",
      label: "Judge's Comments / Recommendations",
      placeholder: `Enter comments or recommendations for ${participantName}...`,
      required: false,
      width: "full",
    },
  );
  return nodes;
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: "check_in_out",
    name: "Check In / Check Out",
    category: "company_forms",
    kind: "general",
    title: "Check In Check Out Form",
    slug: "check-in-check-out-form",
    description: "Log daily check-in and check-out times with real-time timestamp and supporting remarks.",
    allowAppeal: false,
    theme: {
      category: "company_forms",
      primaryColor: "#7c2d12",
      backgroundColor: "#d9c8c5",
      backgroundPattern: "matboard_dots",
      bannerImageUrl: PRESET_BANNERS[1].url,
      bannerHeight: "medium",
    },
    nodes: [
      {
        id: "f_work_context",
        type: "multiple_choice",
        label: "Activity Scope",
        required: true,
        options: ["Personal", "Work related"],
        width: "full",
      },
      {
        id: "f_clock_type",
        type: "single_choice",
        label: "Type",
        required: true,
        options: ["Check In", "Check Out"],
        width: "full",
      },
      {
        id: "f_emp_name",
        type: "short_text",
        label: "Employee Name",
        placeholder: "Your full name",
        required: true,
        width: "full",
      },
      {
        id: "f_remarks",
        type: "short_text",
        label: "Remarks / Reason",
        placeholder: "Brief reason or site/activity notes",
        required: true,
        width: "full",
      },
      {
        id: "f_datetime",
        type: "date_time",
        label: "Date / Time",
        helpText: "Automatically set to current real-world date & time. Adjust manually if needed.",
        required: true,
        defaultToNow: true,
        width: "full",
      },
      {
        id: "f_proof_hours",
        type: "short_text",
        label: "Proof of hours",
        placeholder: "e.g. 8 hours / Google Drive link / reference",
        required: false,
        width: "full",
      },
    ],
  },
  {
    key: "mcep_finalist",
    name: "Competition Evaluation — Speaker & MC (5 Pages)",
    category: "voting_evaluation",
    kind: "general",
    title: "Competition Evaluation — Speaker & Master of Ceremony",
    slug: "competition-evaluation-speaker-mc",
    description: "Digital Judges' Scoring Form (Exclusive) — 4 Speakers + Master of Ceremony.",
    allowAppeal: false,
    theme: {
      category: "voting_evaluation",
      primaryColor: "#0f5132",
      backgroundColor: "#f3efe4",
      backgroundPattern: "matboard_dots",
      bannerImageUrl: PRESET_BANNERS[0].url,
      bannerHeight: "medium",
      page1Title: "Asmira Ashiqin",
      page1Subtitle: "Speaker — Digital Judges' Scoring Form",
    },
    nodes: [
      ...buildSpeakerPageNodes("p1", "Asmira Ashiqin", false),
      ...buildSpeakerPageNodes("p2", "Nur Ainun", true),
      ...buildSpeakerPageNodes("p3", "Nur Aimi Nadirah", true),
      ...buildSpeakerPageNodes("p4", "Nurul Ainnajwa", true),
      {
        id: "p5_page_break",
        type: "section",
        label: "Master of Ceremony (MC)",
        helpText: "Master of Ceremony — Digital Judges' Scoring Form",
        width: "full",
      },
      {
        id: "p5_participant",
        type: "short_text",
        label: "MC Participant Name",
        placeholder: "Enter Master of Ceremony participant name...",
        defaultValue: "Master of Ceremony (MC)",
        required: true,
        width: "full",
      },
      {
        id: "p5_judge_name",
        type: "short_text",
        label: "Judge's Name",
        placeholder: "Enter judge's full name...",
        helpText: "Auto-filled from your Profile (editable & synced across pages).",
        autoFillProfile: "display_name",
        syncKey: "judge_name",
        required: true,
        width: "full",
      },
      {
        id: "p5_mc_verbal",
        type: "score_wheel",
        label: "1. Verbal Communication & Delivery Skills",
        helpText: "Voice projection, intonation, pronunciation, fluency and stage presence.",
        maxMarks: 40,
        required: true,
        width: "full",
      },
      {
        id: "p5_mc_creativity",
        type: "score_wheel",
        label: "2. Creativity",
        helpText: "Originality, transitions, crowd energy and creative hosting style.",
        maxMarks: 30,
        required: true,
        width: "full",
      },
      {
        id: "p5_mc_sop",
        type: "score_wheel",
        label: "3. SOP & Protocol Compliance",
        helpText: "Adherence to event flow, official titles, timing and company SOP.",
        maxMarks: 30,
        required: true,
        width: "full",
      },
      {
        id: "p5_final_score",
        type: "score_total",
        label: "Final Score — Total Marks Obtained",
        helpText: "Automatically calculated from the MC criteria above.",
        allowManualOverride: false,
        required: false,
        width: "full",
      },
      {
        id: "p5_comments",
        type: "long_text",
        label: "Judge's Comments / Recommendations",
        placeholder: "Enter comments or recommendations for Master of Ceremony...",
        required: false,
        width: "full",
      },
    ],
  },
  {
    key: "competition_ranking_general",
    name: "Competition Ranking — General (4 Participants)",
    category: "voting_evaluation",
    kind: "general",
    title: "Competition Ranking — General",
    slug: "competition-ranking-general",
    description: "General staff scoring & ranking for the 4 competition finalists.",
    allowAppeal: false,
    theme: {
      category: "voting_evaluation",
      primaryColor: "#a77922",
      backgroundColor: "#f3efe4",
      backgroundPattern: "matboard_dots",
      bannerImageUrl: PRESET_BANNERS[0].url,
      bannerHeight: "compact",
      page1Title: "General Competition Ranking",
      page1Subtitle: "Score each finalist from 1 to 10",
    },
    nodes: [
      {
        id: "gen_voter_name",
        type: "short_text",
        label: "Voter's Name",
        autoFillProfile: "display_name",
        placeholder: "Auto-filled from profile (editable)",
        required: true,
        width: "full",
      },
      {
        id: "gen_asmira",
        type: "score_wheel",
        label: "Asmira Ashiqin",
        helpText: "Select general ranking score (out of 10).",
        maxMarks: 10,
        required: true,
        width: "full",
      },
      {
        id: "gen_ainun",
        type: "score_wheel",
        label: "Nur Ainun",
        helpText: "Select general ranking score (out of 10).",
        maxMarks: 10,
        required: true,
        width: "full",
      },
      {
        id: "gen_aimi",
        type: "score_wheel",
        label: "Nur Aimi Nadirah",
        helpText: "Select general ranking score (out of 10).",
        maxMarks: 10,
        required: true,
        width: "full",
      },
      {
        id: "gen_ainnajwa",
        type: "score_wheel",
        label: "Nurul Ainnajwa",
        helpText: "Select general ranking score (out of 10).",
        maxMarks: 10,
        required: true,
        width: "full",
      },
    ],
  },
  {
    key: "complaint_ticket",
    name: "Staff Complaint & Harassment Report (All-in-One)",
    category: "staff_complaints",
    kind: "complaint",
    title: "Staff Complaint & Confidential Report",
    slug: "staff-complaint-report",
    description: "Submit a confidential report (including Sexual Harassment, Misconduct, Safety, or HR issues). Only authorized Admins can view and receive email alerts.",
    allowAppeal: true,
    theme: {
      category: "staff_complaints",
      primaryColor: "#0f5132",
      backgroundColor: "#f4f2ea",
      backgroundPattern: "grid_paper",
      bannerImageUrl: PRESET_BANNERS[3].url,
      bannerHeight: "compact",
    },
    nodes: [
      {
        id: "f_reporter_name",
        type: "short_text",
        label: "Full Name",
        placeholder: "Your full name",
        helpText: "Auto-filled from your Profile (you may edit if needed).",
        autoFillProfile: "display_name",
        required: true,
        width: "full",
      },
      {
        id: "f_reporter_phone",
        type: "short_text",
        label: "Phone Number",
        placeholder: "e.g. +60 12-345 6789",
        helpText: "Auto-filled from your Profile (you may edit if needed).",
        autoFillProfile: "phone",
        required: true,
        width: "full",
      },
      {
        id: "f_reporter_email",
        type: "email",
        label: "Company Email (Fixed)",
        helpText: "Automatically linked to your verified account and cannot be changed.",
        autoFillProfile: "email",
        readOnly: true,
        required: true,
        width: "full",
      },
      {
        id: "f_category",
        type: "dropdown",
        label: "Complaint Category",
        required: true,
        options: [
          "Sexual Harassment",
          "Workplace Misconduct / Bullying",
          "Safety / Clinical Facility Issue",
          "HR / Staff Welfare",
          "Service / Operations Delay",
          "Other Confidential Matter",
        ],
        width: "full",
      },
      {
        id: "f_incident_dt",
        type: "date_time",
        label: "Incident Date & Time",
        defaultToNow: true,
        required: true,
        width: "full",
      },
      {
        id: "f_subject",
        type: "short_text",
        label: "Complaint Subject",
        placeholder: "Short headline of your report",
        required: true,
        width: "full",
      },
      {
        id: "f_description",
        type: "long_text",
        label: "Detailed Complaint Report",
        placeholder: "Describe what happened, persons involved, location, and support needed...",
        required: true,
        width: "full",
      },
      {
        id: "f_evidence",
        type: "file_upload",
        label: "Supporting Evidence (Optional, up to 1 GiB)",
        required: false,
        width: "full",
      },
    ],
  },
  {
    key: "employee_request",
    name: "General Service Request",
    category: "company_forms",
    kind: "general",
    title: "General Operations Request",
    slug: "general-operations-request",
    description: "Submit an internal service or operational request.",
    allowAppeal: false,
    theme: {
      category: "company_forms",
      primaryColor: "#0f5132",
      backgroundColor: "#f3efe4",
      backgroundPattern: "matboard_dots",
    },
    nodes: [
      { id: "hdr_1", type: "heading", label: "Requester Details", width: "full" },
      {
        id: "f_department",
        type: "dropdown",
        label: "Department / Unit",
        required: true,
        options: ["Operations", "Human Resources", "Finance", "IT & Facilities", "Other"],
        width: "half",
      },
      {
        id: "f_needed_by",
        type: "date",
        label: "Date Needed",
        defaultToNow: true,
        required: false,
        width: "half",
      },
      {
        id: "f_summary",
        type: "short_text",
        label: "Request Summary",
        placeholder: "Brief summary of what you need",
        required: true,
        width: "full",
      },
      {
        id: "f_details",
        type: "long_text",
        label: "Detailed Description",
        helpText: "Provide relevant context, reference numbers, or background.",
        required: true,
        width: "full",
      },
      {
        id: "f_attachment",
        type: "file_upload",
        label: "Supporting Document (Optional, up to 1 GiB)",
        helpText: "Stored privately in company Google Workspace Shared Drive.",
        required: false,
        width: "full",
      },
    ],
  },
  {
    key: "appeal_application",
    name: "Formal Appeal Application",
    category: "staff_complaints",
    kind: "appeal_enabled",
    title: "Formal Review & Appeal Form",
    slug: "formal-review-appeal",
    description: "Submit a formal appeal or review request with supporting grounds.",
    allowAppeal: true,
    theme: {
      category: "staff_complaints",
      primaryColor: "#b45309",
      backgroundColor: "#ede3d2",
      backgroundPattern: "grid_paper",
    },
    nodes: [
      {
        id: "ins_1",
        type: "instructions",
        label: "Please state the decision reference and grounds for your appeal clearly.",
        width: "full",
      },
      {
        id: "f_ref_no",
        type: "short_text",
        label: "Reference / Case Number",
        required: true,
        width: "half",
      },
      {
        id: "f_decision_date",
        type: "date",
        label: "Original Decision Date",
        required: true,
        width: "half",
      },
      {
        id: "f_grounds",
        type: "single_choice",
        label: "Primary Ground for Appeal",
        required: true,
        options: [
          "New supporting evidence available",
          "Procedural irregularity",
          "Mitigating circumstances",
          "Other",
        ],
        width: "full",
      },
      {
        id: "f_statement",
        type: "long_text",
        label: "Appeal Statement",
        required: true,
        width: "full",
      },
    ],
  },
];
