import { z } from "zod";

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "User ID must be at least 3 characters long.")
  .max(24, "User ID must be 24 characters or fewer.")
  .regex(/^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])?$/u, "Use lowercase letters, numbers, dots, and underscores only.");

const profileSocialLinksSchema = z
  .object({
    linkedin: z.string().trim().max(220).optional(),
    github: z.string().trim().max(220).optional(),
    instagram: z.string().trim().max(220).optional(),
    email: z.string().trim().max(220).optional(),
    twitter: z.string().trim().max(220).optional(),
    codeforces: z.string().trim().max(220).optional(),
    leetcode: z.string().trim().max(220).optional()
  })
  .partial()
  .nullable()
  .optional();

export const onboardingProfileSchema = z
  .object({
    username: usernameSchema,
    firstName: z.string().trim().min(2, "First name must be at least 2 characters long."),
    lastName: z
      .union([z.string().trim().min(1, "Last name must be a valid string when provided."), z.literal(""), z.null()])
      .optional(),
    course: z.string().trim().min(2, "Course is required."),
    stream: z.string().trim().min(2, "Stream is required."),
    year: z.coerce.number().int().min(1, "Year must be between 1 and 6.").max(6, "Year must be between 1 and 6."),
    section: z.string().trim().min(1, "Section is required.").max(12, "Section must be shorter than 12 characters."),
    isHosteller: z.boolean(),
    hostelName: z.union([z.string().trim().min(1), z.literal(""), z.null()]).optional(),
    phoneNumber: z
      .union([z.string().trim().regex(/^[+\d][\d\s-]{7,18}$/u, "Phone number format is invalid."), z.literal(""), z.null()])
      .optional(),
    bio: z.union([z.string().trim().max(180, "Bio must be 180 characters or fewer."), z.literal(""), z.null()]).optional(),
    socialLinks: profileSocialLinksSchema,
    avatarUrl: z.union([z.string().trim().min(1).max(2_500_000), z.literal(""), z.null()]).optional()
  })
  .superRefine((payload, ctx) => {
    if (payload.isHosteller && !payload.hostelName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["hostelName"],
        message: "Hostel name is required for hostellers."
      });
    }
  });

export type OnboardingProfileInput = z.infer<typeof onboardingProfileSchema>;
