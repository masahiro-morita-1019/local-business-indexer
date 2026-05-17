import { z } from 'zod';

export const placeSchema = z.object({
  id: z.string(),
  displayName: z
    .object({
      text: z.string(),
      languageCode: z.string().optional(),
    })
    .optional(),
  formattedAddress: z.string().optional(),
  nationalPhoneNumber: z.string().optional(),
  internationalPhoneNumber: z.string().optional(),
  websiteUri: z.string().optional(),
  rating: z.number().optional(),
  userRatingCount: z.number().optional(),
  googleMapsUri: z.string().optional(),
  types: z.array(z.string()).optional(),
  primaryType: z.string().optional(),
  regularOpeningHours: z
    .object({
      weekdayDescriptions: z.array(z.string()).optional(),
    })
    .optional(),
});

export type Place = z.infer<typeof placeSchema>;

export const searchTextResponseSchema = z.object({
  places: z.array(placeSchema).optional(),
  nextPageToken: z.string().optional(),
});

export type SearchTextResponse = z.infer<typeof searchTextResponseSchema>;
