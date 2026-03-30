import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Validate API key
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("WEBHOOK_API_KEY");
  if (!expectedKey || apiKey !== expectedKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const payload = await req.json();

    // Validate required fields
    if (!payload.first_name || !payload.last_name) {
      return new Response(JSON.stringify({ error: "first_name and last_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert main user record (with field aliases)
    const { data: user, error: userError } = await supabase
      .from("vyva_users")
      .insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone_number || payload.phone || null,
        city: payload.city || null,
        street: payload.street || null,
        house_number: payload.house_number || null,
        post_code: payload.postal_code || payload.post_code || null,
        country: payload.country || "Germany",
        language: payload.language || "de",
        timezone: payload.timezone || "Europe/Berlin",
      })
      .select("id")
      .single();

    if (userError) throw userError;
    const userId = user.id;

    // Insert consent (accept data_consent_given alias)
    const consentGiven = payload.data_consent_given ?? payload.consent_given;
    const caretakerConsent = payload.caretaker_consent;
    if (consentGiven !== undefined || caretakerConsent !== undefined) {
      await supabase.from("vyva_user_consent").insert({
        vyva_user_id: userId,
        consent_given: consentGiven ?? false,
        caretaker_consent: caretakerConsent ?? false,
      });
    }

    // Insert health data (accept health_concerns / mobility_restrictions aliases)
    const healthConditions = payload.health_conditions || payload.health_concerns;
    const mobilityNeeds = payload.mobility_needs || payload.mobility_restrictions;
    if (healthConditions || mobilityNeeds) {
      // Normalize to arrays
      const toArray = (v: any) => {
        if (!v) return [];
        if (Array.isArray(v)) return v;
        if (typeof v === "string") return v === "none" || v === "" ? [] : [v];
        return [];
      };
      await supabase.from("vyva_user_health").insert({
        vyva_user_id: userId,
        health_conditions: toArray(healthConditions),
        mobility_needs: toArray(mobilityNeeds),
      });
    }

    // Insert medications — support both array format and flat format
    let meds: any[] = [];
    if (payload.medications && Array.isArray(payload.medications)) {
      meds = payload.medications.map((m: any) => ({
        vyva_user_id: userId,
        medication_name: m.medication_name || m.name,
        purpose: m.purpose || null,
        dosage: m.dosage || null,
        schedule_times: m.schedule_times || [],
      }));
    } else if (payload.takes_medications === true || payload.takes_medications === "yes") {
      // Flat format: convert medication_schedule to a single medication entry
      const schedule = payload.medication_schedule || null;
      meds = [{
        vyva_user_id: userId,
        medication_name: "Prescribed medication",
        purpose: null,
        dosage: null,
        schedule_times: schedule ? [schedule] : [],
      }];
    }
    if (meds.length > 0) {
      await supabase.from("vyva_user_medications").insert(meds);
    }

    // Insert check-in settings — accept both nested and flat formats
    let checkinData: any = null;
    if (payload.checkins !== undefined) {
      const ci = typeof payload.checkins === "object" ? payload.checkins : { enabled: !!payload.checkins };
      checkinData = ci;
    } else if (payload.check_in_frequency || payload.check_in_time) {
      checkinData = {
        enabled: true,
        frequency: payload.check_in_frequency || null,
        preferred_time: payload.check_in_time || null,
      };
    }
    if (checkinData) {
      await supabase.from("vyva_user_checkins").insert({
        vyva_user_id: userId,
        enabled: checkinData.enabled ?? false,
        frequency: checkinData.frequency || null,
        preferred_time: checkinData.preferred_time || null,
      });
    }

    // Insert brain coach settings — accept brain_coach_interest alias
    let brainCoachData: any = null;
    if (payload.brain_coach !== undefined) {
      const bc = typeof payload.brain_coach === "object" ? payload.brain_coach : { enabled: !!payload.brain_coach };
      brainCoachData = bc;
    } else if (payload.brain_coach_interest !== undefined) {
      brainCoachData = {
        enabled: payload.brain_coach_interest === true || payload.brain_coach_interest === "yes",
      };
    }
    if (brainCoachData) {
      await supabase.from("vyva_user_brain_coach").insert({
        vyva_user_id: userId,
        enabled: brainCoachData.enabled ?? false,
        frequency: brainCoachData.frequency || null,
        preferred_time: brainCoachData.preferred_time || null,
      });
    }

    // Insert caregiver — accept emergency_contact_* aliases
    const caregiverName = payload.caretaker_name || payload.emergency_contact_name;
    const caregiverPhone = payload.caretaker_phone || payload.emergency_contact_phone;
    if (caregiverName || caregiverPhone) {
      await supabase.from("vyva_user_caregivers").insert({
        vyva_user_id: userId,
        caretaker_name: caregiverName || null,
        caretaker_phone: caregiverPhone || null,
      });
    }

    // Insert medication adherence logs if provided
    if (payload.medication_adherence && Array.isArray(payload.medication_adherence)) {
      for (const entry of payload.medication_adherence) {
        // Try to find the medication by name
        const { data: medMatch } = await supabase
          .from("vyva_user_medications")
          .select("id")
          .eq("vyva_user_id", userId)
          .ilike("medication_name", entry.medication_name || "")
          .maybeSingle();

        if (medMatch) {
          await supabase.from("vyva_medication_logs").upsert({
            vyva_user_id: userId,
            medication_id: medMatch.id,
            scheduled_date: entry.date,
            scheduled_time: entry.time || null,
            status: entry.status || "pending",
            reported_at: new Date().toISOString(),
            call_id: entry.call_id || null,
            notes: entry.notes || null,
          }, { onConflict: "medication_id,scheduled_date,scheduled_time" });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
