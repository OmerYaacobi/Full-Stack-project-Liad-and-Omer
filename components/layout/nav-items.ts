import type { AppRole } from "@/types/app";

export type NavItem = {
  href: string;
  label: string;
  /** Not built yet: rendered as a muted, non-interactive row instead of a dead link. */
  soon?: boolean;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/**
 * Every role is also a person with their own pay slips and leave, which the
 * permission matrix in 00-overview.md grants to all three. So the navigation is
 * a personal group everyone sees plus at most one role group, rather than three
 * mutually exclusive menus.
 */
const PERSONAL: NavGroup = {
  title: "My workspace",
  items: [
    { href: "/employee", label: "Dashboard" },
    { href: "/employee/payslips", label: "Pay slips" },
    { href: "/employee/documents", label: "Documents" },
    { href: "/employee/time-off", label: "Time off" },
  ],
};

const MANAGER: NavGroup = {
  title: "My team",
  items: [
    { href: "/manager", label: "Team overview" },
    { href: "/manager/approvals", label: "Approvals" },
    { href: "/manager/team", label: "Team" },
    { href: "/manager/shared", label: "Shared files" },
    { href: "/manager/calendar", label: "Calendar", soon: true },
  ],
};

const BOOKKEEPER: NavGroup = {
  title: "Bookkeeping",
  items: [
    { href: "/bookkeeper", label: "What needs attention" },
    { href: "/bookkeeper/approvals", label: "Approvals" },
    { href: "/bookkeeper/businesses", label: "Businesses" },
    { href: "/bookkeeper/periods", label: "Payroll periods", soon: true },
    { href: "/bookkeeper/employees", label: "Employees", soon: true },
    { href: "/bookkeeper/documents", label: "Documents", soon: true },
  ],
};

export function navGroupsFor(role: AppRole): NavGroup[] {
  switch (role) {
    case "employee":
      return [PERSONAL];
    case "manager":
      return [PERSONAL, MANAGER];
    case "bookkeeper":
      // A firm bookkeeper is not on a client payroll, so the personal group
      // would be a second copy of empty employee pages. Their documents live
      // under each business, filed per employee.
      return [BOOKKEEPER];
  }
}
