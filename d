[1mdiff --git a/apps/api/build.mjs b/apps/api/build.mjs[m
[1mindex 86ebf7f..2327894 100644[m
[1m--- a/apps/api/build.mjs[m
[1m+++ b/apps/api/build.mjs[m
[36m@@ -15,7 +15,7 @@[m [masync function buildAll() {[m
   await rm(distDir, { recursive: true, force: true });[m
 [m
   await esbuild({[m
[31m-    entryPoints: [path.resolve(artifactDir, "src/index.ts")],[m
[32m+[m[32m    entryPoints: [path.resolve(artifactDir, "src/server.ts")],[m
     platform: "node",[m
     bundle: true,[m
     format: "esm",[m
[36m@@ -104,7 +104,7 @@[m [masync function buildAll() {[m
     sourcemap: "linked",[m
     plugins: [[m
       // pino relies on workers to handle logging, instead of externalizing it we use a plugin to handle it[m
[31m-      esbuildPluginPino({ transports: ["pino-pretty"] })[m
[32m+[m[32m      esbuildPluginPino({ transports: ["pino-pretty"] }),[m
     ],[m
     // Make sure packages that are cjs only (e.g. express) but are bundled continue to work in our esm output file[m
     banner: {[m
[1mdiff --git a/apps/api/package.json b/apps/api/package.json[m
[1mindex 6916f27..39acb7f 100644[m
[1m--- a/apps/api/package.json[m
[1m+++ b/apps/api/package.json[m
[36m@@ -6,7 +6,7 @@[m
   "scripts": {[m
     "dev": "export NODE_ENV=development && pnpm run build && pnpm run start",[m
     "build": "node ./build.mjs",[m
[31m-    "start": "node --enable-source-maps ./dist/index.mjs",[m
[32m+[m[32m    "start": "node --enable-source-maps ./dist/server.mjs",[m
     "typecheck": "tsc -p tsconfig.json --noEmit"[m
   },[m
   "dependencies": {[m
[1mdiff --git a/apps/api/src/app.ts b/apps/api/src/app.ts[m
[1mindex f32f71e..144946d 100644[m
[1m--- a/apps/api/src/app.ts[m
[1m+++ b/apps/api/src/app.ts[m
[36m@@ -2,7 +2,8 @@[m [mimport express, { type Express } from "express";[m
 import cors from "cors";[m
 import pinoHttp from "pino-http";[m
 import router from "./routes";[m
[31m-import { logger } from "./lib/logger";[m
[32m+[m[32mimport { notFoundHandler, errorHandler } from "./middleware";[m
[32m+[m[32mimport { logger } from "./config";[m
 [m
 const app: Express = express();[m
 [m
[36m@@ -31,4 +32,7 @@[m [mapp.use(express.urlencoded({ extended: true }));[m
 [m
 app.use("/api", router);[m
 [m
[32m+[m[32mapp.use(notFoundHandler);[m
[32m+[m[32mapp.use(errorHandler);[m
[32m+[m
 export default app;[m
[1mdiff --git a/apps/api/src/index.ts b/apps/api/src/index.ts[m
[1mdeleted file mode 100644[m
[1mindex b1f024d..0000000[m
[1m--- a/apps/api/src/index.ts[m
[1m+++ /dev/null[m
[36m@@ -1,25 +0,0 @@[m
[31m-import app from "./app";[m
[31m-import { logger } from "./lib/logger";[m
[31m-[m
[31m-const rawPort = process.env["PORT"];[m
[31m-[m
[31m-if (!rawPort) {[m
[31m-  throw new Error([m
[31m-    "PORT environment variable is required but was not provided.",[m
[31m-  );[m
[31m-}[m
[31m-[m
[31m-const port = Number(rawPort);[m
[31m-[m
[31m-if (Number.isNaN(port) || port <= 0) {[m
[31m-  throw new Error(`Invalid PORT value: "${rawPort}"`);[m
[31m-}[m
[31m-[m
[31m-app.listen(port, (err) => {[m
[31m-  if (err) {[m
[31m-    logger.error({ err }, "Error listening on port");[m
[31m-    process.exit(1);[m
[31m-  }[m
[31m-[m
[31m-  logger.info({ port }, "Server listening");[m
[31m-});[m
[1mdiff --git a/apps/api/src/lib/logger.ts b/apps/api/src/lib/logger.ts[m
[1mdeleted file mode 100644[m
[1mindex d9c67f7..0000000[m
[1m--- a/apps/api/src/lib/logger.ts[m
[1m+++ /dev/null[m
[36m@@ -1,20 +0,0 @@[m
[31m-import pino from "pino";[m
[31m-[m
[31m-const isProduction = process.env.NODE_ENV === "production";[m
[31m-[m
[31m-export const logger = pino({[m
[31m-  level: process.env.LOG_LEVEL ?? "info",[m
[31m-  redact: [[m
[31m-    "req.headers.authorization",[m
[31m-    "req.headers.cookie",[m
[31m-    "res.headers['set-cookie']",[m
[31m-  ],[m
[31m-  ...(isProduction[m
[31m-    ? {}[m
[31m-    : {[m
[31m-        transport: {[m
[31m-          target: "pino-pretty",[m
[31m-          options: { colorize: true },[m
[31m-        },[m
[31m-      }),[m
[31m-});[m
[1mdiff --git a/apps/api/src/middlewares/.gitkeep b/apps/api/src/middlewares/.gitkeep[m
[1mdeleted file mode 100644[m
[1mindex e69de29..0000000[m
[1mdiff --git a/apps/api/src/routes/health.ts b/apps/api/src/routes/health.ts[m
[1mdeleted file mode 100644[m
[1mindex c0a1446..0000000[m
[1m--- a/apps/api/src/routes/health.ts[m
[1m+++ /dev/null[m
[36m@@ -1,11 +0,0 @@[m
[31m-import { Router, type IRouter } from "express";[m
[31m-import { HealthCheckResponse } from "@workspace/api-zod";[m
[31m-[m
[31m-const router: IRouter = Router();[m
[31m-[m
[31m-router.get("/healthz", (_req, res) => {[m
[31m-  const data = HealthCheckResponse.parse({ status: "ok" });[m
[31m-  res.json(data);[m
[31m-});[m
[31m-[m
[31m-export default router;[m
[1mdiff --git a/apps/api/src/routes/index.ts b/apps/api/src/routes/index.ts[m
[1mindex 5a1f77a..c07a927 100644[m
[1m--- a/apps/api/src/routes/index.ts[m
[1m+++ b/apps/api/src/routes/index.ts[m
[36m@@ -1,5 +1,5 @@[m
 import { Router, type IRouter } from "express";[m
[31m-import healthRouter from "./health";[m
[32m+[m[32mimport healthRouter from "../modules/health/health.routes";[m
 [m
 const router: IRouter = Router();[m
 [m
[1mdiff --git a/package.json b/package.json[m
[1mindex c16f8cd..419fb26 100644[m
[1m--- a/package.json[m
[1m+++ b/package.json[m
[36m@@ -7,11 +7,17 @@[m
     "build": "pnpm run typecheck && pnpm -r --if-present run build",[m
     "typecheck:libs": "tsc --build",[m
     "typecheck": "pnpm run typecheck:libs && pnpm -r --filter \"./artifacts/**\" --if-present run typecheck",[m
[31m-    "dev": "pnpm --filter @workspace/car-rental run dev"[m
[32m+[m[32m    "dev": "pnpm --filter @workspace/car-rental run dev",[m
[32m+[m[32m    "lint": "eslint .",[m
[32m+[m[32m    "format": "prettier --write .",[m
[32m+[m[32m    "format:check": "prettier --check ."[m
   },[m
   "private": true,[m
   "devDependencies": {[m
[32m+[m[32m    "@eslint/js": "^10.0.1",[m
[32m+[m[32m    "eslint": "^10.8.0",[m
     "prettier": "^3.9.5",[m
[31m-    "typescript": "~5.9.3"[m
[32m+[m[32m    "typescript": "~5.9.3",[m
[32m+[m[32m    "typescript-eslint": "^8.66.0"[m
   }[m
 }[m
[1mdiff --git a/pnpm-lock.yaml b/pnpm-lock.yaml[m
[1mindex ec2fcae..e0ccee1 100644[m
[1m--- a/pnpm-lock.yaml[m
[1m+++ b/pnpm-lock.yaml[m
[36m@@ -145,12 +145,21 @@[m [mimporters:[m
 [m
   .:[m
     devDependencies:[m
[32m+[m[32m      '@eslint/js':[m
[32m+[m[32m        specifier: ^10.0.1[m
[32m+[m[32m        version: 10.0.1(eslint@10.8.0(jiti@2.7.0))[m
[32m+[m[32m      eslint:[m
[32m+[m[32m        specifier: ^10.8.0[m
[32m+[m[32m        version: 10.8.0(jiti@2.7.0)[m
       prettier:[m
         specifier: ^3.9.5[m
         version: 3.9.5[m
       typescript:[m
         specifier: ~5.9.3[m
         version: 5.9.3[m
[32m+[m[32m      typescript-eslint:[m
[32m+[m[32m        specifier: ^8.66.0[m
[32m+[m[32m        version: 8.66.0(eslint@10.8.0(jiti@2.7.0))(typescript@5.9.3)[m
 [m
   apps/api:[m
     dependencies:[m
[36m@@ -617,6 +626,45 @@[m [mpackages:[m
     cpu: [x64][m
     os: [win32][m
 [m
[32m+[m[32m  '@eslint-community/eslint-utils@4.10.1':[m
[32m+[m[32m    resolution: {integrity: sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==}[m
[32m+[m[32m    engines: {node: ^12.22.0 || ^14.17.0 || >=16.0.0}[m
[32m+[m[32m    peerDependencies:[m
[32m+[m[32m      eslint: ^6.0.0 || ^7.0.0 || >=8.0.0[m
[32m+[m
[32m+[m[32m  '@eslint-community/regexpp@4.12.2':[m
[32m+[m[32m    resolution: {integrity: sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==}[m
[32m+[m[32m    engines: {node: ^12.0.0 || ^14.0.0 || >=16.0.0}[m
[32m+[m
[32m+[m[32m  '@eslint/config-array@0.23.5':[m
[32m+[m[32m    resolution: {integrity: sha512-Y3kKLvC1dvTOT+oGlqNQ1XLqK6D1HU2YXPc52NmAlJZbMMWDzGYXMiPR