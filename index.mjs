import express from "express";
import cors from "cors";
import morgan from "morgan";
import dot from "dotenv";
import path from "path";
import { devices } from "./routes/devices.mjs";
import { ota } from "./routes/ota.mjs";
dot.config();

async function main() {
  const port = +(process.env.PORT ?? 8080);
  if (!port || !Number.isInteger(port)) {
    console.error("bad port");
    process.exit(1);
  }

  const app = express();
  app.use(morgan("dev"));
  app.use(cors("*"));
  app.use(express.json());

  // Serve static files for dashboard
  app.use("/admin", express.static(path.join(process.cwd(), "public")));

  // Redirect root to admin dashboard
  app.get("/", (req, res) => {
    res.redirect("/admin");
  });

  // Device Management & OTA Updates ONLY
  app.use("/api/devices", devices());
  app.use("/api/ota", ota());

  app.listen(port, () => {
    console.log(`CalcAI Management Dashboard listening on ${port}`);
  });
}

main();
