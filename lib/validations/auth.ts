import { z } from "zod";

// 0. Passwordless Sign-In Schema
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Accounts created through the bookkeeper signup and the invite flow both set a
// password, so the sign-in page has to accept one as well as a magic link.
export const passwordLoginSchema = loginSchema.extend({
  password: z.string().min(1, "Enter your password."),
});

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;

// 1. Bookkeeping Firm Registration Schema
export const bookkeeperSignupSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, { message: "Full name must be at least 2 characters" })
      .max(120, { message: "Full name is too long" }),
    email: z
      .string()
      .trim()
      .email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .min(6, { message: "Confirm password must be at least 6 characters" }),
    phone: z
      .string()
      .trim()
      .regex(/^$|^\+?[0-9\-\s]{7,20}$/, { message: "Invalid phone number" })
      .optional()
      .or(z.literal("")),
    firmName: z
      .string()
      .trim()
      .min(2, { message: "Bookkeeping firm name must be at least 2 characters" }),
    taxId: z
      .string()
      .trim()
      .min(5, { message: "Firm Tax ID / Registration number must be at least 5 characters" })
      .max(20, { message: "Tax ID is too long" }),
    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the Terms of Service and Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type BookkeeperSignupInput = z.infer<typeof bookkeeperSignupSchema>;

// 2. Invite Acceptance Signup Schema (For Employee or Manager joining a specific business)
export const inviteSignupSchema = z
  .object({
    token: z.string().min(1, { message: "Missing invitation token" }),
    fullName: z
      .string()
      .trim()
      .min(2, { message: "Full name must be at least 2 characters" })
      .max(120, { message: "Full name is too long" }),
    email: z
      .string()
      .trim()
      .email({ message: "Invalid email address" }),
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .min(6, { message: "Confirm password must be at least 6 characters" }),
    nationalId: z
      .string()
      .trim()
      .min(7, { message: "ID number must be at least 7 digits" })
      .max(12, { message: "ID number is too long" })
      .regex(/^\d{7,9}$/, { message: "Enter a valid 7 to 9 digit ID number (ת.ז)" }),
    phone: z
      .string()
      .trim()
      .regex(/^$|^\+?[0-9\-\s]{7,20}$/, { message: "Invalid phone number" })
      .optional()
      .or(z.literal("")),
    jobTitle: z.string().trim().max(80).optional().or(z.literal("")),
    department: z.string().trim().max(80).optional().or(z.literal("")),
    role: z.enum(["employee", "manager"], {
      message: "Choose employee or manager",
    }),
    terms: z.boolean().refine((val) => val === true, {
      message: "You must accept the Terms of Service and Privacy Policy",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type InviteSignupInput = z.infer<typeof inviteSignupSchema>;

// 3. Create Client Business Schema (Under Bookkeeping Firm)
export const createBusinessSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Business name must be at least 2 characters" }),
  taxId: z
    .string()
    .trim()
    .min(5, { message: "Business Tax ID must be at least 5 characters" })
    .max(20, { message: "Tax ID is too long" }),
  timezone: z.string().default("Asia/Jerusalem"),
  currency: z.string().length(3).default("ILS"),
  managersCanViewPayslipFiles: z.boolean().default(false),
});

export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

// 4. Create Role-Based Invitation Link Schema
export const createInvitationSchema = z.object({
  companyId: z.string().uuid({ message: "Invalid business ID" }),
  role: z.enum(["employee", "manager"], {
    message: "Role must be employee or manager",
  }),
  email: z.string().trim().email({ message: "Invalid email" }).optional().or(z.literal("")),
  expiresInDays: z.number().min(1).max(30).default(7),
  managerId: z
    .union([z.string().uuid(), z.literal("")])
    .optional(),
});

export type CreateInvitationInput = z.input<typeof createInvitationSchema>;

// 5. Password Reset Request - Email Schema
export const forgotPasswordEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});

export type ForgotPasswordEmailInput = z.infer<typeof forgotPasswordEmailSchema>;

// 6. Update Password Schema
export const updatePasswordSchema = z
  .object({
    password: z
      .string()
      .min(6, { message: "Password must be at least 6 characters" }),
    confirmPassword: z
      .string()
      .min(6, { message: "Confirm password must be at least 6 characters" }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type UpdatePasswordInput = z.infer<typeof updatePasswordSchema>;

