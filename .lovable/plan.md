

## Plan: Close DB + Webhook Gaps

### Database Migration

Add `country` column to `vyva_users` and change defaults:

```sql
ALTER TABLE vyva_users ADD COLUMN country text DEFAULT 'Germany';
ALTER TABLE vyva_users ALTER COLUMN language SET DEFAULT 'de';
ALTER TABLE vyva_users ALTER COLUMN timezone SET DEFAULT 'Europe/Berlin';
```

### Webhook Updates (`supabase/functions/onboarding-webhook/index.ts`)

Accept both the agent's field names and the current names, mapping as needed:

| Agent sends | Maps to DB column |
|---|---|
| `phone_number` or `phone` | `phone` |
| `postal_code` or `post_code` | `post_code` |
| `country` | `country` (new) |
| `language` | `language` |
| `emergency_contact_name` or `caretaker_name` | `caretaker_name` |
| `emergency_contact_phone` or `caretaker_phone` | `caretaker_phone` |
| `data_consent_given` or `consent_given` | `consent_given` |
| `check_in_frequency` | checkins.frequency |
| `check_in_time` | checkins.preferred_time |
| `health_concerns` or `health_conditions` | health_conditions |
| `mobility_restrictions` or `mobility_needs` | mobility_needs |
| `takes_medications` + `medication_schedule` | medications array |
| `brain_coach_interest` or `brain_coach` | brain_coach |

Key changes in webhook logic:
1. **vyva_users insert** — add `country`, `language`, accept `phone_number`/`postal_code` aliases
2. **Consent** — also accept `data_consent_given`
3. **Health** — also accept `health_concerns` / `mobility_restrictions`
4. **Medications** — handle flat format (`takes_medications: true, medication_schedule: "every morning"`) by converting to array
5. **Check-ins** — accept flat `check_in_frequency` / `check_in_time` as alternative to nested `checkins` object
6. **Brain coach** — accept `brain_coach_interest` boolean
7. **Caregivers** — accept `emergency_contact_name` / `emergency_contact_phone` aliases

### Files
- **Migration**: Add `country` column, change `language` default to `de`, change `timezone` default to `Europe/Berlin`
- **Modified**: `supabase/functions/onboarding-webhook/index.ts` — field aliasing and flat-format handling

