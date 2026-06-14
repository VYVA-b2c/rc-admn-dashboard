export type CareProviderType = "caregiver" | "field_staff";

export interface LinkedCareUser {
  id?: string;
  name?: string;
  city?: string | null;
}

export interface CareProviderOption {
  id?: string;
  provider_id: string;
  provider_type: CareProviderType;
  display_name: string;
  phone?: string | null;
  role?: string | null;
  team?: string | null;
  status?: string | null;
  active?: boolean;
  assignment_count?: number;
  linked_users?: LinkedCareUser[];
}

export interface CareProviderAssignment extends CareProviderOption {
  id: string;
  assignment_id?: string;
  is_primary?: boolean;
  relationship_label?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export function providerTypeKey(type?: string | null) {
  return type === "field_staff" ? "careProviders.professional" : "careProviders.informal";
}

export function providerCoverageLabel(provider?: {
  display_name?: string | null;
  relationship_label?: string | null;
  role?: string | null;
  team?: string | null;
}) {
  return [provider?.relationship_label, provider?.role, provider?.team].filter(Boolean).join(" / ");
}
