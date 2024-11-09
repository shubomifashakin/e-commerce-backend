import { randomBytes, scryptSync } from "crypto";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { PastOrder, Product, User, UserWithPassword } from "./types";

export const defaultTimeOut = 10000;

export class TimeoutError {
  code = 408;
  message = "Request took too long";

  constructor(message = "Request took too long") {
    this.message = message;
  }
}

export class InvalidCredentials {
  code = 401;
  message = "Invalid Log In credentials";

  constructor(message = "Invalid log in credentials") {
    this.message = message;
  }
}

export const signUpDetailsValidator = z.object({
  email: z.string().email(),
  firstName: z.string(),
  lastName: z.string(),
  password: z.string().min(8, "at least 8 characters"),
});

export const logInDetailsValidator = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const orderItemValidator = z.object({
  product_id: z.string(),
  quantity: z.number(),
});

export const orderSchemaValidator = z.array(orderItemValidator);

export function isUser(result: unknown): result is User {
  return (
    typeof result === "object" &&
    result !== null &&
    "id" in result &&
    "email" in result &&
    "first_name" in result &&
    "last_name" in result
  );
}

export function isUserWPassword(result: unknown): result is UserWithPassword {
  return (
    typeof result === "object" &&
    result !== null &&
    "id" in result &&
    "email" in result &&
    "first_name" in result &&
    "last_name" in result &&
    "password" in result
  );
}

// Type guard to check if something is an array of PastOrder
export function isPastOrderArray(value: any): value is PastOrder[] {
  // Check if value is an array
  if (!Array.isArray(value)) {
    return false;
  }

  // Check if each item in the array is a valid PastOrder
  return value.every((item) => isPastOrder(item));
}

// Helper function to check if a single item is a valid PastOrder
function isPastOrder(item: any): item is PastOrder {
  return (
    typeof item === "object" &&
    item !== null &&
    typeof item.quantity === "number" &&
    typeof item.created_at === "object" &&
    isProduct(item.product) // Check if product is a valid Product object
  );
}

// Helper function to check if something is a valid Product
function isProduct(product: any): product is Product {
  return (
    typeof product === "object" &&
    product !== null &&
    typeof product.name === "string" &&
    typeof product.price === "number" &&
    typeof product.image === "string" &&
    typeof product.id === "string" &&
    typeof product.description === "string"
  );
}

const encryptPassword = (password: string, salt: string) => {
  return scryptSync(password, salt, 32).toString("hex");
};

export const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");

  return encryptPassword(password, salt) + salt;
};

export const comparePasswords = (password: string, hash: string): Boolean => {
  // extract salt from the hashed string
  // our hex password length is 32*2 = 64
  const salt = hash.slice(64);
  const originalPassHash = hash.slice(0, 64);
  const currentPassHash = encryptPassword(password, salt);
  return originalPassHash === currentPassHash;
};

export const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 5,
  message: JSON.stringify("Rate Limit Exceeded"),
  standardHeaders: true,
  legacyHeaders: false,
});
