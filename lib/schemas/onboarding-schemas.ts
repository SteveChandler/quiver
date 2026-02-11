import { z } from 'zod';

// Step 1: Home Beach
export const homeBeachSchema = z.object({
  homeBeachId: z.string().min(1, 'Please select a beach'),
  homeBeachName: z.string().min(1, 'Please select a beach'),
  homeBeachSlug: z.string().optional(),
  homeBeachCity: z.string().optional(),
  homeBeachState: z.string().optional(),
  homeBeachCountry: z.string().optional(),
});

export type HomeBeachFormData = z.infer<typeof homeBeachSchema>;
