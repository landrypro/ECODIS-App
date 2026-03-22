import { Hono } from "npm:hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => c.json({ status: "ok" }));
