import { z } from "zod";

export const uploadOwnForm101Schema = z.object({
  taxYear: z.coerce.number().int().min(2000).max(2100),
});
