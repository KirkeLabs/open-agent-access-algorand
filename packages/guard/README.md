# @kirkelabs/open-agent-access-guard

Human approval guardrails for agent-controlled repositories, deployments, and
production-facing actions.

Agents may read, inspect, summarize, pull fast-forward updates, generate reports,
and prepare changes. They may not push, deploy, publish, mutate environment
variables, change domains, alter payment configuration, or deploy contracts
without bounded human approval and an auditable approval record.

## Core Flow

```text
diff packet -> human review -> one-time approval token -> guard -> ledger record
```

## Important Boundary

Local hooks are guardrails. Enterprise enforcement requires remote branch
protection, required checks, deployment protections, and protected secrets.

