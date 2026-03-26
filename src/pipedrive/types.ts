// --- Common ---

export interface PipedriveResponse<T> {
  success: boolean;
  data: T;
  additional_data?: {
    next_cursor?: string;
    pagination?: { more_items_in_collection: boolean };
  };
}

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

// --- Deals ---

export interface Deal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: "open" | "won" | "lost" | "deleted";
  pipeline_id: number;
  stage_id: number;
  person_id: number | null;
  org_id: number | null;
  owner_id: number;
  expected_close_date: string | null;
  add_time: string;
  update_time: string;
  next_activity_date: string | null;
  next_activity_id: number | null;
  last_activity_date: string | null;
  won_time: string | null;
  lost_time: string | null;
  lost_reason: string | null;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateDealParams {
  title: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: "open" | "won" | "lost";
  expected_close_date?: string;
  owner_id?: number;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateDealParams {
  title?: string;
  value?: number;
  currency?: string;
  person_id?: number;
  org_id?: number;
  pipeline_id?: number;
  stage_id?: number;
  status?: "open" | "won" | "lost";
  expected_close_date?: string;
  owner_id?: number;
  custom_fields?: Record<string, unknown>;
}

// --- Activities ---

export interface Activity {
  id: number;
  subject: string;
  type: string;
  owner_id: number;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  due_date: string;
  due_time: string | null;
  duration: string | null;
  done: boolean;
  busy: boolean;
  note: string | null;
  location: string | null;
  add_time: string;
  update_time: string;
}

export interface CreateActivityParams {
  subject: string;
  type: string;
  due_date: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  owner_id?: number;
  done?: boolean;
  busy?: boolean;
  note?: string;
  location?: string;
}

export interface UpdateActivityParams {
  subject?: string;
  type?: string;
  due_date?: string;
  due_time?: string;
  duration?: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  done?: boolean;
  note?: string;
  location?: string;
}

// --- Persons ---

export interface Person {
  id: number;
  name: string;
  owner_id: number;
  org_id: number | null;
  emails: Array<{ value: string; primary: boolean; label: string }>;
  phones: Array<{ value: string; primary: boolean; label: string }>;
  add_time: string;
  update_time: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreatePersonParams {
  name: string;
  owner_id?: number;
  org_id?: number;
  emails?: Array<{ value: string; primary?: boolean; label?: string }>;
  phones?: Array<{ value: string; primary?: boolean; label?: string }>;
  custom_fields?: Record<string, unknown>;
}

export interface UpdatePersonParams {
  name?: string;
  owner_id?: number;
  org_id?: number;
  emails?: Array<{ value: string; primary?: boolean; label?: string }>;
  phones?: Array<{ value: string; primary?: boolean; label?: string }>;
  custom_fields?: Record<string, unknown>;
}

// --- Organizations ---

export interface Organization {
  id: number;
  name: string;
  owner_id: number;
  address: string | null;
  add_time: string;
  update_time: string;
  custom_fields?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CreateOrganizationParams {
  name: string;
  owner_id?: number;
  address?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateOrganizationParams {
  name?: string;
  owner_id?: number;
  address?: string;
  custom_fields?: Record<string, unknown>;
}

// --- Pipelines & Stages ---

export interface Pipeline {
  id: number;
  name: string;
  order_nr: number;
  is_deal_probability_enabled: boolean;
  add_time: string;
  update_time: string;
}

export interface Stage {
  id: number;
  name: string;
  pipeline_id: number;
  order_nr: number;
  deal_probability: number;
  add_time: string;
  update_time: string;
}

// --- Notes ---

export interface Note {
  id: number;
  content: string;
  user_id: number;
  deal_id: number | null;
  person_id: number | null;
  org_id: number | null;
  add_time: string;
  update_time: string;
  pinned_to_deal_flag: boolean;
  pinned_to_person_flag: boolean;
  pinned_to_organization_flag: boolean;
}

export interface CreateNoteParams {
  content: string;
  deal_id?: number;
  person_id?: number;
  org_id?: number;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
}

export interface UpdateNoteParams {
  content?: string;
  pinned_to_deal_flag?: boolean;
  pinned_to_person_flag?: boolean;
  pinned_to_organization_flag?: boolean;
}

// --- Search ---

export interface SearchResult {
  result_score: number;
  item: {
    id: number;
    type: string;
    title: string;
    [key: string]: unknown;
  };
}

// --- Custom Fields ---

export interface DealField {
  id: number;
  key: string;
  name: string;
  field_type: string;
  options?: Array<{ id: number; label: string }>;
  is_custom_field: boolean;
}
