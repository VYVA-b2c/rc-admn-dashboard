import { describe, expect, it } from "vitest";

import { buildUserIntakePayload } from "@/lib/userIntake";

describe("buildUserIntakePayload", () => {
  it("preserves medication reminder enabled state", () => {
    const payload = buildUserIntakePayload({
      identity: {
        city: "",
        date_of_birth: "",
        emergency_notes: "",
        first_name: "Karim",
        gender: "",
        house_number: "",
        language: "en",
        last_name: "Assad",
        phone: "",
        post_code: "",
        street: "",
      },
      medications: [
        {
          dosage: "10mg",
          medication_name: "Lisinopril",
          purpose: "Blood pressure",
          reminders_enabled: false,
          schedule_times: "08:00, 20:00",
        },
      ],
    });

    expect(payload.medications).toEqual([
      {
        dosage: "10mg",
        medication_name: "Lisinopril",
        purpose: "Blood pressure",
        reminders_enabled: false,
        schedule_times: ["08:00", "20:00"],
      },
    ]);
  });

  it("drops empty medication rows even if reminder toggle changed", () => {
    const payload = buildUserIntakePayload({
      identity: {
        city: "",
        date_of_birth: "",
        emergency_notes: "",
        first_name: "Karim",
        gender: "",
        house_number: "",
        language: "en",
        last_name: "Assad",
        phone: "",
        post_code: "",
        street: "",
      },
      medications: [
        {
          dosage: "",
          medication_name: "",
          purpose: "",
          reminders_enabled: false,
          schedule_times: "",
        },
      ],
    });

    expect(payload.medications).toBeUndefined();
  });
});
