const PROJECT_OWNER_PLATFORM_ADMIN_EMAILS = ["karim.assad@mokadigital.net"];

export function isProjectPlatformAdminEmail(email?: string | null) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  return Boolean(normalizedEmail && PROJECT_OWNER_PLATFORM_ADMIN_EMAILS.includes(normalizedEmail));
}
