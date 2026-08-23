export type MatchableEmployee = {
  id: string;
  nationalId: string | null;
  employeeNumber: string;
};

function digits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Match a payslip ת.ז / employee number to someone already on this payroll. */
export function matchEmployeeById<T extends MatchableEmployee>(
  employees: T[],
  extractedId: string | null | undefined,
): T | null {
  const clean = digits(extractedId);
  if (!clean) return null;

  return (
    employees.find((employee) => {
      const nationalId = digits(employee.nationalId);
      const employeeNumber = digits(employee.employeeNumber);
      return (
        (nationalId.length > 0 && nationalId === clean) ||
        (employeeNumber.length > 0 && employeeNumber === clean)
      );
    }) ?? null
  );
}
