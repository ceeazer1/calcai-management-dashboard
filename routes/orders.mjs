import express from "express";

export function orders() {
  const router = express.Router();

  // Orders API disabled during Poof migration
  router.get("/list", async (req, res) => {
    res.json({ orders: [], note: 'Orders view disabled (migrated to Poof).' });
  });

  router.get("/:id", async (req, res) => {
    res.status(501).json({ error: 'Orders API disabled during Poof migration' });
  });

  return router;
}

