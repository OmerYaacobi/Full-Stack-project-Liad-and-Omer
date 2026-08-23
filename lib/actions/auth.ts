"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { fail, fromZod, type ActionResult } from "@/lib/actions/result";
import { roleHome } from "@/lib/auth/context";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, passwordLoginSchema } from "@/lib/validations/auth";
import type { AppRole } from "@/types/app";

/**
 * The sign-in form offers two ways in, chosen by which submit button was used.
 * Both live in one action so the form keeps a single `useActionState` and one
 * place to render errors.
 */
export async function signIn(
  previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  if (formData.get("intent") === "password") {
    return signInWithPassword(formData);
  }
  return sendMagicLink(previous, formData);
}

async function signInWithPassword(
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = passwordLoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return fromZod(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    if (error.status === 429) {
      return fail("RATE_LIMITED", "Too many attempts. Wait a minute and try again.");
    }
    // Supabase returns the same "invalid credentials" for a wrong password and
    // an address that was never registered, which is what we want to surface.
    return fail("UNAUTHENTICATED", "That email and password do not match an account.");
  }

  const destination =
    sanitiseNext(formData.get("next")) ??
    (await landingFor(supabase, data.user.id));
  redirect(destination);
}

/**
 * Bookkeepers hold a firm membership rather than a company one, so they have no
 * role home in the app shell and belong on the firm dashboard instead.
 */
async function landingFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from("memberships")
    .select("role")
    .eq("profile_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.role ? roleHome(data.role as AppRole) : "/dashboard";
}

async function sendMagicLink(
  _previous: ActionResult<void> | null,
  formData: FormData,
): Promise<ActionResult<void>> {
  const parsed = loginSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZod(parsed.error);

  const { email } = parsed.data;
  const next = sanitiseNext(formData.get("next"));
  const callback = new URL("/auth/callback", await siteOrigin());
  if (next) callback.searchParams.set("next", next);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      // Accounts are created by the bookkeeper's invite, never by signing in.
      // See docs/for-liad-role-security.md.
      shouldCreateUser: false,
    },
  });

  if (error && !isUnknownEmail(error.message)) {
    if (error.status === 429) {
      return fail(
        "RATE_LIMITED",
        "Too many sign-in emails. Wait a minute and try again.",
      );
    }
    return fail("INTERNAL", "Could not send the sign-in link. Please try again.");
  }

  // An unknown address reaches this line too. Telling the visitor that no such
  // account exists would let anyone test which employees use the portal.
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

/**
 * Supabase reports a blocked signup as an error even though, from the visitor's
 * side, it is indistinguishable from a link that was sent.
 */
function isUnknownEmail(message: string): boolean {
  return /signups? not allowed/i.test(message);
}

/**
 * Only same-site paths may be used as a post-login destination, so a crafted
 * link cannot bounce a freshly authenticated user to another origin.
 */
function sanitiseNext(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

async function siteOrigin(): Promise<string> {
  const headerList = await headers();
  const origin = headerList.get("origin");
  if (origin) return origin;

  const host = headerList.get("host") ?? "localhost:3000";
  const protocol = headerList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}
