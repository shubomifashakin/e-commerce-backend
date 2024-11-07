import express, { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { prisma } from "../lib/prisma";
import {
  comparePasswords,
  defaultTimeOut,
  hashPassword,
  InvalidCredentials,
  isUser,
  isUserWPassword,
  logInDetailsValidator,
  signUpDetailsValidator,
  TimeoutError,
} from "../lib/helpers";

import { z } from "zod";

import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { User, UserWithPassword } from "../lib/types";

dotenv.config();

export const usersRouter = express.Router();

usersRouter.post("/signup", async (req: Request, res: Response) => {
  //get the data sent
  const body = req.body;

  try {
    //validate the data sent
    const { email, password, firstName, lastName } =
      signUpDetailsValidator.parse(body);

    //hash the password
    const hashedPassword = hashPassword(password);

    //insert to database
    const userInfo: User | unknown = await Promise.race([
      prisma.user.create({
        data: {
          email,
          first_name: firstName,
          last_name: lastName,
          password: hashedPassword,
        },
        select: {
          id: true,
          email: true,
          last_name: true,
          first_name: true,
        },
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    if (!isUser(userInfo)) return;

    if (!process.env.SECRET) return;

    //generate jwt
    const token = jwt.sign(userInfo, process.env.SECRET, {
      algorithm: "HS256",
      expiresIn: "24h",
    });

    res
      .cookie("session-cookie", token, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "none",
      })
      .json(userInfo);
  } catch (error: unknown) {
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

    res.status(500).json("dd");
  }
});

usersRouter.post("/login", async (req: Request, res: Response) => {
  //get the data sent
  const body = req.body;

  try {
    //ensures the data sent is of the correct type
    const { email, password } = logInDetailsValidator.parse(body);

    //get from database
    const result: UserWithPassword | unknown = await Promise.race([
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

    if (!isUserWPassword(result)) return;

    const { password: hashedPassword, ...credentials } = result;

    //compare passwords
    if (!comparePasswords(password, hashedPassword)) {
      throw new InvalidCredentials();
    }

    if (!process.env.SECRET) return;

    //generate jwt
    const token = jwt.sign(credentials, process.env.SECRET, {
      algorithm: "HS256",
      expiresIn: "24h",
    });

    res
      .cookie("session-cookie", token, {
        maxAge: 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: false,
        sameSite: "none",
      })
      .json(credentials);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      res.status(400).json(error.issues[0].message);
    }

    if (error instanceof TimeoutError) {
      res.status(error.code).json(error.message);
    }

    if (error instanceof InvalidCredentials) {
      res.status(error.code).json(error.message);
    }

    res.json("internal server error");
  }
});

usersRouter.post("/logout", (_, res: Response) => {
  // Clear the cookie by setting it with an expired date
  res.clearCookie("session-cookie", {
    httpOnly: true,
    secure: false,
    sameSite: "none",
    path: "/",
  });

  res.json({ message: "Logged out successfully" });
});
