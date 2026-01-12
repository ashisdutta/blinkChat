import express, { type Express, type Request, type Response } from "express";
import mainRouter from "./routes/index.js";

const app: Express = express();

const port = 3000;

app.use(express.json());

app.use("/api", mainRouter);

app.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
