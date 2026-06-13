import { runConformanceSuite } from "@kirkelabs/open-agent-access-conformance";

export async function conformanceRunCommand(json = false) {
  const result = await runConformanceSuite();
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    for (const check of result.checks) {
      console.log(`${check.ok ? "ok" : "fail"} ${check.id}: ${check.message}`);
    }
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}
