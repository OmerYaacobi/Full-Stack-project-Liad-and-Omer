"use client";

import { useEffect, useState } from "react";

import {
  createInvitationLink,
  listBusinessInvitations,
} from "@/lib/actions/invitations";

const FIELD =
  "mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-50";

type InviteRow = {
  id: string;
  token: string;
  role: "employee" | "manager";
  email: string | null;
  expires_at: string;
  used_at: string | null;
};

export function InvitePeoplePanel({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const [role, setRole] = useState<"employee" | "manager">("employee");
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [invites, setInvites] = useState<InviteRow[]>([]);

  useEffect(() => {
    void refresh(companyId);
  }, [companyId]);

  async function refresh(id: string) {
    const result = await listBusinessInvitations(id);
    if (result.ok && result.data) {
      setInvites(result.data as InviteRow[]);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    setCopied(false);

    const result = await createInvitationLink({
      companyId,
      role,
      email: email.trim() || undefined,
      expiresInDays,
    });

    setPending(false);

    if (!result.ok || !result.data) {
      setError(result.error || "Could not create the invitation.");
      return;
    }

    setLink(`${window.location.origin}${result.data.inviteUrl}`);
    setEmail("");
    await refresh(companyId);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-900">
        Add an employee or manager
      </h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Create a one-time link. They open it, choose a password, and join{" "}
        {companyName} with the role you pick. You cannot set their password
        here — that stays theirs.
      </p>

      <form onSubmit={onSubmit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium text-slate-700">Role</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <RoleOption
              label="Employee"
              hint="Pay slips, documents, time off"
              selected={role === "employee"}
              onSelect={() => setRole("employee")}
            />
            <RoleOption
              label="Manager"
              hint="Same, plus shared files and team"
              selected={role === "manager"}
              onSelect={() => setRole("manager")}
            />
          </div>
        </fieldset>

        <div>
          <label htmlFor="invite-email" className="block text-sm font-medium text-slate-700">
            Email <span className="text-slate-400">(optional)</span>
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="They must use this address if set"
            disabled={pending}
            className={FIELD}
          />
        </div>

        <div>
          <label htmlFor="invite-expires" className="block text-sm font-medium text-slate-700">
            Link expires
          </label>
          <select
            id="invite-expires"
            value={expiresInDays}
            onChange={(event) => setExpiresInDays(Number(event.target.value))}
            disabled={pending}
            className={FIELD}
          >
            <option value={3}>In 3 days</option>
            <option value={7}>In 7 days</option>
            <option value={14}>In 14 days</option>
            <option value={30}>In 30 days</option>
          </select>
        </div>

        {error && (
          <p role="alert" className="sm:col-span-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="sm:col-span-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {pending ? "Creating link…" : "Create invitation link"}
        </button>
      </form>

      {link && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs font-medium text-emerald-900">
            Send this link. They will pick their own password on the page.
          </p>
          <div className="mt-2 flex gap-2">
            <input
              readOnly
              value={link}
              className="min-w-0 flex-1 rounded-md border border-emerald-200 bg-white px-2 py-1.5 font-mono text-xs text-slate-700"
            />
            <button
              type="button"
              onClick={() => copy(link)}
              className="shrink-0 rounded-md bg-emerald-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-emerald-800"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      {invites.length > 0 && (
        <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100 pt-3">
          {invites.map((invite) => {
            const used = Boolean(invite.used_at);
            const expired = !used && new Date(invite.expires_at) < new Date();
            const url = `/invite/${invite.token}`;

            return (
              <li
                key={invite.id}
                className="flex items-center justify-between gap-3 py-2 text-xs"
              >
                <div className="min-w-0">
                  <span
                    className={
                      invite.role === "manager"
                        ? "font-medium text-amber-800"
                        : "font-medium text-slate-800"
                    }
                  >
                    {invite.role === "manager" ? "Manager" : "Employee"}
                  </span>
                  {invite.email ? (
                    <span className="text-slate-500"> · {invite.email}</span>
                  ) : null}
                </div>
                {used ? (
                  <span className="text-emerald-700">Joined</span>
                ) : expired ? (
                  <span className="text-slate-400">Expired</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => copy(`${window.location.origin}${url}`)}
                    className="text-slate-700 underline-offset-2 hover:underline"
                  >
                    Copy link
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RoleOption({
  label,
  hint,
  selected,
  onSelect,
}: {
  label: string;
  hint: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={
        selected
          ? "rounded-md border border-slate-900 bg-slate-900 px-3 py-2 text-left text-white"
          : "rounded-md border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
      }
    >
      <span className="block text-sm font-medium">{label}</span>
      <span
        className={
          selected ? "mt-0.5 block text-xs text-slate-300" : "mt-0.5 block text-xs text-slate-500"
        }
      >
        {hint}
      </span>
    </button>
  );
}
