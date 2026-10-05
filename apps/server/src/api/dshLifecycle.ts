import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Hono } from "hono";
import type { AppContext } from "../app.js";
import { guardInsideHome } from "../app.js";

const execFileP = promisify(execFile);

/** 命令执行抽象:测试注入 fake runner,断言命令/cwd/profile */
export type DshRunner = (cmd: string, args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>;

function defaultRunner(cmd: string, args: string[], cwd: string) {
  return execFileP(cmd, args, { cwd, timeout: 600000, maxBuffer: 16 * 1024 * 1024 });
}

const ALLOWED_VERBS = ["add", "remove", "update", "install", "upgrade"];

export function registerDshLifecycleRoutes(app: Hono, ctx: AppContext, runner: DshRunner = defaultRunner) {
  app.post("/api/dsh/profiles/:name/plugins", async (c) => {
    const profile = c.req.param("name");
    const body = (await c.req.json()) as { args: string[]; dryRun?: boolean };
    const args = body.args ?? [];
    if (args.length === 0) return c.json({ error: "args 必填(如 add @scope/pkg)" }, 400);
    if (!ALLOWED_VERBS.includes(args[0])) {
      return c.json({ error: `首参必须是 ${ALLOWED_VERBS.join("/")} 之一(dsh plugin 转发 pnpm)` }, 400);
    }
    const profileDir = path.join(ctx.paths.hostRoots.dsh, "profiles", profile);
    if (!fs.existsSync(path.join(profileDir, "package.json"))) {
      return c.json({ error: `profile 不存在:${profile}` }, 404);
    }
    guardInsideHome(ctx.homeDir, profileDir);
    const cmd = "dsh";
    const fullArgs = ["plugin", "--profile", profile, ...args];
    if (body.dryRun || ctx.settings.dshDryRun) {
      return c.json({ ok: true, dryRun: true, command: [cmd, ...fullArgs], cwd: profileDir });
    }
    try {
      const { stdout, stderr } = await runner(cmd, fullArgs, profileDir);
      return c.json({ ok: true, command: [cmd, ...fullArgs], cwd: profileDir, stdout, stderr });
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; message: string };
      return c.json({ ok: false, command: [cmd, ...fullArgs], stdout: err.stdout ?? "", stderr: err.stderr ?? err.message }, 500);
    }
  });
}
