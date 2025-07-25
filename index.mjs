import express from "express";
import cors from "cors";
import morgan from "morgan";
import dot from "dotenv";
import path from "path";
import { devices } from "./routes/devices.mjs";
import { ota } from "./routes/ota.mjs";
dot.config();

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

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "CalcAI Management Dashboard is running",
    timestamp: new Date().toISOString()
  });
});

// Device Management & OTA Updates ONLY
app.use("/api/devices", devices());
app.use("/api/ota", ota());

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = +(process.env.PORT ?? 8080);
  app.listen(port, () => {
    console.log(`CalcAI Management Dashboard listening on ${port}`);
  });
}

// Export for Vercel
export default app;
