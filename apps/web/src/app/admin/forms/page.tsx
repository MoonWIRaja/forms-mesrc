"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import ChunkLoader from "@/components/ChunkLoader";
import FormRenderer from "@/components/FormRenderer";
import MediaPickerModal from "@/components/MediaPickerModal";
import {
  PixelArrowDownIcon,
  PixelArrowLeftIcon,
  PixelArrowRightIcon,
  PixelArrowUpIcon,
  PixelCatalogIcon,
  PixelCheckIcon,
  PixelCheckboxIcon,
  PixelClipIcon,
  PixelClockIcon,
  PixelDateIcon,
  PixelDateTimeIcon,
  PixelDesktopIcon,
  PixelDividerIcon,
  PixelDragHandleIcon,
  PixelDropdownIcon,
  PixelDuplicateIcon,
  PixelEyeIcon,
  PixelFieldTypeIcon,
  PixelImageIcon,
  PixelLockIcon,
  PixelPaletteIcon,
  PixelPauseIcon,
  PixelPhoneIcon,
  PixelPlayIcon,
  PixelPlusIcon,
  PixelQuestionsIcon,
  PixelRadioIcon,
  PixelSaveIcon,
  PixelSettingsIcon,
  PixelSparkleIcon,
  PixelStarIcon,
  PixelTextIcon,
  PixelTrashIcon,
  PixelWarningIcon,
} from "@/components/PixelIcons";
import {
  FORM_CATEGORIES,
  FORM_TEMPLATES,
  PAGE_BG_TINTS,
  getFormBackgroundPatternCss,
  getFormBackgroundPatternSize,
  getLocalNowParts,
  resolveFormCategory,
  type BackgroundPattern,
  type FieldType,
  type FormCategory,
  type FormFieldNode,
  type FormKind,
  type FormRow,
  type FormTheme,
  type ServiceRow,
} from "@/lib/form-types";
import { getSupabase, type UserProfile } from "@/lib/supabase";

const FIELD_TYPE_GROUPS: {
  group: string;
  items: { type: FieldType; label: string }[];
}[] = [
  {
    group: "Text & Identity",
    items: [
      { type: "short_text", label: "Short Text" },
      { type: "long_text", label: "Paragraph / Long Text" },
      { type: "number", label: "Numeric Value" },
      { type: "email", label: "Email Address" },
    ],
  },
  {
    group: "Real-Time Date & Time",
    items: [
      { type: "date_time", label: "Date & Time (Auto Now)" },
      { type: "date", label: "Date Picker" },
      { type: "time", label: "Time Picker" },
    ],
  },
  {
    group: "Choices & Judging",
    items: [
      { type: "dropdown", label: "Dropdown Select" },
      { type: "single_choice", label: "Multiple Choice (Radio)" },
      { type: "multiple_choice", label: "Checkboxes" },
      { type: "star_rating", label: "Star Rating (Pixel Stars)" },
      { type: "linear_scale", label: "Rubric Scale (1–10)" },
    ],
  },
  {
    group: "Media & Structure",
    items: [
      { type: "file_upload", label: "File Upload (Drive)" },
      { type: "image", label: "Image / Banner Graphic" },
      { type: "heading", label: "Section Heading" },
      { type: "instructions", label: "Helper / Instructions" },
      { type: "section", label: "Divider Line" },
    ],
  },
];

const FLAT_FIELD_LABELS: Record<FieldType, string> = Object.fromEntries(
  FIELD_TYPE_GROUPS.flatMap((g) => g.items.map((i) => [i.type, i.label])),
) as Record<FieldType, string>;

const THEME_ACCENTS = [
  { name: "Royal Blue", hex: "#1d4ed8" },
  { name: "Teal Emerald", hex: "#0f766e" },
  { name: "Deep Violet", hex: "#7c3aed" },
  { name: "Warm Amber", hex: "#b45309" },
  { name: "Rose Crimson", hex: "#be123c" },
  { name: "Sienna Brown", hex: "#7c2d12" },
  { name: "Obsidian Slate", hex: "#18181b" },
];

function computeDefaultAnswers(fieldNodes: FormFieldNode[]): Record<string, unknown> {
  const nowParts = getLocalNowParts();
  const initial: Record<string, unknown> = {};
  for (const n of fieldNodes) {
    if (n.type === "date_time" && n.defaultToNow !== false) {
      initial[n.id] = nowParts.dateTime;
    } else if (n.type === "date" && n.defaultToNow) {
      initial[n.id] = nowParts.date;
    } else if (n.type === "time" && n.defaultToNow !== false) {
      initial[n.id] = nowParts.time;
    }
  }
  return initial;
}

export default function AdminFormBuilderPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [forms, setForms] = useState<FormRow[]>([]);
  const [formThemesMap, setFormThemesMap] = useState<Record<string, FormTheme>>({});
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Metadata & Builder State (starts with a fresh blank form)
  const [selectedFormId, setSelectedFormId] = useState<string | null>(null);
  const [title, setTitle] = useState("Untitled Form");
  const [slug, setSlug] = useState("untitled-form");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FormCategory>("company_forms");
  const [kind, setKind] = useState<FormKind>("general");
  const [allowSaveDraft, setAllowSaveDraft] = useState(true);
  const [allowAppeal, setAllowAppeal] = useState(false);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [allowlistText, setAllowlistText] = useState("");
  const [nodes, setNodes] = useState<FormFieldNode[]>([
    {
      id: "fld_1",
      type: "short_text",
      label: "Untitled Question",
      required: false,
      width: "full",
    },
  ]);
  const [theme, setTheme] = useState<FormTheme>({
    category: "company_forms",
    primaryColor: "#1d4ed8",
    backgroundColor: "#efece6",
    backgroundPattern: "matboard_dots",
  });

  // Navigation & Editor UI State
  const [activeTab, setActiveTab] = useState<"questions" | "preview" | "catalog" | "settings">("questions");
  const [previewDevice, setPreviewDevice] = useState<"phone" | "desktop">("phone");
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, unknown>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("fld_1");
  const [openTypeMenuNodeId, setOpenTypeMenuNodeId] = useState<string | null>(null);
  const [showThemeDrawer, setShowThemeDrawer] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<
    null | { mode: "banner" } | { mode: "background" } | { mode: "field"; nodeId: string }
  >(null);
  const [catalogShowArchived, setCatalogShowArchived] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Auto-save & Unsaved Changes State
  const [isDirty, setIsDirty] = useState(false);
  const [lastLocalSaveAt, setLastLocalSaveAt] = useState<string | null>(null);
  const [pendingNavAction, setPendingNavAction] = useState<null | (() => void)>(null);
  const [localRecoveryBanner, setLocalRecoveryBanner] = useState(false);
  const skipNextDirtyRef = useRef(true);
  const seqRef = useRef(1);

  // Full-bleed studio breakout
  useEffect(() => {
    const frame = document.querySelector(".app-frame");
    const shell = document.querySelector(".shell");
    frame?.classList.add("studio-mode");
    shell?.classList.add("studio-mode");
    return () => {
      frame?.classList.remove("studio-mode");
      shell?.classList.remove("studio-mode");
    };
  }, []);

  // Close custom type dropdown on outside click or Escape
  useEffect(() => {
    if (!openTypeMenuNodeId) return;
    function onDocClick() {
      setOpenTypeMenuNodeId(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenTypeMenuNodeId(null);
    }
    window.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [openTypeMenuNodeId]);

  // Warn user before refreshing / closing browser tab if unsaved changes exist
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // Auto-save snapshot to localStorage whenever edited
  useEffect(() => {
    if (skipNextDirtyRef.current) {
      skipNextDirtyRef.current = false;
      return;
    }
    setIsDirty(true);
    const key = `mesrc_studio_autosave_${selectedFormId ?? "new"}`;
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            savedAt: new Date().toISOString(),
            title,
            slug,
            description,
            category,
            kind,
            allowSaveDraft,
            allowAppeal,
            selectedServices,
            allowlistText,
            nodes,
            theme,
          }),
        );
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, "0");
        setLastLocalSaveAt(`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`);
      } catch {
        // Ignore storage quota errors
      }
    }, 650);
    return () => window.clearTimeout(timer);
  }, [
    title,
    slug,
    description,
    category,
    kind,
    allowSaveDraft,
    allowAppeal,
    selectedServices,
    allowlistText,
    nodes,
    theme,
    selectedFormId,
  ]);

  // Initial Data Fetch
  async function loadCatalogAndThemes() {
    const supabase = getSupabase();
    const { data: fRows } = await supabase
      .from("forms")
      .select("*")
      .order("updated_at", { ascending: false });
    const formList = (fRows as FormRow[] | null) ?? [];
    setForms(formList);

    if (formList.length > 0) {
      const { data: verRows } = await supabase
        .from("form_versions")
        .select("form_id,version_number,theme_json")
        .in(
          "form_id",
          formList.map((f) => f.id),
        );
      const map: Record<string, FormTheme> = {};
      for (const f of formList) {
        const match = (verRows as { form_id: string; version_number: number; theme_json: FormTheme }[] | null)?.find(
          (v) => v.form_id === f.id && v.version_number === f.latest_version,
        );
        if (match?.theme_json) {
          map[f.id] = match.theme_json;
        }
      }
      setFormThemesMap(map);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const { data: sess } = await supabase.auth.getSession();
        const uid = sess.session?.user?.id;
        if (!uid) return;
        const [{ data: prof }, { data: sRows }] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
          supabase.from("services").select("*").order("sort_order", { ascending: true }),
        ]);
        if (!active) return;
        setProfile((prof as UserProfile | null) ?? null);
        setServices((sRows as ServiceRow[] | null) ?? []);
        await loadCatalogAndThemes();

        const targetId =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("id")
            : null;
        if (targetId && active) {
          const { data: targetForm } = await supabase
            .from("forms")
            .select("*")
            .eq("id", targetId)
            .maybeSingle();
          if (targetForm && active) {
            await applySelectExistingForm(targetForm as FormRow);
          }
        } else {
          // Check if there is a locally auto-saved unsaved draft
          try {
            const savedRaw = localStorage.getItem("mesrc_studio_autosave_new");
            if (savedRaw && active) {
              setLocalRecoveryBanner(true);
            }
          } catch {
            // ignore
          }
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function restoreLocalAutosave(targetFormId: string | null) {
    try {
      const raw = localStorage.getItem(`mesrc_studio_autosave_${targetFormId ?? "new"}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        title: string;
        slug: string;
        description: string;
        category: FormCategory;
        kind: FormKind;
        allowSaveDraft: boolean;
        allowAppeal: boolean;
        selectedServices: string[];
        allowlistText: string;
        nodes: FormFieldNode[];
        theme: FormTheme;
      };
      skipNextDirtyRef.current = true;
      setTitle(parsed.title);
      setSlug(parsed.slug);
      setDescription(parsed.description);
      setCategory(parsed.category);
      setKind(parsed.kind);
      setAllowSaveDraft(parsed.allowSaveDraft);
      setAllowAppeal(parsed.allowAppeal);
      setSelectedServices(parsed.selectedServices ?? []);
      setAllowlistText(parsed.allowlistText ?? "");
      setNodes(parsed.nodes ?? []);
      setTheme(parsed.theme ?? {});
      setSelectedNodeId(parsed.nodes?.[0]?.id ?? null);
      setLocalRecoveryBanner(false);
      setIsDirty(true);
      setInfo("Recovered your unsaved auto-saved draft.");
    } catch {
      setLocalRecoveryBanner(false);
    }
  }

  function clearLocalAutosave(targetFormId: string | null) {
    try {
      localStorage.removeItem(`mesrc_studio_autosave_${targetFormId ?? "new"}`);
    } catch {
      // ignore
    }
    setLocalRecoveryBanner(false);
  }

  function runWithUnsavedCheck(action: () => void) {
    if (!isDirty) {
      action();
      return;
    }
    setPendingNavAction(() => action);
  }

  function handleCategorySwitch(nextCat: FormCategory) {
    setCategory(nextCat);
    const meta = FORM_CATEGORIES.find((c) => c.key === nextCat);
    if (meta) {
      setKind(meta.defaultDbKind);
      setTheme((prev) => ({
        ...prev,
        category: nextCat,
        primaryColor: prev.primaryColor || meta.accent,
      }));
      if (nextCat === "staff_complaints") {
        setAllowAppeal(true);
      }
    }
  }

  async function applySelectExistingForm(f: FormRow) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const [{ data: ver }, { data: fSvcs }, { data: allowRows }] = await Promise.all([
        supabase
          .from("form_versions")
          .select("*")
          .eq("form_id", f.id)
          .eq("version_number", f.latest_version)
          .maybeSingle(),
        supabase.from("form_services").select("service_id").eq("form_id", f.id),
        supabase.from("form_email_allowlist").select("email").eq("form_id", f.id),
      ]);

      skipNextDirtyRef.current = true;
      setSelectedFormId(f.id);
      setTitle(f.title);
      setSlug(f.slug);
      setDescription(f.description);
      setKind(f.kind);
      setAllowSaveDraft(f.allow_save_draft);
      setAllowAppeal(f.allow_appeal);
      setSelectedServices(
        ((fSvcs as { service_id: string }[] | null) ?? []).map((x) => x.service_id),
      );
      setAllowlistText(
        ((allowRows as { email: string }[] | null) ?? []).map((x) => x.email).join("\n"),
      );
      const loadedTheme = ((ver as { theme_json?: FormTheme } | null)?.theme_json ?? {}) as FormTheme;
      const loadedNodes = ((ver as { schema_json?: FormFieldNode[] } | null)?.schema_json ?? []) as FormFieldNode[];
      const resolvedCat = resolveFormCategory(f, loadedTheme);
      setCategory(resolvedCat);
      setTheme({
        primaryColor: "#1d4ed8",
        backgroundColor: "#efece6",
        backgroundPattern: "matboard_dots",
        ...loadedTheme,
        category: resolvedCat,
      });
      setNodes(loadedNodes);
      setSelectedNodeId(loadedNodes[0]?.id ?? null);
      setPreviewAnswers(computeDefaultAnswers(loadedNodes));
      setIsDirty(false);
      setActiveTab("questions");
      setInfo(`Loaded "${f.title}" in Studio.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load form.");
    } finally {
      setBusy(false);
    }
  }

  function applyLoadTemplate(tplKey: string) {
    const tpl = FORM_TEMPLATES.find((t) => t.key === tplKey);
    if (!tpl) return;
    skipNextDirtyRef.current = true;
    setSelectedFormId(null);
    setTitle(tpl.title);
    seqRef.current += 1;
    setSlug(`${tpl.slug}-${forms.length + seqRef.current}`);
    setDescription(tpl.description);
    setCategory(tpl.category);
    setKind(tpl.kind);
    setAllowAppeal(tpl.allowAppeal);
    const cloned = tpl.nodes.map((n) => ({
      ...n,
      options: n.options ? [...n.options] : undefined,
      ratingLabels: n.ratingLabels ? { ...n.ratingLabels } : undefined,
    }));
    const nextTheme: FormTheme = {
      primaryColor: "#1d4ed8",
      backgroundColor: "#efece6",
      backgroundPattern: "matboard_dots",
      submissionsClosed: false,
      ...(tpl.theme ?? {}),
      category: tpl.category,
    };
    setTheme(nextTheme);
    setNodes(cloned);
    setSelectedNodeId(cloned[0]?.id ?? null);
    setPreviewAnswers(computeDefaultAnswers(cloned));
    setIsDirty(true);
    setActiveTab("questions");
    setInfo(`Loaded template: ${tpl.name}`);
  }

  function updateNode(nodeId: string, patch: Partial<FormFieldNode>) {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, ...patch } : n)));
  }

  function handleChangeFieldType(node: FormFieldNode, newType: FieldType) {
    const isChoice =
      newType === "dropdown" || newType === "single_choice" || newType === "multiple_choice";
    const defaultOpts = isChoice
      ? node.options && node.options.length > 0
        ? node.options
        : ["Option 1", "Option 2", "Option 3"]
      : undefined;

    const patch: Partial<FormFieldNode> = {
      type: newType,
      options: defaultOpts,
    };
    if (newType === "date_time" || newType === "time") {
      patch.defaultToNow = node.defaultToNow ?? true;
    }
    if (newType === "star_rating") {
      patch.maxRating = node.maxRating ?? 5;
      patch.ratingLabels = node.ratingLabels ?? { low: "Needs Improvement", high: "Outstanding" };
    }
    if (newType === "linear_scale") {
      patch.minRating = node.minRating ?? 1;
      patch.maxRating = node.maxRating ?? 10;
      patch.ratingLabels = node.ratingLabels ?? { low: "Low", high: "High" };
    }
    updateNode(node.id, patch);
    setOpenTypeMenuNodeId(null);
  }

  function handleAddNode(type: FieldType = "short_text") {
    seqRef.current += 1;
    const id = `fld_${nodes.length + seqRef.current}_${Date.now().toString(36).slice(-3)}`;
    const defaultOptions =
      type === "dropdown" || type === "single_choice" || type === "multiple_choice"
        ? ["Option 1", "Option 2", "Option 3"]
        : undefined;

    const newNode: FormFieldNode = {
      id,
      type,
      label:
        type === "heading"
          ? "New Section Header"
          : type === "instructions"
            ? "Instructions for applicant"
            : type === "section"
              ? "Section Break"
              : type === "date_time"
                ? "Date & Time"
                : type === "star_rating"
                  ? "Rating Criterion"
                  : type === "linear_scale"
                    ? "Score Scale (1–10)"
                    : type === "image"
                      ? "Form Graphic / Poster"
                      : "Untitled Question",
      required: false,
      options: defaultOptions,
      defaultToNow: type === "date_time" || type === "time" ? true : undefined,
      maxRating: type === "star_rating" ? 5 : type === "linear_scale" ? 10 : undefined,
      minRating: type === "linear_scale" ? 1 : undefined,
      ratingLabels:
        type === "star_rating" || type === "linear_scale"
          ? { low: "Low", high: "Excellent" }
          : undefined,
      width: "full",
    };

    const selectedIdx = nodes.findIndex((n) => n.id === selectedNodeId);
    if (selectedIdx !== -1) {
      const updated = [...nodes];
      updated.splice(selectedIdx + 1, 0, newNode);
      setNodes(updated);
    } else {
      setNodes((prev) => [...prev, newNode]);
    }
    setSelectedNodeId(id);
  }

  function handleDuplicateNode(nodeToCopy: FormFieldNode) {
    seqRef.current += 1;
    const newId = `fld_${nodes.length + seqRef.current}_${Date.now().toString(36).slice(-3)}`;
    const cloned: FormFieldNode = {
      ...nodeToCopy,
      id: newId,
      label: `${nodeToCopy.label} (Copy)`,
      options: nodeToCopy.options ? [...nodeToCopy.options] : undefined,
      ratingLabels: nodeToCopy.ratingLabels ? { ...nodeToCopy.ratingLabels } : undefined,
    };
    const idx = nodes.findIndex((n) => n.id === nodeToCopy.id);
    const updated = [...nodes];
    updated.splice(idx + 1, 0, cloned);
    setNodes(updated);
    setSelectedNodeId(newId);
  }

  function handleMoveNode(fromIdx: number, toIdx: number) {
    if (toIdx < 0 || toIdx >= nodes.length || fromIdx === toIdx) return;
    const copy = [...nodes];
    const [moved] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, moved);
    setNodes(copy);
  }

  function handleDeleteNode(id: string) {
    const idx = nodes.findIndex((n) => n.id === id);
    const remaining = nodes.filter((n) => n.id !== id);
    setNodes(remaining);
    if (selectedNodeId === id) {
      const nextSelected = remaining[idx] ?? remaining[idx - 1] ?? null;
      setSelectedNodeId(nextSelected ? nextSelected.id : null);
    }
  }

  function handleAddOption(nodeId: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const currentOpts = n.options ?? [];
        return {
          ...n,
          options: [...currentOpts, `Option ${currentOpts.length + 1}`],
        };
      }),
    );
  }

  function handleUpdateOption(nodeId: string, optIdx: number, val: string) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = [...(n.options ?? [])];
        opts[optIdx] = val;
        return { ...n, options: opts };
      }),
    );
  }

  function handleRemoveOption(nodeId: string, optIdx: number) {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id !== nodeId) return n;
        const opts = (n.options ?? []).filter((_, i) => i !== optIdx);
        return { ...n, options: opts };
      }),
    );
  }

  async function saveCurrentFormToDb(themeOverrides?: Partial<FormTheme>) {
    const supabase = getSupabase();
    const allowEmails = allowlistText
      .split(/[\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const effectiveTheme: FormTheme = {
      ...theme,
      ...themeOverrides,
      category,
    };

    const { data, error: rpcErr } = await supabase.rpc("save_form_builder", {
      p_form_id: selectedFormId,
      p_slug: slug,
      p_title: title,
      p_description: description,
      p_kind: kind,
      p_allow_save_draft: allowSaveDraft,
      p_allow_appeal: allowAppeal,
      p_service_ids: selectedServices,
      p_allowlist_emails: allowEmails,
      p_schema_json: nodes,
      p_theme_json: effectiveTheme,
    });
    if (rpcErr) throw rpcErr;
    const res = data as { form_id: string; slug: string; latest_version: number };
    setSelectedFormId(res.form_id);
    setSlug(res.slug);
    setTheme(effectiveTheme);
    clearLocalAutosave(selectedFormId);
    clearLocalAutosave(res.form_id);
    setIsDirty(false);
    return res;
  }

  async function handleSaveDraft(): Promise<boolean> {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await saveCurrentFormToDb();
      setInfo(`Saved draft version v${res.latest_version}.`);
      await loadCatalogAndThemes();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save form draft.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handlePublish(reopen = true) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const saveRes = await saveCurrentFormToDb({
        submissionsClosed: !reopen,
        closedReason: reopen ? "" : theme.closedReason || "Submissions are currently closed by Admin.",
      });

      const supabase = getSupabase();
      const { data: pubData, error: pubErr } = await supabase.rpc("publish_form_version", {
        p_form_id: saveRes.form_id,
      });
      if (pubErr) throw pubErr;
      const pRes = pubData as { published_version: number };
      setInfo(
        reopen
          ? `Published version v${pRes.published_version} is now LIVE and accepting entries!`
          : `Unpublished (Paused) v${pRes.published_version}: Card stays visible to members as CLOSED.`,
      );
      await loadCatalogAndThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update publish status.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchiveOrDelete(formId: string, restore = false) {
    const label = restore ? "restore this form to drafts" : "delete (archive) this form";
    if (!confirm(`Are you sure you want to ${label}?`)) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const nextState = restore ? "draft" : "archived";
      const { error: rpcErr } = await supabase.rpc("set_form_state", {
        p_form_id: formId,
        p_state: nextState,
      });
      if (rpcErr) throw rpcErr;
      if (!restore && selectedFormId === formId) {
        setSelectedFormId(null);
        setIsDirty(false);
      }
      setInfo(restore ? "Form restored to Drafts." : "Form deleted / archived cleanly.");
      await loadCatalogAndThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update form state.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleCatalogPause(f: FormRow, shouldPause: boolean) {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const supabase = getSupabase();
      const { data: ver } = await supabase
        .from("form_versions")
        .select("*")
        .eq("form_id", f.id)
        .eq("version_number", f.latest_version)
        .maybeSingle();

      const verSchema = ((ver as { schema_json?: FormFieldNode[] } | null)?.schema_json ?? []) as FormFieldNode[];
      const verTheme = ((ver as { theme_json?: FormTheme } | null)?.theme_json ?? {}) as FormTheme;
      const nextTheme: FormTheme = {
        ...verTheme,
        submissionsClosed: shouldPause,
        closedReason: shouldPause ? "Entries closed / paused by administrator." : "",
      };

      const { error: saveErr } = await supabase.rpc("save_form_builder", {
        p_form_id: f.id,
        p_slug: f.slug,
        p_title: f.title,
        p_description: f.description,
        p_kind: f.kind,
        p_allow_save_draft: f.allow_save_draft,
        p_allow_appeal: f.allow_appeal,
        p_service_ids: [],
        p_allowlist_emails: [],
        p_schema_json: verSchema,
        p_theme_json: nextTheme,
      });
      if (saveErr) throw saveErr;

      const { error: pubErr } = await supabase.rpc("publish_form_version", { p_form_id: f.id });
      if (pubErr) throw pubErr;

      if (selectedFormId === f.id) {
        setTheme(nextTheme);
      }
      setInfo(
        shouldPause
          ? `"${f.title}" is now UNPUBLISHED (card remains visible on dashboard as CLOSED).`
          : `"${f.title}" is now LIVE and open for responses!`,
      );
      await loadCatalogAndThemes();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to toggle pause state.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <ChunkLoader title="Form Studio" subtitle="Assembling papercraft studio..." />;
  }

  if (!profile || (profile.role !== "admin" && profile.role !== "maintenance")) {
    return (
      <div className="center-stage">
        <section className="card stack">
          <h1>Access Restricted</h1>
          <p className="notice">Only Admin or Maintenance accounts may access the Form Studio.</p>
          <div className="row-actions">
            <Link href="/" className="btn btn-primary">
              Return Home
            </Link>
          </div>
        </section>
      </div>
    );
  }

  const currentFormRecord = forms.find((f) => f.id === selectedFormId);
  const primaryAccent = theme.primaryColor || "#1d4ed8";
  const isPublishedOpen =
    currentFormRecord?.state === "published" && !theme.submissionsClosed;
  const isPublishedPaused =
    currentFormRecord?.state === "published" && Boolean(theme.submissionsClosed);

  const stageBgStyle: React.CSSProperties = {
    backgroundColor: theme.backgroundColor || "#efece6",
    backgroundImage: getFormBackgroundPatternCss(theme.backgroundPattern),
    backgroundSize: getFormBackgroundPatternSize(theme.backgroundPattern),
  };

  const visibleCatalogForms = forms.filter((f) =>
    catalogShowArchived ? f.state === "archived" : f.state !== "archived",
  );

  return (
    <div className="gf-studio-shell" style={stageBgStyle}>
      {/* Optional Full-Page Background Image Layer */}
      {theme.backgroundImageUrl && (
        <div
          className="gf-bg-photo-layer"
          style={{
            backgroundImage: `url(${theme.backgroundImageUrl})`,
            filter: theme.backgroundBlur ? `blur(${theme.backgroundBlur}px)` : undefined,
          }}
        >
          <div
            className="gf-bg-photo-overlay"
            style={{
              backgroundColor: theme.backgroundColor || "#efece6",
              opacity: (theme.backgroundOverlayOpacity ?? 35) / 100,
            }}
          />
        </div>
      )}

      {/* ======================================================================
          TOP PAPERCRAFT + PIXEL ART COMMAND BAR
          ====================================================================== */}
      <header className="gf-studio-toolbar" aria-label="Studio Command Bar">
        <div className="gf-toolbar-left">
          <button
            type="button"
            className="pixel-paper-btn gf-exit-btn"
            title="Exit to Admin Dashboard"
            onClick={() =>
              runWithUnsavedCheck(() => {
                router.push("/admin/");
              })
            }
          >
            <PixelArrowLeftIcon size={14} />
            <span>Exit</span>
          </button>

          <div className="gf-brand-badge" title="Forms MESRC Paper Studio">
            <BrandLogo size="sm" />
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="gf-title-input"
            title="Click to rename form title"
            placeholder="Form Title..."
          />

          {/* Status & Auto-Save Reminder Indicator */}
          {isPublishedPaused ? (
            <span className="pixel-stamp-badge paused" title="Card visible to staff, entries blocked">
              <PixelPauseIcon size={11} />
              <span>PAUSED / CLOSED</span>
            </span>
          ) : currentFormRecord?.state === "published" ? (
            <span className="pixel-stamp-badge live">
              <PixelSparkleIcon size={11} />
              <span>LIVE v{currentFormRecord.latest_version}</span>
            </span>
          ) : (
            <span className="pixel-stamp-badge draft">
              <PixelQuestionsIcon size={11} />
              <span>DRAFT</span>
            </span>
          )}

          {isDirty ? (
            <span className="pixel-stamp-badge unsaved" title="You have changes not yet saved to database">
              <PixelWarningIcon size={11} />
              <span>UNSAVED {lastLocalSaveAt ? `· AUTO ${lastLocalSaveAt}` : ""}</span>
            </span>
          ) : (
            <span className="pixel-stamp-badge synced" title="All changes saved">
              <PixelCheckIcon size={11} />
              <span>SAVED</span>
            </span>
          )}
        </div>

        {/* CENTER STACKED PAPER TABS */}
        <div className="gf-toolbar-center">
          <nav className="gf-nav-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "questions"}
              className={`gf-tab-btn ${activeTab === "questions" ? "active" : ""}`}
              onClick={() => setActiveTab("questions")}
            >
              <PixelQuestionsIcon size={15} />
              <span>Questions</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "preview"}
              className={`gf-tab-btn ${activeTab === "preview" ? "active" : ""}`}
              onClick={() => {
                setPreviewAnswers((prev) => ({
                  ...computeDefaultAnswers(nodes),
                  ...prev,
                }));
                setActiveTab("preview");
              }}
            >
              <PixelEyeIcon size={15} />
              <span>Live Preview</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "catalog"}
              className={`gf-tab-btn ${activeTab === "catalog" ? "active" : ""}`}
              onClick={() => setActiveTab("catalog")}
            >
              <PixelCatalogIcon size={15} />
              <span>Catalog ({forms.filter((f) => f.state !== "archived").length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "settings"}
              className={`gf-tab-btn ${activeTab === "settings" ? "active" : ""}`}
              onClick={() => setActiveTab("settings")}
            >
              <PixelSettingsIcon size={15} />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        {/* RIGHT LIFECYCLE CONTROLS */}
        <div className="gf-toolbar-right">
          <button
            type="button"
            className={`pixel-paper-btn ${showThemeDrawer ? "primary" : ""}`}
            style={showThemeDrawer ? { backgroundColor: primaryAccent } : undefined}
            onClick={() => {
              if (activeTab !== "questions" && activeTab !== "preview") {
                setActiveTab("questions");
              }
              setShowThemeDrawer((s) => !s);
            }}
            title="Customize header banner, background photo, and colors"
          >
            <PixelPaletteIcon size={14} />
            <span>Theme</span>
          </button>

          <button
            type="button"
            className="pixel-paper-btn"
            disabled={busy}
            onClick={() => void handleSaveDraft()}
          >
            <PixelSaveIcon size={14} />
            <span>{busy ? "Saving..." : "Save Draft"}</span>
          </button>

          {isPublishedOpen ? (
            <button
              type="button"
              className="pixel-paper-btn warning"
              disabled={busy}
              onClick={() => void handlePublish(false)}
              title="Stop accepting answers while keeping card visible & locked for members"
            >
              <PixelPauseIcon size={14} />
              <span>Unpublish (Pause)</span>
            </button>
          ) : (
            <button
              type="button"
              className="pixel-paper-btn primary"
              style={{ backgroundColor: primaryAccent }}
              disabled={busy}
              onClick={() => void handlePublish(true)}
            >
              <PixelPlayIcon size={14} />
              <span>{isPublishedPaused ? "Re-Publish Live" : "Publish Live"}</span>
            </button>
          )}
        </div>
      </header>

      {/* LOCAL AUTO-SAVE RECOVERY BANNER */}
      {localRecoveryBanner && !selectedFormId && (
        <div className="gf-recovery-banner">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <PixelWarningIcon size={16} />
            <span>You have an unsaved local draft from your previous session.</span>
          </div>
          <div className="row-actions" style={{ gap: "0.45rem" }}>
            <button
              type="button"
              className="pixel-paper-btn compact primary"
              onClick={() => restoreLocalAutosave(null)}
            >
              Restore Draft
            </button>
            <button
              type="button"
              className="pixel-paper-btn compact"
              onClick={() => clearLocalAutosave(null)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="alert alert-error gf-floating-alert" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="alert alert-ok gf-floating-alert" role="status">
          {info}
        </p>
      )}

      {/* ======================================================================
          THEME & VISUAL CUSTOMIZATION DRAWER (SLIDES RIGHT)
          ====================================================================== */}
      {showThemeDrawer && (
        <aside className="gf-theme-drawer" aria-label="Form Visual Customizer">
          <div className="gf-theme-drawer-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <PixelPaletteIcon size={16} />
              <strong>Visual &amp; Theme Designer</strong>
            </div>
            <button
              type="button"
              className="pixel-paper-btn compact"
              onClick={() => setShowThemeDrawer(false)}
            >
              &times;
            </button>
          </div>

          <div className="gf-theme-drawer-body stack">
            {/* 1. Dashboard Category */}
            <div className="field">
              <label>Dashboard Category</label>
              <div className="stack" style={{ gap: "0.4rem" }}>
                {FORM_CATEGORIES.map((cat) => (
                  <button
                    key={cat.key}
                    type="button"
                    className={`gf-cat-pick-btn ${category === cat.key ? "active" : ""}`}
                    onClick={() => handleCategorySwitch(cat.key)}
                  >
                    <strong>{cat.label}</strong>
                    <span>{cat.subtitle}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Header Banner Image */}
            <div className="field">
              <label>Header Banner Image</label>
              {theme.bannerImageUrl ? (
                <div className="gf-drawer-thumb-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={theme.bannerImageUrl} alt="Banner preview" className="gf-drawer-thumb-img" />
                  <div className="row-actions" style={{ marginTop: "0.45rem", gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="pixel-paper-btn compact"
                      onClick={() => setMediaTarget({ mode: "banner" })}
                    >
                      Change Image
                    </button>
                    <button
                      type="button"
                      className="pixel-paper-btn compact danger"
                      onClick={() => setTheme((p) => ({ ...p, bannerImageUrl: "" }))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="pixel-paper-btn"
                  onClick={() => setMediaTarget({ mode: "banner" })}
                >
                  <PixelImageIcon size={14} />
                  <span>Choose / Search Header Banner</span>
                </button>
              )}

              {theme.bannerImageUrl && (
                <div className="row-actions" style={{ marginTop: "0.45rem", gap: "0.35rem" }}>
                  {(["compact", "medium", "tall"] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={`pixel-paper-btn compact ${(theme.bannerHeight ?? "medium") === h ? "primary" : ""}`}
                      onClick={() => setTheme((p) => ({ ...p, bannerHeight: h }))}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 3. Theme Accent Color */}
            <div className="field">
              <label>Accent Spine &amp; Button Color</label>
              <div className="gf-theme-swatches" style={{ flexWrap: "wrap" }}>
                {THEME_ACCENTS.map((acc) => (
                  <button
                    key={acc.hex}
                    type="button"
                    className={`gf-swatch-dot ${theme.primaryColor === acc.hex ? "active" : ""}`}
                    style={{ backgroundColor: acc.hex }}
                    onClick={() => setTheme((prev) => ({ ...prev, primaryColor: acc.hex }))}
                    title={acc.name}
                  />
                ))}
                <input
                  type="color"
                  value={primaryAccent}
                  onChange={(e) => setTheme((prev) => ({ ...prev, primaryColor: e.target.value }))}
                  title="Pick any custom accent color"
                  className="gf-color-input-native"
                />
              </div>
            </div>

            {/* 4. Page Background Tint & Pattern */}
            <div className="field">
              <label>Page Background Paper Color</label>
              <div className="gf-theme-swatches" style={{ flexWrap: "wrap" }}>
                {PAGE_BG_TINTS.map((bg) => (
                  <button
                    key={bg.hex}
                    type="button"
                    className={`gf-swatch-dot ${(theme.backgroundColor || "#efece6") === bg.hex ? "active" : ""}`}
                    style={{ backgroundColor: bg.hex }}
                    onClick={() => setTheme((prev) => ({ ...prev, backgroundColor: bg.hex }))}
                    title={bg.name}
                  />
                ))}
                <input
                  type="color"
                  value={theme.backgroundColor || "#efece6"}
                  onChange={(e) => setTheme((prev) => ({ ...prev, backgroundColor: e.target.value }))}
                  title="Pick custom page background tint"
                  className="gf-color-input-native"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="theme-pattern">Background Craft Pattern</label>
              <select
                id="theme-pattern"
                value={theme.backgroundPattern ?? "matboard_dots"}
                onChange={(e) =>
                  setTheme((prev) => ({ ...prev, backgroundPattern: e.target.value as BackgroundPattern }))
                }
              >
                <option value="matboard_dots">Studio Matboard Dots</option>
                <option value="grid_paper">Blueprint Grid Paper</option>
                <option value="pixel_stars">Pixel Stars</option>
                <option value="diagonal_craft">Diagonal Kraft Lines</option>
                <option value="solid">Solid Clean Paper</option>
              </select>
            </div>

            {/* 5. Full Background Photo */}
            <div className="field">
              <label>Full-Page Background Image (Optional)</label>
              {theme.backgroundImageUrl ? (
                <div className="gf-drawer-thumb-card">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={theme.backgroundImageUrl} alt="Background preview" className="gf-drawer-thumb-img" />
                  <div className="row-actions" style={{ marginTop: "0.45rem", gap: "0.4rem" }}>
                    <button
                      type="button"
                      className="pixel-paper-btn compact"
                      onClick={() => setMediaTarget({ mode: "background" })}
                    >
                      Change Photo
                    </button>
                    <button
                      type="button"
                      className="pixel-paper-btn compact danger"
                      onClick={() => setTheme((p) => ({ ...p, backgroundImageUrl: "" }))}
                    >
                      Clear
                    </button>
                  </div>
                  <div className="field" style={{ marginTop: "0.65rem" }}>
                    <label style={{ fontSize: "0.74rem" }}>
                      Paper Wash Opacity ({theme.backgroundOverlayOpacity ?? 35}%)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={85}
                      value={theme.backgroundOverlayOpacity ?? 35}
                      onChange={(e) =>
                        setTheme((p) => ({ ...p, backgroundOverlayOpacity: Number(e.target.value) }))
                      }
                    />
                  </div>
                  <div className="field">
                    <label style={{ fontSize: "0.74rem" }}>
                      Background Soft Blur ({theme.backgroundBlur ?? 0}px)
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={10}
                      value={theme.backgroundBlur ?? 0}
                      onChange={(e) =>
                        setTheme((p) => ({ ...p, backgroundBlur: Number(e.target.value) }))
                      }
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="pixel-paper-btn"
                  onClick={() => setMediaTarget({ mode: "background" })}
                >
                  <PixelImageIcon size={14} />
                  <span>Set Full-Page Background Image</span>
                </button>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* ======================================================================
          VIEW 1: QUESTIONS DOCUMENT STREAM (PAPERCRAFT + PIXEL ART)
          ====================================================================== */}
      {activeTab === "questions" && (
        <main className="gf-editor-stage" aria-label="Questions Document Stream">
          <div className="gf-document-stream">
            {/* OPTIONAL FORM HEADER BANNER IMAGE */}
            {theme.bannerImageUrl && (
              <div className={`gf-banner-card height-${theme.bannerHeight ?? "medium"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={theme.bannerImageUrl} alt="Form header banner" className="gf-banner-img" />
                <div className="gf-banner-overlay-actions">
                  <button
                    type="button"
                    className="pixel-paper-btn compact"
                    onClick={() => setMediaTarget({ mode: "banner" })}
                  >
                    <PixelImageIcon size={12} />
                    <span>Change Banner</span>
                  </button>
                </div>
              </div>
            )}

            {/* 1. DOUBLE-LAYERED PAPERCRAFT FORM HEADER CARD */}
            <div
              className="gf-header-card"
              style={{ borderTop: `8px solid ${primaryAccent}` }}
            >
              <div className="gf-header-top-meta">
                <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                  <span className="pixel-tag-pill">
                    <PixelQuestionsIcon size={12} />
                    <span>
                      {FORM_CATEGORIES.find((c) => c.key === category)?.label.toUpperCase()}
                    </span>
                  </span>

                  {!theme.bannerImageUrl && (
                    <button
                      type="button"
                      className="pixel-paper-btn compact"
                      onClick={() => setMediaTarget({ mode: "banner" })}
                    >
                      <PixelImageIcon size={12} />
                      <span>+ Add Header Image</span>
                    </button>
                  )}
                </div>

                <span className="gf-question-count-pill">
                  {nodes.length} {nodes.length === 1 ? "ITEM" : "ITEMS"}
                </span>
              </div>

              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Form Title..."
                className="gf-header-title-input"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Form description and applicant guidelines..."
                className="gf-header-desc-input"
                rows={2}
              />

              {/* Auto-attached Logged-in Email Notice Strip (matches Google Forms UX) */}
              <div className="gf-account-strip">
                <PixelLockIcon size={13} />
                <span>
                  Respondent identity: <strong>{profile.email}</strong> (Logged-in email is captured automatically)
                </span>
              </div>

              <div className="gf-header-footer">
                <div className="gf-theme-picker">
                  <span className="gf-theme-label">Category:</span>
                  <div className="gf-category-pills">
                    {FORM_CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        className={`pixel-paper-btn compact ${category === cat.key ? "primary" : ""}`}
                        style={category === cat.key ? { backgroundColor: primaryAccent } : undefined}
                        onClick={() => handleCategorySwitch(cat.key)}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => setShowThemeDrawer(true)}
                >
                  <PixelPaletteIcon size={12} />
                  <span>Customize Background &amp; Art</span>
                </button>
              </div>
            </div>

            {/* 2. QUESTION CARDS LIST */}
            {nodes.length === 0 ? (
              <div className="gf-empty-stream-card">
                <PixelQuestionsIcon size={32} className="gf-empty-pixel-icon" />
                <p style={{ margin: 0, fontWeight: 700 }}>This paper sheet has no questions yet.</p>
                <button
                  type="button"
                  className="pixel-paper-btn primary"
                  style={{ backgroundColor: primaryAccent }}
                  onClick={() => handleAddNode("short_text")}
                >
                  <PixelPlusIcon size={14} />
                  <span>Add First Question</span>
                </button>
              </div>
            ) : (
              nodes.map((node, idx) => {
                const isActive = selectedNodeId === node.id;
                const isTypeMenuOpen = openTypeMenuNodeId === node.id;

                return (
                  <div
                    key={node.id}
                    id={`gf-card-${node.id}`}
                    draggable={!isTypeMenuOpen}
                    onDragStart={() => setDragIndex(idx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null) handleMoveNode(dragIndex, idx);
                      setDragIndex(null);
                    }}
                    onClick={() => setSelectedNodeId(node.id)}
                    className={`gf-card ${isActive ? "active" : ""}`}
                    style={isActive ? { borderLeft: `6px solid ${primaryAccent}` } : undefined}
                  >
                    <div className="gf-card-reorder-bar" title="Drag to reorder question cards">
                      <PixelDragHandleIcon size={16} />
                    </div>

                    {isActive ? (
                      <div className="gf-card-edit-body stack">
                        {/* Top row: Label + FIXED Custom Pixel Field Type Selector */}
                        <div className="gf-card-row-top">
                          <input
                            type="text"
                            value={node.label}
                            onChange={(e) => updateNode(node.id, { label: e.target.value })}
                            placeholder="Question label / title..."
                            className="gf-card-title-input"
                          />

                          <div className="gf-custom-select-anchor" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              className={`gf-custom-select-trigger ${isTypeMenuOpen ? "open" : ""}`}
                              onClick={() =>
                                setOpenTypeMenuNodeId(isTypeMenuOpen ? null : node.id)
                              }
                            >
                              <PixelFieldTypeIcon type={node.type} size={15} />
                              <span style={{ flex: 1, textAlign: "left" }}>
                                {FLAT_FIELD_LABELS[node.type] ?? node.type}
                              </span>
                              <PixelArrowDownIcon size={12} />
                            </button>

                            {isTypeMenuOpen && (
                              <div className="gf-custom-type-menu" role="listbox">
                                {FIELD_TYPE_GROUPS.map((grp) => (
                                  <div key={grp.group} className="gf-type-group">
                                    <div className="gf-type-group-label">{grp.group}</div>
                                    {grp.items.map((opt) => (
                                      <button
                                        key={opt.type}
                                        type="button"
                                        role="option"
                                        aria-selected={node.type === opt.type}
                                        className={`gf-type-menu-item ${
                                          node.type === opt.type ? "selected" : ""
                                        }`}
                                        onClick={() => handleChangeFieldType(node, opt.type)}
                                      >
                                        <PixelFieldTypeIcon type={opt.type} size={15} />
                                        <span>{opt.label}</span>
                                      </button>
                                    ))}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={node.helpText ?? ""}
                          onChange={(e) => updateNode(node.id, { helpText: e.target.value })}
                          placeholder="Helper text or rubric guidance (optional)..."
                          className="gf-card-help-input"
                        />

                        {(node.type === "short_text" || node.type === "email" || node.type === "number") && (
                          <div className="gf-inline-mock-input stack" style={{ gap: "0.4rem" }}>
                            <input
                              type="text"
                              value={node.placeholder ?? ""}
                              onChange={(e) => updateNode(node.id, { placeholder: e.target.value })}
                              placeholder={`Placeholder hint (e.g. Enter ${node.label.toLowerCase()})...`}
                              className="gf-mock-input-field"
                            />
                            {node.type === "email" && (
                              <span className="notice" style={{ fontSize: "0.75rem" }}>
                                Tip: Logged-in user email is already auto-recorded on submission. Only keep this field if requesting a secondary contact email.
                              </span>
                            )}
                          </div>
                        )}

                        {node.type === "long_text" && (
                          <div className="gf-inline-mock-input">
                            <textarea
                              rows={2}
                              value={node.placeholder ?? ""}
                              onChange={(e) => updateNode(node.id, { placeholder: e.target.value })}
                              placeholder="Placeholder text for paragraph response..."
                              className="gf-mock-textarea-field"
                            />
                          </div>
                        )}

                        {(node.type === "date" || node.type === "time" || node.type === "date_time") && (
                          <div className="gf-realtime-editor-box stack" style={{ gap: "0.65rem" }}>
                            <div className="gf-date-mock">
                              {node.type === "date_time" ? (
                                <>
                                  <PixelDateTimeIcon size={16} />
                                  <span>
                                    Default preview:{" "}
                                    <strong>
                                      {node.defaultToNow !== false
                                        ? getLocalNowParts().dateTime
                                        : "dd / mm / yyyy  --:--"}
                                    </strong>
                                  </span>
                                </>
                              ) : node.type === "time" ? (
                                <>
                                  <PixelClockIcon size={16} />
                                  <span>
                                    Default preview:{" "}
                                    <strong>
                                      {node.defaultToNow !== false ? getLocalNowParts().time : "--:--"}
                                    </strong>
                                  </span>
                                </>
                              ) : (
                                <>
                                  <PixelDateIcon size={16} />
                                  <span>
                                    Default preview:{" "}
                                    <strong>
                                      {node.defaultToNow ? getLocalNowParts().date : "dd / mm / yyyy"}
                                    </strong>
                                  </span>
                                </>
                              )}
                            </div>

                            <label className="gf-inline-check-toggle">
                              <input
                                type="checkbox"
                                checked={
                                  node.type === "date"
                                    ? Boolean(node.defaultToNow)
                                    : node.defaultToNow !== false
                                }
                                onChange={(e) =>
                                  updateNode(node.id, { defaultToNow: e.target.checked })
                                }
                              />
                              <span>
                                Auto-fill live real-world {node.type.replace("_", " & ")} when opened (User can still edit manually)
                              </span>
                            </label>
                          </div>
                        )}

                        {node.type === "star_rating" && (
                          <div className="gf-rating-editor-box stack" style={{ gap: "0.65rem" }}>
                            <div className="row-actions" style={{ alignItems: "center", gap: "0.75rem" }}>
                              <div className="fr-stars-row" style={{ pointerEvents: "none" }}>
                                {Array.from(
                                  { length: node.maxRating ?? 5 },
                                  (_, i) => i + 1,
                                ).map((n) => (
                                  <span key={n} style={{ color: "#d97706" }}>
                                    <PixelStarIcon size={20} />
                                  </span>
                                ))}
                              </div>
                              <select
                                value={node.maxRating ?? 5}
                                onChange={(e) =>
                                  updateNode(node.id, { maxRating: Number(e.target.value) })
                                }
                                className="gf-select-compact"
                              >
                                <option value={5}>5 Stars Maximum</option>
                                <option value={7}>7 Stars Maximum</option>
                                <option value={10}>10 Stars Maximum</option>
                              </select>
                            </div>

                            <div className="grid-2" style={{ gap: "0.5rem" }}>
                              <input
                                type="text"
                                value={node.ratingLabels?.low ?? ""}
                                onChange={(e) =>
                                  updateNode(node.id, {
                                    ratingLabels: { ...(node.ratingLabels ?? {}), low: e.target.value },
                                  })
                                }
                                placeholder="1 star label (e.g. Poor)"
                                className="gf-mock-input-field"
                              />
                              <input
                                type="text"
                                value={node.ratingLabels?.high ?? ""}
                                onChange={(e) =>
                                  updateNode(node.id, {
                                    ratingLabels: { ...(node.ratingLabels ?? {}), high: e.target.value },
                                  })
                                }
                                placeholder="Top star label (e.g. Outstanding)"
                                className="gf-mock-input-field"
                              />
                            </div>
                          </div>
                        )}

                        {node.type === "linear_scale" && (
                          <div className="gf-rating-editor-box stack" style={{ gap: "0.65rem" }}>
                            <div className="row-actions" style={{ alignItems: "center", gap: "0.5rem" }}>
                              <span className="gf-theme-label">Scale Range:</span>
                              <select
                                value={node.maxRating ?? 10}
                                onChange={(e) =>
                                  updateNode(node.id, {
                                    minRating: 1,
                                    maxRating: Number(e.target.value),
                                  })
                                }
                                className="gf-select-compact"
                              >
                                <option value={5}>1 to 5 Rubric</option>
                                <option value={10}>1 to 10 Rubric</option>
                              </select>
                            </div>
                            <div className="grid-2" style={{ gap: "0.5rem" }}>
                              <input
                                type="text"
                                value={node.ratingLabels?.low ?? ""}
                                onChange={(e) =>
                                  updateNode(node.id, {
                                    ratingLabels: { ...(node.ratingLabels ?? {}), low: e.target.value },
                                  })
                                }
                                placeholder="Low end label (e.g. Needs work)"
                                className="gf-mock-input-field"
                              />
                              <input
                                type="text"
                                value={node.ratingLabels?.high ?? ""}
                                onChange={(e) =>
                                  updateNode(node.id, {
                                    ratingLabels: { ...(node.ratingLabels ?? {}), high: e.target.value },
                                  })
                                }
                                placeholder="High end label (e.g. Exceptional)"
                                className="gf-mock-input-field"
                              />
                            </div>
                          </div>
                        )}

                        {node.type === "image" && (
                          <div className="gf-image-block-editor stack" style={{ gap: "0.65rem" }}>
                            {node.imageUrl ? (
                              <div className="gf-embedded-preview-box">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={node.imageUrl}
                                  alt={node.caption || node.label}
                                  className="fr-embedded-image"
                                />
                                <div className="row-actions" style={{ marginTop: "0.5rem", gap: "0.45rem" }}>
                                  <button
                                    type="button"
                                    className="pixel-paper-btn compact"
                                    onClick={() => setMediaTarget({ mode: "field", nodeId: node.id })}
                                  >
                                    Replace Image
                                  </button>
                                  <button
                                    type="button"
                                    className="pixel-paper-btn compact danger"
                                    onClick={() => updateNode(node.id, { imageUrl: "" })}
                                  >
                                    Remove Image
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="pixel-paper-btn"
                                onClick={() => setMediaTarget({ mode: "field", nodeId: node.id })}
                              >
                                <PixelImageIcon size={14} />
                                <span>Search, Upload, or Choose Photo</span>
                              </button>
                            )}
                            <input
                              type="text"
                              value={node.caption ?? ""}
                              onChange={(e) => updateNode(node.id, { caption: e.target.value })}
                              placeholder="Optional photo caption..."
                              className="gf-mock-input-field"
                            />
                          </div>
                        )}

                        {node.type === "file_upload" && (
                          <div className="gf-file-upload-mock">
                            <PixelClipIcon size={22} />
                            <strong>Files routed to Company Google Drive</strong>
                            <span className="gf-file-sub">
                              Supports PDF, Images, Docs, and Spreadsheets up to 1 GiB.
                            </span>
                          </div>
                        )}

                        {(node.type === "dropdown" ||
                          node.type === "single_choice" ||
                          node.type === "multiple_choice") && (
                          <div className="gf-options-editor stack">
                            {(node.options ?? ["Option 1"]).map((opt, optIdx) => (
                              <div key={optIdx} className="gf-option-row">
                                <span className="gf-opt-symbol">
                                  {node.type === "single_choice" ? (
                                    <span className="gf-pixel-radio-shape" />
                                  ) : node.type === "multiple_choice" ? (
                                    <span className="gf-pixel-check-shape" />
                                  ) : (
                                    `${optIdx + 1}.`
                                  )}
                                </span>
                                <input
                                  type="text"
                                  value={opt}
                                  onChange={(e) => handleUpdateOption(node.id, optIdx, e.target.value)}
                                  className="gf-option-input"
                                  placeholder={`Option ${optIdx + 1}`}
                                />
                                {(node.options ?? []).length > 1 && (
                                  <button
                                    type="button"
                                    className="gf-opt-remove-btn"
                                    onClick={() => handleRemoveOption(node.id, optIdx)}
                                    title="Remove option"
                                  >
                                    &times;
                                  </button>
                                )}
                              </div>
                            ))}

                            <div className="gf-add-option-row">
                              <span className="gf-opt-symbol">
                                <PixelPlusIcon size={12} />
                              </span>
                              <button
                                type="button"
                                className="gf-add-opt-btn"
                                onClick={() => handleAddOption(node.id)}
                              >
                                Add another option
                              </button>
                            </div>
                          </div>
                        )}

                        {/* CARD ACTION FOOTER */}
                        <div className="gf-card-footer">
                          <div className="gf-footer-left">
                            <button
                              type="button"
                              className="gf-pixel-tile-btn"
                              title="Move question up"
                              disabled={idx === 0}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveNode(idx, idx - 1);
                              }}
                            >
                              <PixelArrowUpIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="gf-pixel-tile-btn"
                              title="Move question down"
                              disabled={idx === nodes.length - 1}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMoveNode(idx, idx + 1);
                              }}
                            >
                              <PixelArrowDownIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="gf-pixel-tile-btn"
                              title="Duplicate question"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateNode(node);
                              }}
                            >
                              <PixelDuplicateIcon size={14} />
                            </button>
                            <button
                              type="button"
                              className="gf-pixel-tile-btn danger"
                              title="Delete question"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNode(node.id);
                              }}
                            >
                              <PixelTrashIcon size={14} />
                            </button>
                          </div>

                          <div className="gf-footer-right">
                            {node.type !== "heading" &&
                              node.type !== "instructions" &&
                              node.type !== "section" &&
                              node.type !== "image" && (
                                <label className="gf-required-toggle" title="Toggle required field">
                                  <span>Required</span>
                                  <input
                                    type="checkbox"
                                    className="gf-pixel-switch-input"
                                    checked={Boolean(node.required)}
                                    onChange={(e) => updateNode(node.id, { required: e.target.checked })}
                                  />
                                </label>
                              )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* INACTIVE CARD: CLEAN PAPERCRAFT PREVIEW */
                      <div className="gf-card-idle-body">
                        <div className="gf-idle-top">
                          <div className="gf-idle-title-wrap">
                            <span className="gf-question-label">{node.label}</span>
                            {node.required && <span className="gf-req-star">*</span>}
                          </div>
                          <span className="gf-idle-type-pill">
                            <PixelFieldTypeIcon type={node.type} size={12} />
                            <span>{FLAT_FIELD_LABELS[node.type] ?? node.type}</span>
                          </span>
                        </div>

                        {node.helpText && <p className="gf-idle-help">{node.helpText}</p>}

                        <div className="gf-idle-preview-field">
                          {node.type === "heading" ? (
                            <h3 style={{ margin: "0.25rem 0", color: primaryAccent, fontWeight: 800 }}>
                              {node.label}
                            </h3>
                          ) : node.type === "instructions" ? (
                            <div className="notice" style={{ fontSize: "0.85rem" }}>
                              {node.helpText || node.label}
                            </div>
                          ) : node.type === "section" ? (
                            <hr className="gf-idle-divider" />
                          ) : node.type === "image" ? (
                            node.imageUrl ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={node.imageUrl}
                                alt={node.caption || node.label}
                                style={{ maxHeight: "140px", borderRadius: "6px", border: "1.5px solid var(--border-strong)" }}
                              />
                            ) : (
                              <div className="gf-idle-file-box">
                                <PixelImageIcon size={14} />
                                <span>Click to pick or upload banner photo</span>
                              </div>
                            )
                          ) : node.type === "star_rating" ? (
                            <div className="fr-stars-row">
                              {Array.from({ length: node.maxRating ?? 5 }, (_, i) => i + 1).map((n) => (
                                <span key={n} style={{ color: "#d97706" }}>
                                  <PixelStarIcon size={18} />
                                </span>
                              ))}
                            </div>
                          ) : node.type === "linear_scale" ? (
                            <div className="fr-scale-row">
                              {Array.from(
                                { length: (node.maxRating ?? 10) - (node.minRating ?? 1) + 1 },
                                (_, i) => (node.minRating ?? 1) + i,
                              ).map((step) => (
                                <span key={step} className="fr-scale-tile" style={{ pointerEvents: "none" }}>
                                  {step}
                                </span>
                              ))}
                            </div>
                          ) : node.type === "date_time" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">
                                {node.defaultToNow !== false
                                  ? `Auto Live: ${getLocalNowParts().dateTime}`
                                  : "dd / mm / yyyy · hh:mm"}
                              </span>
                              <PixelDateTimeIcon size={15} />
                            </div>
                          ) : node.type === "time" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">
                                {node.defaultToNow !== false
                                  ? `Auto Live: ${getLocalNowParts().time}`
                                  : "-- : --"}
                              </span>
                              <PixelClockIcon size={15} />
                            </div>
                          ) : node.type === "long_text" ? (
                            <div className="gf-idle-mock-input" style={{ minHeight: "44px" }}>
                              <span className="gf-idle-placeholder">
                                {node.placeholder || "Paragraph response..."}
                              </span>
                            </div>
                          ) : node.type === "dropdown" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">
                                {node.placeholder || "Choose an option..."}
                              </span>
                              <PixelArrowDownIcon size={12} />
                            </div>
                          ) : node.type === "single_choice" ? (
                            <div className="stack" style={{ gap: "0.35rem" }}>
                              {(node.options ?? ["Option 1", "Option 2"]).map((opt, i) => (
                                <div key={i} className="gf-idle-choice-row">
                                  <span className="gf-pixel-radio-shape" />
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          ) : node.type === "multiple_choice" ? (
                            <div className="stack" style={{ gap: "0.35rem" }}>
                              {(node.options ?? ["Option A", "Option B"]).map((opt, i) => (
                                <div key={i} className="gf-idle-choice-row">
                                  <span className="gf-pixel-check-shape" />
                                  <span>{opt}</span>
                                </div>
                              ))}
                            </div>
                          ) : node.type === "date" ? (
                            <div className="gf-idle-mock-input row-between">
                              <span className="gf-idle-placeholder">
                                {node.defaultToNow ? getLocalNowParts().date : "dd / mm / yyyy"}
                              </span>
                              <PixelDateIcon size={14} />
                            </div>
                          ) : node.type === "file_upload" ? (
                            <div className="gf-idle-file-box">
                              <PixelClipIcon size={14} />
                              <span>Choose file (Google Drive up to 1 GiB)</span>
                            </div>
                          ) : (
                            <div className="gf-idle-mock-input">
                              <span className="gf-idle-placeholder">
                                {node.placeholder || "Short answer text..."}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {/* BOTTOM QUICK-ADD PAPERCRAFT DOCK */}
            <div className="gf-bottom-quick-add">
              <span className="gf-quick-add-label">Quick Add:</span>
              <div className="gf-quick-add-pills">
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("short_text")}
                >
                  <PixelPlusIcon size={12} />
                  <span>Question</span>
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("date_time")}
                >
                  <PixelDateTimeIcon size={12} />
                  <span>Date/Time (Auto)</span>
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("star_rating")}
                >
                  <PixelStarIcon size={12} />
                  <span>Star Rating</span>
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("dropdown")}
                >
                  <PixelDropdownIcon size={12} />
                  <span>Dropdown</span>
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("image")}
                >
                  <PixelImageIcon size={12} />
                  <span>Image</span>
                </button>
                <button
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => handleAddNode("file_upload")}
                >
                  <PixelClipIcon size={12} />
                  <span>File Upload</span>
                </button>
              </div>
            </div>
          </div>

          {/* 3. FLOATING PAPERCRAFT + PIXEL ART ACTION RAIL */}
          <aside className="gf-action-rail" aria-label="Add Element Quick Actions">
            <div className="gf-rail-box">
              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("short_text")}
                title="Add Question (Short Text)"
              >
                <PixelPlusIcon size={16} />
                <span className="gf-rail-tooltip">Add Question</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("date_time")}
                title="Add Auto Real-Time Date & Time"
              >
                <PixelDateTimeIcon size={16} />
                <span className="gf-rail-tooltip">Real-Time Date &amp; Time</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("star_rating")}
                title="Add Pixel Star Rating (Voting)"
              >
                <PixelStarIcon size={16} />
                <span className="gf-rail-tooltip">Star Rating (Judge/Vote)</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("dropdown")}
                title="Add Dropdown Select"
              >
                <PixelDropdownIcon size={16} />
                <span className="gf-rail-tooltip">Dropdown Select</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("single_choice")}
                title="Add Multiple Choice (Radio)"
              >
                <PixelRadioIcon size={16} />
                <span className="gf-rail-tooltip">Multiple Choice</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("multiple_choice")}
                title="Add Checkboxes"
              >
                <PixelCheckboxIcon size={16} />
                <span className="gf-rail-tooltip">Checkboxes</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("image")}
                title="Insert Photo / Decoration Banner"
              >
                <PixelImageIcon size={16} />
                <span className="gf-rail-tooltip">Insert Image / Banner</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("file_upload")}
                title="Add Google Drive File Upload"
              >
                <PixelClipIcon size={16} />
                <span className="gf-rail-tooltip">File Upload</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("heading")}
                title="Add Section Heading"
              >
                <PixelTextIcon size={16} />
                <span className="gf-rail-tooltip">Title / Heading</span>
              </button>

              <button
                type="button"
                className="gf-rail-btn"
                onClick={() => handleAddNode("section")}
                title="Add Section Divider"
              >
                <PixelDividerIcon size={16} />
                <span className="gf-rail-tooltip">Section Divider</span>
              </button>
            </div>
          </aside>
        </main>
      )}

      {/* ======================================================================
          VIEW 2: LIVE PREVIEW MODE (USES REAL FORM RENDERER + REAL THEME)
          ====================================================================== */}
      {activeTab === "preview" && (
        <section className="gf-preview-stage" aria-label="Live Interactive Preview">
          <div className="gf-preview-controls">
            <div className="gf-device-switcher">
              <button
                type="button"
                className={`gf-device-btn ${previewDevice === "phone" ? "active" : ""}`}
                onClick={() => setPreviewDevice("phone")}
              >
                <PixelPhoneIcon size={15} />
                <span>Mobile Phone (iPhone 16)</span>
              </button>
              <button
                type="button"
                className={`gf-device-btn ${previewDevice === "desktop" ? "active" : ""}`}
                onClick={() => setPreviewDevice("desktop")}
              >
                <PixelDesktopIcon size={15} />
                <span>Desktop Browser (1024px)</span>
              </button>
            </div>
            <span className="notice" style={{ fontSize: "0.8rem", margin: 0 }}>
              Interactive live preview with real-time Date/Time defaults, theme art, and star ratings.
            </span>
          </div>

          {previewDevice === "phone" && (
            <div className="gf-phone-chassis">
              <div className="gf-phone-notch">
                <span className="gf-phone-lens" />
              </div>

              <div className="gf-phone-screen" style={stageBgStyle}>
                {theme.bannerImageUrl && (
                  <div className="gf-preview-banner-wrap compact">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={theme.bannerImageUrl} alt="Form Banner" className="gf-banner-img" />
                  </div>
                )}

                <div
                  className="gf-preview-header-card"
                  style={{ borderTop: `6px solid ${primaryAccent}` }}
                >
                  <h2 className="gf-preview-title">{title || "Untitled Form"}</h2>
                  <p className="gf-preview-desc">{description}</p>
                  <div className="gf-preview-meta">
                    <span className="pixel-stamp-badge live">
                      <PixelLockIcon size={10} />
                      <span>{profile.email}</span>
                    </span>
                    <span style={{ fontSize: "0.72rem", color: "var(--muted)" }}>* Required</span>
                  </div>
                </div>

                {theme.submissionsClosed ? (
                  <div className="gf-closed-lock-card">
                    <PixelLockIcon size={24} />
                    <strong>Submissions Paused / Closed</strong>
                    <p className="notice" style={{ margin: 0 }}>
                      {theme.closedReason || "This form is currently closed to new responses."}
                    </p>
                  </div>
                ) : (
                  <>
                    <FormRenderer
                      nodes={nodes}
                      theme={theme}
                      answers={previewAnswers}
                      compactCards
                      onChange={(fid, val) =>
                        setPreviewAnswers((prev) => ({ ...prev, [fid]: val }))
                      }
                    />
                    <div className="gf-preview-submit-wrap">
                      <button
                        type="button"
                        className="pixel-paper-btn primary"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          padding: "0.75rem",
                          backgroundColor: primaryAccent,
                        }}
                      >
                        <span>Submit Form</span>
                        <PixelArrowRightIcon size={14} />
                      </button>
                    </div>
                  </>
                )}
              </div>

              <div className="gf-phone-home-bar" />
            </div>
          )}

          {previewDevice === "desktop" && (
            <div className="gf-desktop-chassis">
              <div className="gf-desktop-browser-bar">
                <div className="gf-browser-dots">
                  <span className="dot red" />
                  <span className="dot yellow" />
                  <span className="dot green" />
                </div>
                <div className="gf-browser-url-pill">
                  <PixelLockIcon size={12} />
                  <span>forms.mesrc.com.my/forms/{slug || "new-form"}</span>
                </div>
                <div style={{ width: 44 }} />
              </div>

              <div className="gf-desktop-screen" style={stageBgStyle}>
                {theme.bannerImageUrl && (
                  <div className={`gf-preview-banner-wrap ${theme.bannerHeight ?? "medium"}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={theme.bannerImageUrl} alt="Form Banner" className="gf-banner-img" />
                  </div>
                )}

                <div
                  className="gf-preview-header-card"
                  style={{ borderTop: `8px solid ${primaryAccent}` }}
                >
                  <h1 className="gf-preview-title" style={{ fontSize: "1.75rem" }}>
                    {title || "Untitled Form"}
                  </h1>
                  <p className="gf-preview-desc">{description}</p>
                  <div className="gf-preview-meta">
                    <span className="pixel-stamp-badge live">
                      <PixelLockIcon size={10} />
                      <span>Signed in: {profile.email}</span>
                    </span>
                    <span style={{ fontSize: "0.78rem", color: "var(--muted)" }}>
                      * Indicates required question
                    </span>
                  </div>
                </div>

                {theme.submissionsClosed ? (
                  <div className="gf-closed-lock-card">
                    <PixelLockIcon size={28} />
                    <strong>Submissions Paused / Closed</strong>
                    <p className="notice" style={{ margin: 0 }}>
                      {theme.closedReason || "This form is currently closed to new responses."}
                    </p>
                  </div>
                ) : (
                  <>
                    <FormRenderer
                      nodes={nodes}
                      theme={theme}
                      answers={previewAnswers}
                      onChange={(fid, val) =>
                        setPreviewAnswers((prev) => ({ ...prev, [fid]: val }))
                      }
                    />
                    <div className="row-actions" style={{ marginTop: "0.5rem", gap: "0.75rem" }}>
                      <button
                        type="button"
                        className="pixel-paper-btn primary"
                        style={{ padding: "0.75rem 1.75rem", backgroundColor: primaryAccent }}
                      >
                        <span>Submit Form</span>
                        <PixelArrowRightIcon size={14} />
                      </button>
                      {allowSaveDraft && (
                        <button type="button" className="pixel-paper-btn">
                          <PixelSaveIcon size={14} />
                          <span>Save Draft</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ======================================================================
          VIEW 3: FORMS CATALOG, TEMPLATES, PUBLISH / UNPUBLISH / DELETE
          ====================================================================== */}
      {activeTab === "catalog" && (
        <main className="gf-catalog-stage">
          <section className="card stack" style={{ maxWidth: "1060px", margin: "2rem auto" }}>
            <div className="row-between" style={{ alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <h2>Official Templates &amp; Form Catalog</h2>
                <p className="notice">
                  Start quickly from a pre-configured template or manage live, paused, draft, and deleted forms.
                </p>
              </div>
              <div className="row-actions" style={{ gap: "0.45rem" }}>
                <button
                  type="button"
                  className={`pixel-paper-btn compact ${!catalogShowArchived ? "primary" : ""}`}
                  onClick={() => setCatalogShowArchived(false)}
                >
                  Active Forms ({forms.filter((f) => f.state !== "archived").length})
                </button>
                <button
                  type="button"
                  className={`pixel-paper-btn compact ${catalogShowArchived ? "primary" : ""}`}
                  onClick={() => setCatalogShowArchived(true)}
                >
                  Archived ({forms.filter((f) => f.state === "archived").length})
                </button>
              </div>
            </div>

            {/* Template Starter Cards */}
            <div className="gf-templates-strip">
              {FORM_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  className="pixel-paper-btn compact"
                  onClick={() => runWithUnsavedCheck(() => applyLoadTemplate(tpl.key))}
                >
                  <PixelPlusIcon size={12} />
                  <span>Template: {tpl.name}</span>
                </button>
              ))}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Form Title</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Version</th>
                    <th>Lifecycle Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCatalogForms.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="notice" style={{ textAlign: "center", padding: "2rem" }}>
                        {catalogShowArchived
                          ? "No archived forms."
                          : "No forms found yet. Pick a template above to create your first form!"}
                      </td>
                    </tr>
                  ) : (
                    visibleCatalogForms.map((f) => {
                      const fTheme = formThemesMap[f.id];
                      const fCat = resolveFormCategory(f, fTheme);
                      const catLabel =
                        FORM_CATEGORIES.find((c) => c.key === fCat)?.label ?? fCat;
                      const isClosed = f.state === "published" && Boolean(fTheme?.submissionsClosed);

                      return (
                        <tr key={f.id}>
                          <td>
                            <strong style={{ color: "var(--ink)" }}>{f.title}</strong>
                            <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
                              <code>{f.slug}</code>
                            </div>
                          </td>
                          <td>
                            <span className="pixel-tag-pill">{catLabel}</span>
                          </td>
                          <td>
                            {f.state === "archived" ? (
                              <span className="pixel-stamp-badge draft">ARCHIVED</span>
                            ) : isClosed ? (
                              <span className="pixel-stamp-badge paused">
                                <PixelPauseIcon size={10} />
                                <span>PAUSED (LOCKED)</span>
                              </span>
                            ) : f.state === "published" ? (
                              <span className="pixel-stamp-badge live">
                                <PixelSparkleIcon size={10} />
                                <span>LIVE</span>
                              </span>
                            ) : (
                              <span className="pixel-stamp-badge draft">DRAFT</span>
                            )}
                          </td>
                          <td>
                            v{f.latest_version}{" "}
                            {f.current_published_version ? `(Live v${f.current_published_version})` : ""}
                          </td>
                          <td>
                            <div className="row-actions" style={{ gap: "0.4rem", flexWrap: "wrap" }}>
                              <button
                                type="button"
                                className="pixel-paper-btn compact primary"
                                onClick={() =>
                                  runWithUnsavedCheck(() => void applySelectExistingForm(f))
                                }
                              >
                                <span>Open</span>
                                <PixelArrowRightIcon size={12} />
                              </button>

                              {f.state === "published" && !isClosed && (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact warning"
                                  disabled={busy}
                                  onClick={() => void handleToggleCatalogPause(f, true)}
                                  title="Stop entries while keeping form card visible & locked"
                                >
                                  <PixelPauseIcon size={12} />
                                  <span>Unpublish</span>
                                </button>
                              )}

                              {f.state === "published" && isClosed && (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact"
                                  disabled={busy}
                                  onClick={() => void handleToggleCatalogPause(f, false)}
                                  title="Re-open entries for staff"
                                >
                                  <PixelPlayIcon size={12} />
                                  <span>Re-Publish</span>
                                </button>
                              )}

                              {f.state !== "archived" ? (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact danger"
                                  disabled={busy}
                                  onClick={() => void handleArchiveOrDelete(f.id, false)}
                                >
                                  <PixelTrashIcon size={12} />
                                  <span>Delete</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="pixel-paper-btn compact"
                                  disabled={busy}
                                  onClick={() => void handleArchiveOrDelete(f.id, true)}
                                >
                                  <span>Restore Draft</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      )}

      {/* ======================================================================
          VIEW 4: SETTINGS, UNPUBLISH MESSAGE & ACCESS ALLOWLIST
          ====================================================================== */}
      {activeTab === "settings" && (
        <main className="gf-settings-stage">
          <section className="card stack" style={{ maxWidth: "860px", margin: "2rem auto" }}>
            <div className="row-between">
              <div>
                <h2>Form Configuration &amp; Access Policies</h2>
                <p className="notice">
                  Manage dashboard category, URL slug, closed/paused notice, services, and email access rules.
                </p>
              </div>
              {selectedFormId && (
                <button
                  type="button"
                  className="pixel-paper-btn compact danger"
                  disabled={busy}
                  onClick={() => void handleArchiveOrDelete(selectedFormId, false)}
                >
                  <PixelTrashIcon size={13} />
                  <span>Delete Form</span>
                </button>
              )}
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="fb-title">Form Title</label>
                <input
                  id="fb-title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="fb-slug">URL Slug</label>
                <input
                  id="fb-slug"
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="fb-desc">Form Description</label>
              <textarea
                id="fb-desc"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label htmlFor="fb-category">Dashboard Category</label>
                <select
                  id="fb-category"
                  value={category}
                  onChange={(e) => handleCategorySwitch(e.target.value as FormCategory)}
                >
                  {FORM_CATEGORIES.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="fb-closed-msg">Paused / Closed Notice (When Unpublished)</label>
                <input
                  id="fb-closed-msg"
                  type="text"
                  placeholder="e.g. Finalis MCEP voting window is now closed."
                  value={theme.closedReason ?? ""}
                  onChange={(e) => setTheme({ ...theme, closedReason: e.target.value })}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>Associated Services (Operations)</label>
                <div className="row-actions" style={{ marginTop: "0.35rem" }}>
                  {services.length === 0 ? (
                    <span className="notice" style={{ fontSize: "0.85rem" }}>
                      No company services defined yet.
                    </span>
                  ) : (
                    services.map((svc) => {
                      const checked = selectedServices.includes(svc.id);
                      return (
                        <label
                          key={svc.id}
                          style={{
                            fontWeight: 500,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            fontSize: "0.86rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              setSelectedServices((prev) =>
                                e.target.checked
                                  ? [...prev, svc.id]
                                  : prev.filter((x) => x !== svc.id),
                              )
                            }
                          />
                          {svc.name}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="field">
                <label htmlFor="fb-allowlist">
                  Email Allowlist (Leave empty for all active members)
                </label>
                <textarea
                  id="fb-allowlist"
                  rows={3}
                  placeholder="Optional: one email per line. If populated, only listed emails can view and submit."
                  value={allowlistText}
                  onChange={(e) => setAllowlistText(e.target.value)}
                />
              </div>
            </div>

            <div className="profile-dropdown-divider" />

            <div className="stack" style={{ gap: "0.65rem" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.86rem" }}>
                <input
                  type="checkbox"
                  checked={allowSaveDraft}
                  onChange={(e) => setAllowSaveDraft(e.target.checked)}
                />
                Allow applicants to save in-progress drafts
              </label>

              <label style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.86rem" }}>
                <input
                  type="checkbox"
                  checked={allowAppeal}
                  onChange={(e) => setAllowAppeal(e.target.checked)}
                />
                Enable formal appeal / complaint tracking on responses
              </label>
            </div>
          </section>
        </main>
      )}

      {/* ======================================================================
          MEDIA PICKER MODAL (BANNER, BACKGROUND PHOTO, EMBEDDED IMAGE)
          ====================================================================== */}
      {mediaTarget && (
        <MediaPickerModal
          title={
            mediaTarget.mode === "banner"
              ? "Choose Header Banner Image"
              : mediaTarget.mode === "background"
                ? "Choose Background Image"
                : "Insert Image Graphic"
          }
          currentUrl={
            mediaTarget.mode === "banner"
              ? theme.bannerImageUrl
              : mediaTarget.mode === "background"
                ? theme.backgroundImageUrl
                : nodes.find((n) => n.id === mediaTarget.nodeId)?.imageUrl
          }
          onClose={() => setMediaTarget(null)}
          onSelect={(url) => {
            if (mediaTarget.mode === "banner") {
              setTheme((prev) => ({ ...prev, bannerImageUrl: url }));
            } else if (mediaTarget.mode === "background") {
              setTheme((prev) => ({ ...prev, backgroundImageUrl: url }));
            } else {
              updateNode(mediaTarget.nodeId, { imageUrl: url });
            }
          }}
        />
      )}

      {/* ======================================================================
          UNSAVED CHANGES REMINDER MODAL
          ====================================================================== */}
      {pendingNavAction && (
        <div className="pixel-modal-backdrop" role="dialog" aria-modal="true" aria-label="Unsaved Changes">
          <div className="pixel-modal-card" style={{ maxWidth: "460px" }}>
            <div className="pixel-modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#b45309" }}>
                <PixelWarningIcon size={20} />
                <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Unsaved Changes</h2>
              </div>
            </div>
            <p className="notice" style={{ margin: "0.25rem 0 1rem" }}>
              You have unsaved edits on <strong>{title}</strong>. Would you like to save a draft before leaving?
            </p>
            <div className="row-actions" style={{ justifyContent: "flex-end", gap: "0.5rem", flexWrap: "wrap" }}>
              <button
                type="button"
                className="pixel-paper-btn compact"
                onClick={() => setPendingNavAction(null)}
              >
                Stay Here
              </button>
              <button
                type="button"
                className="pixel-paper-btn compact danger"
                onClick={() => {
                  const act = pendingNavAction;
                  setIsDirty(false);
                  setPendingNavAction(null);
                  act();
                }}
              >
                Discard Changes
              </button>
              <button
                type="button"
                className="pixel-paper-btn primary"
                disabled={busy}
                onClick={async () => {
                  const ok = await handleSaveDraft();
                  if (ok) {
                    const act = pendingNavAction;
                    setPendingNavAction(null);
                    act();
                  }
                }}
              >
                <PixelSaveIcon size={14} />
                <span>{busy ? "Saving..." : "Save Draft & Continue"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
