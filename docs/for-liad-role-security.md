# Role must not live in user metadata

This note is still the security rule the rest of the app is built on. The old
HTML signup that let a visitor pick Worker / Manager / Accounting is gone.
Employees and managers now join through an invitation token; bookkeepers
register a *firm*, not a client-company role.

## The problem

Anything in `options.data` on `supabase.auth.signUp` goes into
`user_metadata`, and **`user_metadata` is writable by the user themselves**.
Anyone with an account can run:

```js
await supabase.auth.updateUser({ data: { role: "bookkeeper" } });
```

There is no way to stop that — it is a legitimate call on the public anon key.
If any RLS policy or page check read `role` from user metadata, every employee
could promote themselves and read the whole company's salaries. That is the
one failure this product cannot have.

## The rule

**Role has to live in a table we control, and can only be written by someone
who already has authority.** Never in `user_metadata`, never in a JWT claim
the user can influence.

- Client company role: `memberships.role`
- Firm bookkeeper: `firm_memberships` (plus `bookkeeping_firms`)
- RLS helpers such as `app.has_role()` read those tables, using only
  `auth.uid()` from the signed JWT

`handle_new_user` (migration `0012`) creates the membership from
`invitations.role` for the token in metadata. It does **not** copy a
client-chosen `role` field from `raw_user_meta_data`.

## Signup as built

1. **Bookkeeper** — `/signup/bookkeeper` creates a firm (`signup_type =
   bookkeeper` plus tax id). That is a new practice, not a promotion inside
   an existing company.
2. **Employee / manager** — invite-only. The bookkeeper copies an employee
   link or a manager link (`invitations.reusable`), or a one-time personal
   invite. The page at `/invite/[token]` locks the role from the token.

So a stranger cannot create an employee account against a company they were
not invited to, and an employee cannot become a manager by editing their
profile in the browser console.
