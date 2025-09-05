import bcrypt from "bcryptjs";

// In production, store these in environment variables or a database
const ADMIN_CREDENTIALS = {
  username: process.env.ADMIN_USERNAME || "admin",
  // Default password: "calcai2025" - CHANGE THIS IN PRODUCTION!
  passwordHash: process.env.ADMIN_PASSWORD_HASH || "$2b$10$CvS2.qorjIS1Y9b35Pe6LeyBMXqoV9dmIYAZtiBTYdrJd/kmwjjxa"
};

// Middleware to check if user is authenticated
export function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  } else {
    // If it's an API request, return JSON error
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Otherwise redirect to login with next param
    const next = encodeURIComponent(req.originalUrl || '/');
    return res.redirect(`/login?next=${next}`);
  }
}

// Login function
export async function authenticateUser(username, password) {
  if (username === ADMIN_CREDENTIALS.username) {
    return await bcrypt.compare(password, ADMIN_CREDENTIALS.passwordHash);
  }
  return false;
}

// Generate password hash (for setup)
export async function generatePasswordHash(password) {
  return await bcrypt.hash(password, 10);
}
