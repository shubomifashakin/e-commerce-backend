import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import rateLimiter, {
  comparePasswords,
  defaultTimeOut,
  hashPassword,
  InvalidCredentials,
  isUser,
  logInDetailsValidator,
  signUpDetailsValidator,
  TimeoutError,
  User,
} from "../lib/helpers";

import { z } from "zod";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";

dotenv.config();

export const usersRouter = express.Router();

usersRouter.post(
  "/signup",
  rateLimiter,
  async (req: Request, res: Response) => {
    //get the data sent
    const body = req.body;

    try {
      //validate the data sent
      const { email, password, firstName, lastName } =
        signUpDetailsValidator.parse(body);

      //hash the password
      const hashedPassword = hashPassword(password);

      console.log("passed hash");

      //insert to database
      const result: User | unknown = await Promise.race([
        prisma.user.create({
          data: {
            email,
            first_name: firstName,
            last_name: lastName,
            password: hashedPassword,
          },
          select: {
            email: true,
            first_name: true,
            id: true,
            last_name: true,
          },
        }),
        new Promise((_, rej) => {
          setTimeout(() => {
            rej(new TimeoutError());
          }, defaultTimeOut);
        }),
      ]);

      if (!isUser(result)) return;

      console.log("passed resukt");

      if (!process.env.SECRET) return;

      //generate jwt
      const token = jwt.sign(result, process.env.SECRET, {
        algorithm: "HS256",
        expiresIn: "24h",
      });

      console.log("passed jwt");

      res
        .cookie("token", token, {
          // can only be accessed by server requests
          httpOnly: true,
          // path = where the cookie is valid
          path: "/",
          // secure = only send cookie over https
          secure: true,
          // sameSite = only send cookie if the request is coming from the same origin
          sameSite: "none", // "strict" | "lax" | "none" (secure must be true)
          // maxAge = how long the cookie is valid for in milliseconds
          maxAge: 3600000, // 1 hour
        })
        .json("success");
    } catch (error: unknown) {
      console.log(error);
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code.toLowerCase() === "p2002") {
          res.status(400).json("Email already exists");
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
  }
).get;

usersRouter.post("/login", rateLimiter, async (req: Request, res: Response) => {
  //get the data sent
  const body = req.body;

  try {
    //ensures the data sent is of the correct type
    const { email, password } = logInDetailsValidator.parse(body);

    //get from database
    const result: User | unknown = await Promise.race([
      prisma.user.findUnique({
        where: {
          email,
        },
        select: {
          email: true,
          first_name: true,
          id: true,
          last_name: true,
          password: true,
        },
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    console.log(result);

    if (!isUser(result)) return;

    const { password: hashedPassword, ...credentials } = result;

    //compare passwords
    if (!comparePasswords(password, result.password)) {
      throw new InvalidCredentials();
    }

    console.log("compared");

    if (!process.env.SECRET) return;

    //generate jwt
    const token = jwt.sign(credentials, process.env.SECRET, {
      algorithm: "HS256",
      expiresIn: "24h",
    });

    console.log(token);

    res
      .cookie("token", token, {
        // can only be accessed by server requests
        httpOnly: true,
        // path = where the cookie is valid
        path: "/",
        // secure = only send cookie over https
        secure: true,
        // sameSite = only send cookie if the request is coming from the same origin
        sameSite: "none", // "strict" | "lax" | "none" (secure must be true)
        // maxAge = how long the cookie is valid for in milliseconds
        maxAge: 3600000, // 1 hour
      })
      .json("successs");
  } catch (error: unknown) {
    console.log(error);

    if (error instanceof z.ZodError) {
      res.status(400).json(error.issues[0].message);
    }

    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
    }

    if (error instanceof InvalidCredentials) {
      res.status(error.code).json(error.message);
    }

    res.status(500).json("internal server error");
  }
});
