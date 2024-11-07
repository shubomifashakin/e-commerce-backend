import express, { NextFunction, Request, Response } from "express";
import jwt, { JsonWebTokenError } from "jsonwebtoken";
import { z } from "zod";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import dotenv from "dotenv";

import { prisma } from "../lib/prisma";
import {
  defaultTimeOut,
  orderSchemaValidator,
  TimeoutError,
} from "../lib/helpers";
import { User } from "../lib/types";

dotenv.config();

export const ordersRouter = express.Router();

//middleware
ordersRouter.use(function (req: Request, res: Response, next: NextFunction) {
  console.log("ran middle order");

  //get the session-token from the req cookies
  const token = req.cookies["session-cookie"];
  // console.log(req.signedCookies);

  //if there is no session token, redirect the user to the login page
  if (!token) {
    res.redirect("http://localhost:5173/login");
  }

  if (!process.env.ACCESS_TOKEN_SECRET) {
    return;
  }

  // If there is a token, verify it
  try {
    const user = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET) as User;

    //add the user id to the req
    req.user_id = user.id;

    next();
  } catch (error) {
    //if the token is invalid, redirect to login
    res.redirect("http://localhost:5173/login");
  }
});

ordersRouter.post("/", async (req: Request, res: Response) => {
  //get the user id from request
  const user_id = req.user_id;

  if (!user_id) {
    console.log(user_id);
    res.redirect("http://localhost:5173/login");
    return;
  }

  //get the data sent
  const body = req.body;

  try {
    //validate the data sent
    const items = orderSchemaValidator.parse(body);

    //insert user id to all items
    const allItemsOrdered = items.map((c) => {
      return { ...c, user_id };
    });

    //insert to database
    await Promise.race([
      prisma.orders.createMany({
        data: allItemsOrdered,
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    res.redirect("http://localhost:5173/catalog");
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

// ordersRouter.get("/history", async (req: Request, res: Response) => {
//   //get the user id from the request
//   const user_id: string = req.user_id;

//   try {
//     //get the orders from database
//     const result: User | unknown = await Promise.race([
//       prisma.orders.findMany({
//         where: {
//           user_id,
//         },
//         select: {
//           product: true,
//           quantity: true,
//         },
//         take: 5,
//       }),
//       new Promise((_, rej) => {
//         setTimeout(() => {
//           rej(new TimeoutError());
//         }, defaultTimeOut);
//       }),
//     ]);

//     //return orders to user
//     res.status(200).json(result);
//   } catch (error: unknown) {
//     if (error instanceof TimeoutError) {
//       res.status(error.code).json(error.message);
//     }

//     res.status(500);
//   }
// });

//middleware to run for all routes defined in ordersrouter
