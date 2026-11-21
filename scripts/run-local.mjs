import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = fileURLToPath(new URL("../", import.meta.url));
const webDist = fileURLToPath(new URL("../apps/web/dist", import.meta.url));
const adminDist = fileURLToPath(new URL("../apps/admin/dist", import.meta.url));

const args = process.argv.slice(2);
const mode = args.find((arg) => !arg.startsWith("-")) ?? "dev";
const forceBuild = args.includes("--build");
const unknownFlags = args.filter(
  (arg) => arg.startsWith("-") && arg !== "--build",
);

if ((mode !== "dev" && mode !== "preview") || unknownFlags.length > 0) {
  console.error(
    "用法: node scripts/run-local.mjs [dev|preview] [--build]",
  );
  process.exit(1);
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const reset = useColor ? "\x1b[0m" : "";
const bold = useColor ? "\x1b[1m" : "";
const dim = useColor ? "\x1b[2m" : "";

const modes = {
  dev: {
    title: "本地开发预览已启动（前端 + 后端 + 管理后台）",
    endpoints: [
      ["前台网站 (Web)", "http://localhost:4321"],
      ["后端接口 (API)", "http://127.0.0.1:3001"],
      ["管理后台 (Admin)", "http://localhost:5173"],
    ],
    services: [
      {
        name: "web",
        cwd: join(rootDir, "apps/web"),
        args: ["run", "dev", "--ignore-lock"],
        color: "\x1b[36m",
      },
      {
        name: "api",
        cwd: rootDir,
        args: ["run", "dev:api"],
        color: "\x1b[32m",
      },
      {
        name: "admin",
        cwd: rootDir,
        args: ["run", "dev:admin"],
        color: "\x1b[35m",
      },
    ],
  },
  preview: {
    title: "本地构建预览已启动（前端 + 同源后台与 API）",
    endpoints: [
      ["前台预览 (Web)", "http://localhost:4321"],
      ["后台与 API (Admin+API)", "http://localhost:3002"],
    ],
    services: [
      {
        name: "web",
        cwd: join(rootDir, "apps/web"),
        args: ["run", "preview", "--ignore-lock"],
        color: "\x1b[36m",
      },
      {
        name: "admin+api",
        cwd: rootDir,
        args: ["run", "preview:admin"],
        color: "\x1b[32m",
      },
    ],
  },
};

if (mode === "preview" && (forceBuild || !existsSync(webDist) || !existsSync(adminDist))) {
  console.log(`${bold}正在构建前台、后端与管理后台产物…${reset}`);
  const build = spawnSync("bun", ["run", "build"], {
    cwd: rootDir,
    stdio: "inherit",
    env: process.env,
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const config = modes[mode];
console.log("");
console.log(`${bold}${config.title}${reset}`);
for (const [label, url] of config.endpoints) {
  console.log(`  - ${label}: ${url}`);
}
console.log(`${dim}按 Ctrl+C 可同时停止全部服务。${reset}`);
console.log("");

const maxNameLength = Math.max(...config.services.map((s) => s.name.length));
const children = new Set();
let shuttingDown = false;
let exitCode = 0;

function pipeLines(stream, writer, prefix) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) {
      writer.write(`${prefix} ${line}\n`);
    }
  });
  stream.on("end", () => {
    if (pending.length > 0) {
      writer.write(`${prefix} ${pending}\n`);
      pending = "";
    }
  });
}

function sendSignal(child, signal) {
  if (!child.pid) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch {
      // Fall back to direct child signaling if process group no longer exists.
    }
  }
  try {
    child.kill(signal);
  } catch {
    // Ignore already exited processes.
  }
}

function shutdown(reason, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  exitCode = code;
  if (reason) {
    console.log(`\n${dim}${reason}${reset}`);
  }
  if (children.size === 0) {
    process.exit(exitCode);
  }
  for (const child of children) {
    sendSignal(child, "SIGTERM");
  }
  const timer = setTimeout(() => {
    for (const child of children) {
      sendSignal(child, "SIGKILL");
    }
  }, 3000);
  timer.unref();
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => shutdown("正在停止全部本地服务…", 0));
}

for (const service of config.services) {
  const padded = service.name.padEnd(maxNameLength, " ");
  const prefix = useColor
    ? `${service.color}[${padded}]${reset}`
    : `[${padded}]`;
  const child = spawn("bun", service.args, {
    cwd: service.cwd,
    env: process.env,
    detached: process.platform !== "win32",
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.add(child);

  pipeLines(child.stdout, process.stdout, prefix);
  pipeLines(child.stderr, process.stderr, prefix);

  child.on("error", (err) => {
    console.error(`${prefix} 启动失败: ${err.message}`);
    children.delete(child);
    shutdown("检测到服务启动异常，正在停止其他服务…", 1);
  });

  child.on("exit", (code, signal) => {
    children.delete(child);
    if (!shuttingDown) {
      const abnormal = (code ?? 0) !== 0;
      const detail = signal ? `信号 ${signal}` : `退出码 ${code ?? 0}`;
      console.error(`${prefix} 进程已退出（${detail}）`);
      shutdown("服务已停止，正在关闭其余进程…", abnormal ? (code ?? 1) : 0);
    } else if (children.size === 0) {
      process.exit(exitCode);
    }
  });
}
