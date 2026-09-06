import test from "node:test";
import assert from "node:assert/strict";

import {
  loginSchema,
  bookkeeperSignupSchema,
  forgotPasswordEmailSchema,
  updatePasswordSchema,
} from "@/lib/validations/auth";
import {
  previewTimeOffSchema,
  decideTimeOffSchema,
  rejectTimeOffSchema,
} from "@/lib/validations/time-off";
import {
  uploadPayslipSchema,
  monthLabel,
} from "@/lib/validations/payslips";

test("loginSchema requires valid email", () => {
  const valid = loginSchema.safeParse({ email: "Test@Company.co.il" });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.email, "test@company.co.il");
  }

  const invalid = loginSchema.safeParse({ email: "not-an-email" });
  assert.equal(invalid.success, false);
});

test("bookkeeperSignupSchema checks password match and terms", () => {
  const mismatch = bookkeeperSignupSchema.safeParse({
    fullName: "John Doe",
    email: "john@firm.co.il",
    password: "password123",
    confirmPassword: "password456",
    firmName: "Best Bookkeeping",
    taxId: "512345678",
    terms: true,
  });
  assert.equal(mismatch.success, false);

  const missingTerms = bookkeeperSignupSchema.safeParse({
    fullName: "John Doe",
    email: "john@firm.co.il",
    password: "password123",
    confirmPassword: "password123",
    firmName: "Best Bookkeeping",
    taxId: "512345678",
    terms: false,
  });
  assert.equal(missingTerms.success, false);

  const valid = bookkeeperSignupSchema.safeParse({
    fullName: "John Doe",
    email: "john@firm.co.il",
    password: "password123",
    confirmPassword: "password123",
    firmName: "Best Bookkeeping",
    taxId: "512345678",
    terms: true,
  });
  assert.equal(valid.success, true);
});

test("previewTimeOffSchema rejects end dates before start dates", () => {
  const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  const invalidDates = previewTimeOffSchema.safeParse({
    leaveTypeId: uuid,
    startDate: "2026-05-10",
    endDate: "2026-05-01",
  });
  assert.equal(invalidDates.success, false);

  const validDates = previewTimeOffSchema.safeParse({
    leaveTypeId: uuid,
    startDate: "2026-05-01",
    endDate: "2026-05-10",
  });
  assert.equal(validDates.success, true);
});

test("rejectTimeOffSchema enforces reason on rejection", () => {
  const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  const validDecision = decideTimeOffSchema.safeParse({
    requestId: uuid,
  });
  assert.equal(validDecision.success, true);

  const invalidRejection = rejectTimeOffSchema.safeParse({
    requestId: uuid,
    note: "",
  });
  assert.equal(invalidRejection.success, false);

  const validRejection = rejectTimeOffSchema.safeParse({
    requestId: uuid,
    note: "Team capacity reached for this week",
  });
  assert.equal(validRejection.success, true);
});

test("uploadPayslipSchema enforces netPay <= grossPay and valid dates", () => {
  const uuid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  // Invalid: Net pay (15000) > Gross pay (10000)
  const invalidSalary = uploadPayslipSchema.safeParse({
    companyId: uuid,
    employeeId: uuid,
    year: 2026,
    month: 5,
    grossPay: 10000,
    netPay: 15000,
    totalDeductions: 0,
  });
  assert.equal(invalidSalary.success, false);

  // Valid payslip
  const validSalary = uploadPayslipSchema.safeParse({
    companyId: uuid,
    employeeId: uuid,
    year: 2026,
    month: 5,
    grossPay: 15000,
    netPay: 11000,
    totalDeductions: 4000,
  });
  assert.equal(validSalary.success, true);

  assert.equal(monthLabel(5), "May (5)");
});

test("forgotPasswordEmailSchema validates email format", () => {
  const valid = forgotPasswordEmailSchema.safeParse({ email: "user@example.com" });
  assert.equal(valid.success, true);
  if (valid.success) {
    assert.equal(valid.data.email, "user@example.com");
  }

  const invalid = forgotPasswordEmailSchema.safeParse({ email: "invalid-email" });
  assert.equal(invalid.success, false);
});

test("updatePasswordSchema requires matching passwords of min 6 chars", () => {
  const valid = updatePasswordSchema.safeParse({
    password: "newpassword123",
    confirmPassword: "newpassword123",
  });
  assert.equal(valid.success, true);

  const mismatch = updatePasswordSchema.safeParse({
    password: "newpassword123",
    confirmPassword: "differentpassword",
  });
  assert.equal(mismatch.success, false);

  const tooShort = updatePasswordSchema.safeParse({
    password: "123",
    confirmPassword: "123",
  });
  assert.equal(tooShort.success, false);
});

