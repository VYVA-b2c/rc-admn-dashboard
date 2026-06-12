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
}
