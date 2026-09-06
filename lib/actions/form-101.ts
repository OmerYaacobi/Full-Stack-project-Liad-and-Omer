"use server";

import { createClient } from "@/lib/supabase/server";

export async function companyHasForm101ForYear(
  companyId: string,
  employeeId: string,
  year: number,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("documents")
    .select("id")
    .eq("company_id", companyId)
    .eq("employee_id", employeeId)
    .eq("kind", "form_101")
    .eq("tax_year", year)
    .limit(1);
  return (data?.length ?? 0) > 0;
}
