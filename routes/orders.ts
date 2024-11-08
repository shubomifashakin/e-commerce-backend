import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import dotenv from "dotenv";

import { prisma } from "../lib/prisma";
import {
  defaultTimeOut,
  isPastOrderArray,
  orderSchemaValidator,
  TimeoutError,
} from "../lib/helpers";
import { PastOrder, User } from "../lib/types";

dotenv.config();

export const ordersRouter = express.Router();

//middleware to run anytime the user tries to order something
//it basically verifies the user is actually logged in (if a jwt exists in cookie)
ordersRouter.use(function (req: Request, res: Response, next: NextFunction) {
  //get the session-token from the req cookies
  const token = req.cookies["session-cookie"];

  //if there is no session token, redirect the user to the login page
  if (!token) {
    res.redirect("http://localhost:5173/login");

    return;
  }

  if (!process.env.JWT_SECRET) {
    return;
  }

  // If there is a token, verify it
  try {
    const user = jwt.verify(token, process.env.JWT_SECRET) as User;

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

    res.status(200).json("success");
    return;
  } catch (error: unknown) {
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code.toLowerCase() === "p2002") {
        res.status(400).json("Order already exists");
        return;
      }
    }

    if (error instanceof z.ZodError) {
      res.status(400).json(error.issues[0].message);
      return;
    }

    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
      return;
    }

    res.status(500).json("Internal Server Error");
  }
});

ordersRouter.get("/history", async (req: Request, res: Response) => {
  //get the user id from the request
  const user_id = req.user_id;

  //get the cursor and the name from searchparams if avaialable
  const skip = Number(req.query.skip) || 0;
  const name = req.query.name;

  const startFrom = skip * 5;
  const currPageIndex = startFrom / 5;

  if (!user_id) {
    res.redirect("http://localhost:5173/login");
    return;
  }

  try {
    //get all the orders with that user id from the database
    const result: PastOrder[] | unknown = await Promise.race([
      prisma.orders.findMany({
        where: {
          user_id,
        },
        select: {
          product: true,
          quantity: true,
          created_at: true,
        },
        skip: startFrom,
        take: 6,
        orderBy: { created_at: "desc" },
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    if (!isPastOrderArray(result)) {
      throw new TimeoutError();
    }

    //if length returned is greater than our take, then we have a next page
    if (result.length > 5 && currPageIndex <= 0) {
      res.json({
        previousOrders: result.slice(0, result.length - 1),
        paginationDetails: {
          hasNextPage: true,
          nextPage: currPageIndex + 1,
        },
      });
    }

    //if lenght returned is greater than 5 and currpageIndex is greater than 1, we have next and previous
    if (result.length > 5 && currPageIndex > 0) {
      res.json({
        previousOrders: result.slice(0, result.length - 1),
        paginationDetails: {
          hasNextPage: true,
          hasPreviousPage: true,
          nextPage: currPageIndex + 1,
          previousPage: currPageIndex - 1,
        },
      });
    }

    //if length returned is not greater than 5, no next page
    if (result.length <= 5 && currPageIndex <= 0) {
      res.json({
        previousOrders: result,
        paginationDetails: {
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    //if length returned is not greater than 5,but currpageIndex greater than 1, we have no next but we have a previous
    if (result.length <= 5 && currPageIndex > 0) {
      res.json({
        previousOrders: result,
        paginationDetails: {
          hasNextPage: false,
          hasPreviousPage: true,
          previousPage: currPageIndex - 1,
        },
      });
    }
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
      return;
    }

    res.status(500).json("internal server error");
    return;
  }
});
