# @open-agent-access/incident

Incident stop-signal and revocation workflows for Open Agent Access.

This package turns emergency stop and revocation into a machine-readable control
surface.

```ts
import { createAgentStopSignal, evaluateStopSignal } from "@open-agent-access/incident";

const signal = createAgentStopSignal({ reason: "incident_response" });
const decision = evaluateStopSignal(signal, { path: "/premium/report" });
```

Stop signals can be served at `/.well-known/agent-stop` or loaded by middleware.
