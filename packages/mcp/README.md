# @kirkelabs/open-agent-access-mcp

MCP tool-boundary guard for Open Agent Access.

This package does not force a specific MCP SDK. It provides structural helpers that can sit before any tool handler and enforce:

- agent identity
- declared purpose and use
- OAA policy decision
- optional mandate authority
- deterministic denial metadata

```ts
import { createAgentAccessMcpToolGuard } from "@kirkelabs/open-agent-access-mcp";

const guard = createAgentAccessMcpToolGuard({ policy, mandateDocument });
const wrapped = guard.wrapTool("premium.lookup", async (input) => lookup(input));
```

Payment settlement should still be handled at the resource/API boundary. MCP guards are for permission, scope, and evidence discipline before tool execution.
