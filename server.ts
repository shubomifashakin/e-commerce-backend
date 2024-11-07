import express, { Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { usersRouter } from "./routes/users";
import { productsRouter } from "./routes/products";
import { ordersRouter } from "./routes/orders";

const app = express();

app.listen(3000);

//sets up cors
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

//parses received data to json
app.use(express.json());

// app.use(express.static("public"));

//sets our html rendering engine
app.set("view engine", "ejs");

app.get("/", (req: Request, res: Response, next) => {
  //returning a download to the client
  //   res.download('server.js')

  //rendering html on the client
  //first parameter is the name of the view template we want to use to render
  //the second parameter is the data we want to render on the view template
  res.render("index", { text: "Shubomi Fashakin" });

  //returning json
  //   res.json({ message: "Returned" }).status(200).statusMessage("Success");
});

//import the users router
//any request to /users uses this router
app.use("/users", usersRouter);

//import the products router
app.use("/products", productsRouter);

// app.use("/orders", ordersRouter);
