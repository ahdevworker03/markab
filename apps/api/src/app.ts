import express, { type Express } from "express";
import { randomUUID } from "node:crypto";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { notFoundHandler, errorHandler } from "./middleware";
import { env, logger } from "./config";

const app: Express = express();
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Production is deployed directly behind one Caddy reverse proxy.
app.set("trust proxy", env.NODE_ENV === "production" ? 1 : false);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=()",
  );
  next();
});

app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const requestId = req.headers["x-request-id"];
      const id =
        typeof requestId === "string" && REQUEST_ID_PATTERN.test(requestId)
          ? requestId
          : randomUUID();
      res.setHeader("X-Request-Id", id);
      return id;
    },
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
    maxAge: 600,
  }),
);
app.use(cookieParser());
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use((req, res, next) => {
  req.setTimeout(30_000, () => {
    if (!res.headersSent) {
      res.status(408).json({
        error: { code: "REQUEST_TIMEOUT", message: "Request timed out." },
      });
    }
  });
  next();
});

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
