import express, { Request, Response } from "express";

import { prisma } from "../lib/prisma";

import { defaultTimeOut, TimeoutError } from "../lib/helpers";

export const productsRouter = express.Router();

//gets all products
productsRouter.get("/", async (req: Request, res: Response) => {
  //get the cursor and the name from searchparams if avaialable
  const skip = Number(req.query.skip) || 0;
  const name = req.query.name;

  const startFrom = skip * 5;
  const currPageIndex = startFrom / 5;

  try {
    //race condition
    let result;

    //if there is no name, find based on cursor only
    if (!name) {
      result = await Promise.race([
        prisma.products.findMany({
          take: 6,
          skip: startFrom,
          select: {
            name: true,
            price: true,
            image: true,
            id: true,
            description: true,
          },
          orderBy: {
            price: "desc",
          },
        }),
        new Promise((_, rej) => {
          setTimeout(() => {
            rej(new TimeoutError());
          }, defaultTimeOut);
        }),
      ]);
    }

    //if there is a name, find based on name and cursor
    if (typeof name === "string") {
      result = await Promise.race([
        prisma.products.findMany({
          where: {
            name: {
              startsWith: name,
              mode: "insensitive",
            },
          },
          take: 6,
          skip: startFrom,
          select: {
            name: true,
            price: true,
            image: true,
            id: true,
            description: true,
          },
        }),
        new Promise((_, rej) => {
          setTimeout(() => {
            rej(new TimeoutError());
          }, defaultTimeOut);
        }),
      ]);
    }

    //check if result is an array
    if (!Array.isArray(result)) {
      throw new TimeoutError();
    }

    //if length returned is greater than our take, then we have a next page
    if (result.length > 5 && currPageIndex <= 0) {
      res.json({
        catalog: result.slice(0, result.length - 1),
        paginationDetails: {
          hasNextPage: true,
          nextPage: currPageIndex + 1,
        },
      });
    }

    //if lenght returned is greater than 5 and currpageIndex is greater than 1, we have next and previous
    if (result.length > 5 && currPageIndex > 0) {
      res.json({
        catalog: result.slice(0, result.length - 1),
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
        catalog: result,
        paginationDetails: {
          hasNextPage: false,
          hasPreviousPage: false,
        },
      });
    }

    //if length returned is not greater than 5,but currpageIndex greater than 1, we have no next but we have a previous
    if (result.length <= 5 && currPageIndex > 0) {
      res.json({
        catalog: result,
        paginationDetails: {
          hasNextPage: false,
          hasPreviousPage: true,
          previousPage: currPageIndex - 1,
        },
      });
    }
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      res.json(error.message).status(error.code);
    }
  }
});

//gets a specific product
productsRouter.get("/:productId", async (req: Request, res: Response) => {
  const productId = req.params.productId;

  try {
    const result = await Promise.race([
      prisma.products.findUnique({
        where: {
          id: productId,
        },
      }),
      new Promise((_, rej) => {
        setTimeout(() => {
          rej(new TimeoutError());
        }, defaultTimeOut);
      }),
    ]);

    res.json(result).status(200);
  } catch (error: unknown) {
    if (error instanceof TimeoutError) {
      res.json(error.message).status(error.code);
    }
  }
});
