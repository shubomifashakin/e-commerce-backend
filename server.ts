import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";

const app = express();

app.listen(3000);

//parses all cookies
app.use(cookieParser());
//sets up cors
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

//parses received data to json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//any request to /users uses this router
app.use("/users", usersRouter);

//all routes to /products uses this router
app.use("/products", productsRouter);

app.use("/orders", ordersRouter);
