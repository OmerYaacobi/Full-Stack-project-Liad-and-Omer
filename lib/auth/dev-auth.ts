import type { ActiveMembership, AppRole, AuthContext, Profile } from "@/types/app";

const ROLES: AppRole[] = ["employee", "manager", "bookkeeper"];

const LABELS: Record<AppRole, string> = {
  employee: "Dev Employee",
  manager: "Dev Manager",
  bookkeeper: "Dev Bookkeeper",
};

// Fixed so a page that stores something against the id during a dev session
// still finds it after a reload.
const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_COMPANY_ID = "00000000-0000-4000-8000-0000000000c0";
const DEV_FIRM_ID = "00000000-0000-4000-8000-0000000000f0";

let warned = false;

/**
 * The role to impersonate while developing, or null for normal authentication.
 *
 * Reads DEV_AUTH_ROLE, which is deliberately not NEXT_PUBLIC_ so it cannot be
 * inlined into the browser bundle, and is ignored outright in a production
 * build. Both conditions have to fail open to real auth: this switch hands out
 * a bookkeeper session to anyone who asks.
 */
export function devAuthRole(): AppRole | null {
  if (process.env.NODE_ENV === "production") return null;

  const value = process.env.DEV_AUTH_ROLE?.trim().toLowerCase();
  if (!value) return null;

  if (!ROLES.includes(value as AppRole)) {
    if (!warned) {
      warned = true;
      console.warn(
        `DEV_AUTH_ROLE="${value}" is not one of ${ROLES.join(", ")}. Ignoring it.`,
      );
    }
    return null;
  }

  return value as AppRole;
}

/**
 * A stand-in for what `getContext` would have loaded from Supabase, so every
 * layout and page below it works unchanged.
 */
export function devContext(role: AppRole): AuthContext {
  const email = `dev+${role}@example.test`;

  const profile: Profile = {
    id: DEV_USER_ID,
    fullName: LABELS[role],
    email,
    locale: "en",
  };

  const membership: ActiveMembership = {
    id: `${DEV_COMPANY_ID}-${role}`,
    role,
    company: { id: DEV_COMPANY_ID, name: "Dev Client Business" },
  };

  return {
    userId: DEV_USER_ID,
    email,
    profile,
    memberships: [membership],
    membership,
    firm: role === "bookkeeper" ? { id: DEV_FIRM_ID, name: "Dev Firm" } : null,
  };
}
