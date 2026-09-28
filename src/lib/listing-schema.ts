import { z } from "zod";

// One listing engine: shared fields plus category-specific `details`.

const base = z.object({
  localitySlug: z.string().min(1),
  titleEn: z.string().min(5).max(120),
  titleTe: z.string().min(2).max(120),
  price: z.number().int().positive(),
  listerType: z.enum(["OWNER", "BROKER"]),
  allowBrokerContact: z.boolean().default(true),
  photos: z.array(z.string()).max(20).default([]),
});

export const rentalDetails = z.object({
  deposit: z.number().int().nonnegative(),
  furnishing: z.enum(["UNFURNISHED", "SEMI", "FULL"]),
  tenantPreference: z.enum(["Family", "Bachelors", "Students", "Any"]),
  availableFrom: z.iso.date(),
});

export const saleDetails = z.object({
  areaSqft: z.number().int().positive(),
  ageYears: z.number().int().nonnegative(),
  facing: z.enum(["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West"]),
  floor: z.number().int().nonnegative().optional(),
  parking: z.boolean(),
});

export const plotDetails = z.object({
  areaSqyd: z.number().int().positive(),
  surveyNumber: z.string().min(1),
  layoutName: z.string().min(1),
  roadWidthFt: z.number().int().positive(),
  approvalStatus: z.enum(["Approved", "Pending", "Unapproved"]),
});

export const commercialDetails = z.object({
  areaSqft: z.number().int().positive(),
  frontageFt: z.number().int().positive(),
  usageType: z.enum(["Retail", "Office", "Godown", "Clinic", "Other"]),
});

export const listingInput = z.discriminatedUnion("category", [
  base.extend({ category: z.literal("RENTAL"), details: rentalDetails }),
  base.extend({ category: z.literal("SALE"), details: saleDetails }),
  base.extend({ category: z.literal("PLOT"), details: plotDetails }),
  base.extend({ category: z.literal("COMMERCIAL"), details: commercialDetails }),
]);

export type ListingInput = z.infer<typeof listingInput>;
