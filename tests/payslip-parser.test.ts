import test from "node:test";
import assert from "node:assert/strict";

import { matchEmployeeById } from "@/lib/payslip/match-employee";

test("matchEmployeeById matches by Israeli nationalId", () => {
  const employees = [
    { id: "emp-1", nationalId: "201234567", employeeNumber: "101" },
    { id: "emp-2", nationalId: "309876543", employeeNumber: "102" },
  ];

  const matched = matchEmployeeById(employees, "201234567");
  assert.equal(matched?.id, "emp-1");
});

test("matchEmployeeById matches by employeeNumber", () => {
  const employees = [
    { id: "emp-1", nationalId: "201234567", employeeNumber: "101" },
    { id: "emp-2", nationalId: "309876543", employeeNumber: "102" },
  ];

  const matched = matchEmployeeById(employees, "102");
  assert.equal(matched?.id, "emp-2");
});

test("matchEmployeeById ignores formatting characters (dashes, spaces)", () => {
  const employees = [
    { id: "emp-1", nationalId: "201-234-567", employeeNumber: "101" },
  ];

  const matched = matchEmployeeById(employees, "201 234 567");
  assert.equal(matched?.id, "emp-1");
});

test("matchEmployeeById returns null when not found", () => {
  const employees = [
    { id: "emp-1", nationalId: "201234567", employeeNumber: "101" },
  ];

  const matched = matchEmployeeById(employees, "999999999");
  assert.equal(matched, null);
});

