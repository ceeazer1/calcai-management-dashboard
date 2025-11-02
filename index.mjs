import express from "express";
import cors from "cors";
import morgan from "morgan";
import dot from "dotenv";
import path from "path";
import fs from "fs";
import crypto from "crypto";
// Removed express-session import as we're using custom session handling
import cookieParser from "cookie-parser";
import { devices } from "./routes/devices.mjs";
import { orders } from "./routes/orders.mjs";
import { ota } from "./routes/ota.mjs";
import { requireAuth, authenticateUser } from "./auth.mjs";
import { devicesIngestPublic } from "./routes/devices_ingest.mjs";
import { devicesLogsPublic } from "./routes/devices_logs.mjs";
import { firmwarePublic } from "./routes/firmware_public.mjs";
import { website, websitePublic } from "./routes/website.mjs";
import { pairAdmin } from "./routes/pair.mjs";
import { notesAdmin } from "./routes/notes_admin.mjs";
import { ownerAdmin } from "./routes/owner_admin.mjs";
// Optionally load STRIPE_SECRET_KEY from website/.env.local if present
try {
  const envLocal = path.join(process.cwd(), "..", "website", ".env.local");
  if (fs.existsSync(envLocal)) {
    const content = fs.readFileSync(envLocal, 'utf8');
    content.split(/\r?\n/).forEach(line => {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['\"]|['\"]$/g, '');
      }
    });
    console.log('[env] Loaded keys from website/.env.local');
  }
} catch {}

dot.config();

const app = express();
app.use(morgan("dev"));
app.use(cors("*"));
app.use(express.json());
app.use(cookieParser());
app.use(sessionMiddleware);
// Public assets (for login page)
// Restore default static caching behavior (ETag/Last-Modified enabled)
app.use("/assets", express.static(path.join(process.cwd(), "public")));


// Stateless signed-cookie auth so it works on serverless
const SESSION_SECRET = process.env.SESSION_SECRET || (process.env.ADMIN_PASSWORD_HASH || "calcai-dev-secret");
function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifySession(token) {
  if (!token || token.indexOf('.') === -1) return null;
  const [data, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  if (sig !== expected) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch { return null; }
}

// Session middleware replacement (verifies signed cookie)
function sessionMiddleware(req, res, next) {
  const token = req.cookies['calcai-auth'];
  const data = verifySession(token);
  if (data && data.authenticated) {
    req.session = data;
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
    const sessionData = { authenticated: true, username, iat: Date.now() };
    const token = signSession(sessionData);

    // Set cookie
    res.cookie('calcai-auth', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
    });

    res.json({ success: true, message: "Login successful" });
  } else {
    res.status(401).json({ error: "Invalid credentials" });
  }
});

// Logout endpoint
app.post("/logout", (req, res) => {
  res.clearCookie('calcai-auth', { path: '/' });
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
app.use("/admin", (req, res, next) => {
  // allow login page to be reached without loops
  return requireAuth(req, res, next);
}, express.static(path.join(process.cwd(), "public")));

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

// Orders (protected)
app.use("/api/orders", requireAuth, orders());

// Device Public Ingest (no auth, token validated inside)
app.use("/api/devices", devicesIngestPublic());
app.use("/api/devices", devicesLogsPublic());

// Public token-protected firmware download for OTA (so Fly can fetch binaries)
app.use("/api/devices/firmware", firmwarePublic());

// Device Management & OTA Updates (protected)
app.use("/api/devices", requireAuth, devices());
// Pairing admin (protected)
app.use("/api/pair", requireAuth, pairAdmin());
// Notes admin proxy (protected)
app.use("/api/notes-admin", requireAuth, notesAdmin());
// Owner admin proxy (protected)
app.use("/api/owner", requireAuth, ownerAdmin());
// Website (product page controls) - protected
app.use("/api/website", requireAuth, website());
// Website public (read-only for calcai.cc)
app.use("/api/website-public", websitePublic());

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
