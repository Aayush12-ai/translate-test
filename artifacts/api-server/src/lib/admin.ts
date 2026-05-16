import { User } from "../db/models/user";

const SYSTEM_ADMIN_EMAIL = "admin@system.local";

export function getConfiguredAdminUserEmail(): string | null {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return configuredEmail || null;
}

export function getConfiguredAdminNotificationEmail(): string | null {
  const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (configuredEmail) {
    return configuredEmail;
  }

  const smtpUser = process.env.SMTP_USER?.trim().toLowerCase();
  return smtpUser || null;
}

export function getAdminUserRecordEmail(): string {
  return getConfiguredAdminUserEmail() || SYSTEM_ADMIN_EMAIL;
}

export function isSystemAdminEmail(email?: string | null): boolean {
  return !email || email.trim().toLowerCase() === SYSTEM_ADMIN_EMAIL;
}

export async function resolveAdminNotificationEmail(): Promise<string | null> {
  const configuredEmail = getConfiguredAdminNotificationEmail();
  if (configuredEmail) {
    return configuredEmail;
  }

  const admin = await User.findOne({ isAdmin: true });
  if (admin?.email && !isSystemAdminEmail(admin.email)) {
    return admin.email;
  }

  return null;
}
