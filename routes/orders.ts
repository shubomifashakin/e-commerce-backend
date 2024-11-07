import express, { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import {
  defaultTimeOut,
  orderSchemaValidator,
  TimeoutError,
  User,
} from "../lib/helpers";
import { z } from "zod";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

dotenv.config();

export const ordersRouter = express.Router();

ordersRouter.post("/", async (req: Request, res: Response) => {
  //get the data sent
  const body = req.body;

  try {
    //validate the data sent
    const items = orderSchemaValidator.parse(body);

    //get the user id from request
    const user_id: string = req.user_id;

    //insert user id to all items
    const allItemsOrdered = items.map((c) => {
      return { ...c, user_id };
    });

    //insert to database
    const result: User | unknown = await Promise.race([
      prisma.orders.createMany({
        data: allItemsOrdered,
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);
  } catch (error: unknown) {
    console.log(error);
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code.toLowerCase() === "p2002") {
        res.status(400).json("Order already exists");
      }
    }

    if (error instanceof z.ZodError) {
      res.status(400).json(error.issues[0].message);
    }

    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
    }
    res.status(500);
  }
});

ordersRouter.get("/history", async (req: Request, res: Response) => {
  //get the user id from the request
  const user_id: string = req.user_id;

  try {
    //get the orders from database
    const result: User | unknown = await Promise.race([
      prisma.orders.findMany({
        where: {
          user_id,
        },
        select: {
          product: true,
          quantity: true,
        },
        take: 5,
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    //return orders to user
    res.status(200).json(result);
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
    }

    res.status(500);
  }
});

//middleware to run for all routes defined in ordersrouter
ordersRouter.use(function (req: Request, res: Response, next: NextFunction) {
  //get the session-token from the req cookies
  const cookies = req.cookies;

  //if there is no session-token, the user is not authorized
  res.status(401).json("unauthorized");

  //if there is, verify the token, get the userid from the token and add it to the req body

  next();
});
