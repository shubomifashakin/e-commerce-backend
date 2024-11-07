import { randomBytes, scryptSync } from "crypto";
import { z } from "zod";

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
  message = "Invalid log in credentials";

  constructor(message = "Invalid log in credentials") {
    this.message = message;
  }
}

export type User = {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  id: string;
};

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

import rateLimit from "express-rate-limit";

// Create a rate limiter that allows 100 requests per IP every 15 minutes
const rateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});

export default rateLimiter;
