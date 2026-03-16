VYVA Super Admin Dashboard - design system, architecture, and key decisions

## Design System
- Fonts: Space Grotesk (display/headings), Inter (body)
- Logo: src/assets/logo-with-bg.png (purple bg, white text, gold tagline)
- Primary: HSL 252 85% 60% (vibrant purple)
- Secondary: HSL 190 80% 50% (teal)
- Accent: HSL 45 100% 50% (gold - from logo tagline)
- vyva-purple: 270 60% 38% (deeper purple from logo bg)
- vyva-gold: 45 100% 50% (replaces old vyva-orange)
- vyva-teal, vyva-pink, vyva-green unchanged
- Dark sidebar with light content area
- Gradient stat cards on dashboard

## Architecture
- Read-only dashboard; data comes from external onboarding agent
- Agent POSTs to api.vyva.io which routes to onboarding-webhook edge function
- onboarding-webhook validates via x-api-key header (WEBHOOK_API_KEY secret)
- invite-admin edge function for invite-only auth flow
- Roles: admin, operator, coordinator (app_role enum)
- has_role() and is_admin_user() security definer functions for RLS

## Tables
profiles, user_roles, vyva_users, vyva_user_consent, vyva_user_health,
vyva_user_medications, vyva_user_checkins, vyva_user_brain_coach, vyva_user_caregivers
