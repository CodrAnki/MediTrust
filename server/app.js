import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import { notFound, errorHandler } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { uploadsDir } from "./middleware/upload.js";
import healthRoutes from "./routes/healthRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import verificationRoutes from "./routes/verificationRoutes.js";
import scanRoutes from "./routes/scanRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { referenceDir } from "./services/referenceImageService.js";

const app = express();
app.set("trust proxy", 1);

// Trace id on every request/response (and in every error body).
app.use(requestId);

// --- Security & platform middleware -----------------------------------
app.use(
  helmet({
    // Uploaded medicine images are served from /uploads and loaded by the
    // frontend on a different origin (localhost:5173) — helmet's default
    // same-origin resource policy would otherwise block them.
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin: env.clientUrls.length > 1 ? env.clientUrls : env.clientUrls[0],
    credentials: true,
    exposedHeaders: ["X-Request-Id", "Retry-After", "RateLimit-Reset"],
  }),
);
app.use(express.json({ limit: "10mb" })); // generous enough for base64 payloads later; image uploads use multer, not JSON
app.use(express.urlencoded({ extended: true }));

if (env.nodeEnv !== "test") {
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));
}

app.use("/api", apiLimiter);

// --- Static files ----------------------------------------------------------
app.use("/uploads", express.static(uploadsDir));
app.use("/reference-images", express.static(referenceDir));

// --- Routes --------------------------------------------------------------
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/scans", scanRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use("/api/admin", adminRoutes);

// --- 404 + error handling (must be last) ---------------------------------
app.use(notFound);
app.use(errorHandler);

export default app;
