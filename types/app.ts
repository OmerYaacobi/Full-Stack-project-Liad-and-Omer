export type AppRole = "employee" | "manager" | "bookkeeper";

export type Profile = {
  id: string;
  fullName: string;
  email: string;
  locale: string;
};

export type Company = {
  id: string;
  name: string;
};

/** A bookkeeping practice, which manages many client companies. */
export type Firm = {
  id: string;
  name: string;
};

export type ActiveMembership = {
  id: string;
  role: AppRole;
  company: Company;
};

export type AuthContext = {
  userId: string;
  email: string;
  profile: Profile | null;
  memberships: ActiveMembership[];
  membership: ActiveMembership | null;
  /** Set when the user belongs to a bookkeeping firm. */
  firm: Firm | null;
};

/**
 * What the shell needs to render a header and a menu, resolved from either a
 * company membership or a firm membership. Bookkeepers reach the app through a
 * firm and hold no `memberships` row, so the two have to be treated alike here.
 */
export type Workspace = {
  role: AppRole;
  /** Company name, or firm name for a bookkeeper working across clients. */
  name: string;
  /** Null when the workspace is a whole firm rather than one client company. */
  companyId: string | null;
};
