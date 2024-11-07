import { PrismaClient } from "@prisma/client";
import { defaultTimeOut } from "./helpers";

export const prisma = new PrismaClient({
  transactionOptions: { timeout: defaultTimeOut },
});
