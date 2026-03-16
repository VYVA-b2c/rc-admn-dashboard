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

    // Insert main user record
    const { data: user, error: userError } = await supabase
      .from("vyva_users")
      .insert({
        first_name: payload.first_name,
        last_name: payload.last_name,
        phone: payload.phone || null,
        city: payload.city || null,
        street: payload.street || null,
        house_number: payload.house_number || null,
        post_code: payload.post_code || null,
        timezone: payload.timezone || "Europe/Amsterdam",
      })
      .select("id")
      .single();

    if (userError) throw userError;
    const userId = user.id;

    // Insert consent
    if (payload.consent_given !== undefined || payload.caretaker_consent !== undefined) {
      await supabase.from("vyva_user_consent").insert({
        vyva_user_id: userId,
        consent_given: payload.consent_given ?? false,
        caretaker_consent: payload.caretaker_consent ?? false,
      });
    }

    // Insert health data
    if (payload.health_conditions || payload.mobility_needs) {
      await supabase.from("vyva_user_health").insert({
        vyva_user_id: userId,
        health_conditions: payload.health_conditions || [],
        mobility_needs: payload.mobility_needs || [],
      });
    }

    // Insert medications
    if (payload.medications && Array.isArray(payload.medications)) {
      const meds = payload.medications.map((m: any) => ({
        vyva_user_id: userId,
        medication_name: m.medication_name || m.name,
        purpose: m.purpose || null,
        dosage: m.dosage || null,
        schedule_times: m.schedule_times || [],
      }));
      if (meds.length > 0) {
        await supabase.from("vyva_user_medications").insert(meds);
      }
    }

    // Insert check-in settings
    if (payload.checkins !== undefined) {
      const ci = typeof payload.checkins === "object" ? payload.checkins : { enabled: !!payload.checkins };
      await supabase.from("vyva_user_checkins").insert({
        vyva_user_id: userId,
        enabled: ci.enabled ?? false,
        frequency: ci.frequency || null,
        preferred_time: ci.preferred_time || null,
      });
    }

    // Insert brain coach settings
    if (payload.brain_coach !== undefined) {
      const bc = typeof payload.brain_coach === "object" ? payload.brain_coach : { enabled: !!payload.brain_coach };
      await supabase.from("vyva_user_brain_coach").insert({
        vyva_user_id: userId,
        enabled: bc.enabled ?? false,
        frequency: bc.frequency || null,
        preferred_time: bc.preferred_time || null,
      });
    }

    // Insert caregiver
    if (payload.caretaker_name || payload.caretaker_phone) {
      await supabase.from("vyva_user_caregivers").insert({
        vyva_user_id: userId,
        caretaker_name: payload.caretaker_name || null,
        caretaker_phone: payload.caretaker_phone || null,
      });
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
