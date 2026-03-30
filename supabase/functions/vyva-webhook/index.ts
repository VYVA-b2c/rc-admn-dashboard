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
    console.log("ElevenLabs webhook received:", JSON.stringify(payload).slice(0, 500));

    // Extract top-level ElevenLabs fields
    const conversationId = payload.conversation_id || null;
    const transcript = payload.transcript || null;
    const metadata = payload.metadata || {};
    const callDuration = metadata.call_duration || payload.call_duration || null;
    const callTimestamp = metadata.timestamp || payload.timestamp || new Date().toISOString();

    // Extract analysis data (the structured fields from the agent)
    const analysis = payload.analysis || payload.data || payload;
    const d = typeof analysis === "object" ? analysis : {};

    const firstName = d.first_name;
    const lastName = d.last_name;

    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "first_name and last_name are required in analysis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Insert user record
    const { data: user, error: userError } = await supabase
      .from("vyva_users")
      .insert({
        first_name: firstName,
        last_name: lastName,
        phone: d.phone_number || d.phone || null,
        city: d.city || null,
        street: d.street_address || d.street || null,
        house_number: d.house_number || null,
        post_code: d.postal_code || d.post_code || null,
        country: d.country || "Germany",
        language: d.language || "de",
        timezone: d.timezone || "Europe/Berlin",
        conversation_id: conversationId,
        transcript: transcript,
        call_duration: callDuration,
        call_timestamp: callTimestamp,
      })
      .select("id")
      .single();

    if (userError) throw userError;
    const userId = user.id;

    // Consent
    const consentGiven = d.data_consent_given ?? d.consent_given;
    const caretakerConsent = d.caretaker_consent;
    if (consentGiven !== undefined || caretakerConsent !== undefined) {
      await supabase.from("vyva_user_consent").insert({
        vyva_user_id: userId,
        consent_given: consentGiven === true || consentGiven === "yes" || consentGiven === "Yes",
        caretaker_consent: caretakerConsent === true || caretakerConsent === "yes" || false,
      });
    }

    // Health data
    const healthConditions = d.health_conditions || d.health_concerns;
    const mobilityNeeds = d.mobility_needs || d.mobility_restrictions;
    if (healthConditions || mobilityNeeds) {
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

    // Medications
    let meds: any[] = [];
    if (d.medications && Array.isArray(d.medications)) {
      meds = d.medications.map((m: any) => ({
        vyva_user_id: userId,
        medication_name: m.medication_name || m.name,
        purpose: m.purpose || null,
        dosage: m.dosage || null,
        schedule_times: m.schedule_times || [],
      }));
    } else if (d.takes_medications === true || d.takes_medications === "yes" || d.takes_medications === "Yes") {
      const schedule = d.medication_schedule || null;
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

    // Check-in settings
    if (d.check_in_frequency || d.check_in_time || d.checkins) {
      const ci = typeof d.checkins === "object" ? d.checkins : {};
      await supabase.from("vyva_user_checkins").insert({
        vyva_user_id: userId,
        enabled: ci.enabled ?? true,
        frequency: ci.frequency || d.check_in_frequency || null,
        preferred_time: ci.preferred_time || d.check_in_time || null,
      });
    }

    // Brain coach
    const brainInterest = d.brain_coach_interest ?? d.brain_coach;
    if (brainInterest !== undefined) {
      const enabled = brainInterest === true || brainInterest === "yes" || brainInterest === "Yes";
      const bc = typeof d.brain_coach === "object" ? d.brain_coach : {};
      await supabase.from("vyva_user_brain_coach").insert({
        vyva_user_id: userId,
        enabled,
        frequency: bc.frequency || null,
        preferred_time: bc.preferred_time || null,
      });
    }

    // Caregiver / emergency contact
    const caregiverName = d.caretaker_name || d.emergency_contact_name;
    const caregiverPhone = d.caretaker_phone || d.emergency_contact_phone;
    if (caregiverName || caregiverPhone) {
      await supabase.from("vyva_user_caregivers").insert({
        vyva_user_id: userId,
        caretaker_name: caregiverName || null,
        caretaker_phone: caregiverPhone || null,
      });
    }

    // Medication adherence logs
    if (d.medication_adherence && Array.isArray(d.medication_adherence)) {
      for (const entry of d.medication_adherence) {
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
            call_id: entry.call_id || conversationId || null,
            notes: entry.notes || null,
          }, { onConflict: "medication_id,scheduled_date,scheduled_time" });
        }
      }
    }

    console.log("ElevenLabs webhook processed successfully, user_id:", userId);

    return new Response(JSON.stringify({ success: true, user_id: userId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("ElevenLabs webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
