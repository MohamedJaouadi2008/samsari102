import { z } from "zod";

// Authentication schemas
export const signInSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z.string().min(1, "Password is required")
});

export const signUpSchema = z.object({
  email: z.string().trim().email("Invalid email address").max(255, "Email too long"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long")
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password too long")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain uppercase, lowercase, and number"),
  confirmPassword: z.string().min(1, "Please confirm your password")
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"]
});

// Booking schemas
export const bookingSchema = z.object({
  phoneNumber: z
    .string()
    .regex(/^\+216 \d{8}$/, "Phone must be in format +216 XXXXXXXX"),
  guestMessage: z.string().max(1000, "Message too long (max 1000 characters)").optional()
});

// Messaging schema
export const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message too long (max 2000 characters)")
});

// Review schema
export const reviewSchema = z.object({
  rating: z.number().int().min(1, "Rating required").max(5, "Rating must be 5 or less"),
  comment: z.string().trim().max(2000, "Comment too long (max 2000 characters)").optional()
});

// Property schemas
export const propertyBasicsSchema = z.object({
  title: z.string().trim().min(10, "Title must be at least 10 characters").max(200, "Title too long"),
  description: z.string().trim().max(2000, "Description too long").optional(),
  property_type: z.string().min(1, "Property type is required"),
  governorate: z.string().min(1, "Governorate is required"),
  city: z.string().min(1, "City is required"),
  address: z.string().trim().max(500, "Address too long").optional(),
  house_rules: z.string().trim().max(1000, "House rules too long").optional(),
  price_per_night: z.number().positive("Price must be positive").max(100000, "Price too high"),
  minimum_stay: z.number().int().min(1, "Minimum stay must be at least 1 night").max(365, "Minimum stay too long").optional()
});

export const propertyDetailsSchema = z.object({
  bedrooms: z.number().int().min(1, "At least 1 bedroom required").max(50, "Too many bedrooms"),
  bathrooms: z.number().int().min(1, "At least 1 bathroom required").max(20, "Too many bathrooms"),
  max_guests: z.number().int().min(1, "At least 1 guest required").max(100, "Too many guests"),
  extra_beds: z.number().int().min(0, "Cannot be negative").max(20, "Too many extra beds").optional()
});

// Profile schema
export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long").optional(),
  username: z.string().trim().min(3, "Username must be at least 3 characters").max(30, "Username too long").regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, _ and -").optional(),
  phone: z.string().regex(/^\+216 \d{8}$/, "Phone must be in format +216 XXXXXXXX").optional(),
  bio: z.string().trim().max(500, "Bio too long").optional()
});
