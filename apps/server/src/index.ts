import { serve, serveStatic } from "@hono/node-server";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.resolve(here, "../../web/dist");
const port = Number(process.env.PORT ?? 7412);

const { app } = createApp();

// 若 web 已构建,则由本服务直接托管(单进程交付)
if (existsSync(path.join(webDist, "index.html"))) {
  app.use("*", serveStatic({ root: path.relative(process.cwd(), webDist) || webDist }));
  app.get("/", (c) => c.html(readFileSync(path.join(webDist, "index.html"), "utf8")));
}

serve({ fetch: app.fetch, hostname: "127.0.0.1", port }, (info) => {
  console.log(`AiEnvManager 已启动: http://127.0.0.1:${info.port}`);
});
