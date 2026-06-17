export interface ScheduledCall {
  id: number | string;
  user_id: number | string;
  userName: string;
  userPhone?: string;
  city?: string | null;
  type?: string;
  is_active: boolean;
  frequency_days: number;
  preferred_time?: string | null;
  paused_until?: string | null;
  pause_reason?: string | null;
  pause_source?: string | null;
  is_paused?: boolean;
  consent_given?: boolean;
  assigned_provider_name?: string | null;
  can_edit?: boolean;
  edit_block_reason?: "consent_required" | "assigned_provider_required" | null;
  lastOutcome?: string | null;
  lastOutcomeAt?: string | null;
}

export interface ScheduledCallUser {
  id: number | string;
  first_name?: string;
  last_name?: string;
  name?: string;
  phone?: string | null;
  city?: string | null;
}

export interface ScheduledCallPayload {
  user_id: string;
  type: string;
  is_active: boolean;
  frequency_days: number;
  preferred_time: string | null;
  paused_until?: string | null;
  pause_reason?: string | null;
  pause_source?: string | null;
}
