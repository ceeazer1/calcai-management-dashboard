import express from "express";
import cors from "cors";
import morgan from "morgan";
import dot from "dotenv";
import path from "path";
// Removed express-session import as we're using custom session handling
import cookieParser from "cookie-parser";
import { devices } from "./routes/devices.mjs";
import { ota } from "./routes/ota.mjs";
import { requireAuth, authenticateUser } from "./auth.mjs";
dot.config();

const app = express();
app.use(morgan("dev"));
app.use(cors("*"));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);

// Simple in-memory session store for serverless (not ideal for production)
const activeSessions = new Map();

// Generate simple session token
function generateSessionToken() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

// Session middleware replacement
function sessionMiddleware(req, res, next) {
  const token = req.cookies['calcai-auth'];
  if (token && activeSessions.has(token)) {
    req.session = activeSessions.get(token);
  } else {
    req.session = {};
  }
  next();
}

// Login page (public)
app.get("/login", (req, res) => {
  res.sendFile(path.join(process.cwd(), "public", "login.html"));
});

// Login endpoint
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password required" });
  }

  const isValid = await authenticateUser(username, password);

  if (isValid) {
    const token = generateSessionToken();
    const sessionData = {
      authenticated: true,
      username: username,
      createdAt: Date.now()
    };

    activeSessions.set(token, sessionData);

    // Set cookie
    res.cookie('calcai-auth', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    });

    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Logout endpoint
app.post("/logout", (req, res) => {
  const token = req.cookies['calcai-auth'];
  if (token) {
    activeSessions.delete(token);
    res.clearCookie('calcai-auth');
  }
  res.json({ success: true, message: "Logged out successfully" });
});

// Auth check endpoint
app.get("/api/auth/check", (req, res) => {
  console.log('Auth check - Session:', req.session);
  if (req.session && req.session.authenticated) {
    res.json({ authenticated: true, username: req.session.username });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

// Serve static files for dashboard (protected)
app.use("/admin", requireAuth, express.static(path.join(process.cwd(), "public")));

// Redirect root to login or admin
app.get("/", (req, res) => {
  if (req.session && req.session.authenticated) {
    res.redirect("/admin");
  } else {
    res.redirect("/login");
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "CalcAI Management Dashboard is running",
    timestamp: new Date().toISOString()
  });
});

// Device Management & OTA Updates (protected)
app.use("/api/devices", requireAuth, devices());
app.use("/api/ota", requireAuth, ota());

// For local development
if (process.env.NODE_ENV !== 'production') {
  const port = +(process.env.PORT ?? 8080);
  app.listen(port, () => {
    console.log(`CalcAI Management Dashboard listening on ${port}`);
  });
}

// Export for Vercel
export default app;
