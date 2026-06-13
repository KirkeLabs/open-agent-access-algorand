import { spawn, spawnSync } from "node:child_process";

const server = spawn("corepack", ["pnpm", "--filter", "@kirkelabs/open-agent-access-example-hono-free-and-paid-site", "dev"], {
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += String(chunk);
});
server.stderr.on("data", (chunk) => {
  output += String(chunk);
});

try {
  await waitForServer();
  run("corepack", ["pnpm", "oaa", "check", "http://localhost:4021/free", "--purpose", "research", "--use", "read"]);
  run("corepack", ["pnpm", "oaa", "fetch", "http://localhost:4021/free", "--purpose", "research", "--use", "read"]);
  run("corepack", ["pnpm", "oaa", "fetch", "http://localhost:4021/premium/report", "--purpose", "research", "--use", "ai-input", "--budget", "USD:0.05"]);
  run("corepack", ["pnpm", "oaa", "receipts", "verify", ".oaa/receipts.jsonl"]);
  console.log("example smoke passed");
} finally {
  server.kill();
}

async function waitForServer() {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (output.includes("listening on http://localhost:4021")) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Example server did not start:\n${output}`);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "pipe"
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed\n${result.stdout}\n${result.stderr}`);
  }
}
