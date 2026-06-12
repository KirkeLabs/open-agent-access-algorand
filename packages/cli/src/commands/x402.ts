import { runAlgorandX402TestnetCheck } from "@open-agent-access/payments-algorand-x402";

export async function x402TestnetCheckCommand(options: Record<string, string | boolean | undefined>) {
  const result = await runAlgorandX402TestnetCheck({ live: Boolean(options.live) });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  for (const check of result.checks) {
    console.log(`${check.ok ? "ok" : "fail"} ${check.name}: ${check.detail}`);
  }
  if (!result.ok) process.exitCode = 1;
}
