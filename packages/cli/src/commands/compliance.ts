import { getAllComplianceMappings, getComplianceMapping, listComplianceFrameworks, type ComplianceFramework } from "@kirkelabs/open-agent-access-compliance";

export async function complianceMapCommand(options: Record<string, string | boolean | undefined>) {
  const framework = typeof options.framework === "string" ? options.framework : "all";
  const reports = framework === "all"
    ? getAllComplianceMappings()
    : [getComplianceMapping(parseFramework(framework))];
  if (options.json) {
    console.log(JSON.stringify(framework === "all" ? reports : reports[0], null, 2));
    return;
  }
  for (const report of reports) {
    console.log(`${report.framework} (${report.controls.length} mappings)`);
    console.log(report.disclaimer);
    for (const control of report.controls) {
      console.log(`- ${control.id} ${control.area}: ${control.requirement}`);
      console.log(`  evidence: ${control.evidence.join(", ")}`);
    }
  }
}

function parseFramework(value: string): ComplianceFramework {
  if ((listComplianceFrameworks() as string[]).includes(value)) {
    return value as ComplianceFramework;
  }
  throw new Error(`Unknown framework "${value}". Available: ${listComplianceFrameworks().join(", ")}, all`);
}
