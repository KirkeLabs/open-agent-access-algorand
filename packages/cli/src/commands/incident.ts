import { readFile, writeFile } from "node:fs/promises";
import { createAgentStopSignal, evaluateStopSignal, validateAgentStopSignal } from "@open-agent-access/incident";

export async function incidentStopCommand(options: Record<string, string | boolean | undefined>) {
  const output = typeof options.output === "string" ? options.output : "agent-stop.json";
  const signal = createAgentStopSignal({
    reason: typeof options.reason === "string" ? options.reason : "incident_response",
    message: typeof options.message === "string" ? options.message : undefined,
    retryAfter: typeof options["retry-after"] === "string" ? Number(options["retry-after"]) : undefined,
    contact: typeof options.contact === "string" ? options.contact : undefined,
    scope: {
      agentIds: csv(options["agent-ids"]),
      purposes: csv(options.purposes),
      uses: csv(options.uses),
      ruleIds: csv(options["rule-ids"]),
      paths: csv(options.paths)
    }
  });
  await writeFile(output, `${JSON.stringify(signal, null, 2)}\n`, "utf8");
  if (options.json) {
    console.log(JSON.stringify({ output, signal }, null, 2));
    return;
  }
  console.log(`agent stop signal written: ${output}`);
}

export async function incidentCheckCommand(path: string, options: Record<string, string | boolean | undefined>) {
  const signal = validateAgentStopSignal(JSON.parse(await readFile(path, "utf8")));
  const result = evaluateStopSignal(signal, {
    agentId: stringOption(options, "agent-id"),
    purpose: stringOption(options, "purpose"),
    use: stringOption(options, "use"),
    ruleId: stringOption(options, "rule-id"),
    path: stringOption(options, "path")
  });
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    if (result.stopped) process.exitCode = 2;
    return;
  }
  console.log(`${result.stopped ? "stopped" : "allowed"}: ${result.reason}`);
  if (result.stopped) process.exitCode = 2;
}

function csv(value: string | boolean | undefined): string[] | undefined {
  return typeof value === "string" ? value.split(",").map((entry) => entry.trim()).filter(Boolean) : undefined;
}

function stringOption(options: Record<string, string | boolean | undefined>, key: string): string | undefined {
  const value = options[key];
  return typeof value === "string" ? value : undefined;
}
