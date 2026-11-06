export type FieldType =
  | "heading"
  | "instructions"
  | "section"
  | "short_text"
  | "long_text"
  | "email"
  | "number"
  | "date"
  | "single_choice"
  | "multiple_choice"
  | "dropdown"
  | "file_upload";

export interface FormFieldNode {
  id: string;
  type: FieldType;
  label: string;
  helpText?: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
  width?: "full" | "half";
}

export interface FormTheme {
  primaryColor?: string;
  cardRadius?: "sharp" | "rounded" | "pill";
  density?: "comfortable" | "compact";
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
  created_at: string;
  updated_at: string;
}

export interface FormTemplate {
  key: string;
  name: string;
  kind: FormKind;
  title: string;
  slug: string;
  description: string;
  allowAppeal: boolean;
  nodes: FormFieldNode[];
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    key: "employee_request",
    name: "General Service Request",
    kind: "general",
    title: "General Operations Request",
    slug: "general-operations-request",
    description: "Submit an internal service or operational request.",
    allowAppeal: false,
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
    kind: "appeal_enabled",
    title: "Formal Review & Appeal Form",
    slug: "formal-review-appeal",
    description: "Submit a formal appeal or review request with supporting grounds.",
    allowAppeal: true,
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
  {
    key: "complaint_ticket",
    name: "Operational Complaint",
    kind: "complaint",
    title: "Service & Operations Complaint",
    slug: "service-operations-complaint",
    description: "Report an operational issue or service complaint to open a tracked ticket.",
    allowAppeal: false,
    nodes: [
      {
        id: "f_category",
        type: "dropdown",
        label: "Complaint Category",
        required: true,
        options: ["Service Delay", "Facility / Equipment", "Conduct", "Safety", "Other"],
        width: "half",
      },
      {
        id: "f_incident_date",
        type: "date",
        label: "Incident Date",
        required: true,
        width: "half",
      },
      {
        id: "f_subject",
        type: "short_text",
        label: "Subject",
        required: true,
        width: "full",
      },
      {
        id: "f_description",
        type: "long_text",
        label: "What happened?",
        required: true,
        width: "full",
      },
    ],
  },
];