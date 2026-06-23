# `@kirkelabs/open-agent-access-agent-card`

Agent Card and MCP manifest binding helpers for Open Agent Access.

Use this package when an agent, MCP server, or tool manifest needs to advertise
where its OAA policy lives and which rules apply to individual tools.
MCP tool bindings also publish Codex-compatible `permissions` hints so Codex can
classify read-only, mutating, and interactive tools without losing the OAA rule
binding.

## Install

```sh
npm install @kirkelabs/open-agent-access-agent-card @kirkelabs/open-agent-access-core
```

## Exports

- `createAgentAccessManifestBinding(input)`
- `attachAgentAccessToAgentCard(card, binding)`
- `extractAgentAccessFromAgentCard(card)`
- `attachAgentAccessToMcpTool(tool, binding)`
- `createToolPolicyBindingsPolicy(input)`

`attachAgentAccessToMcpTool` accepts an optional `permissions` array on the
tool binding. Use Codex capability labels: `Read`, `Write`, and `Interactive`.
When omitted, charged tools default to `["Read", "Write"]` and other tools
default to `["Read"]`.

This package does not define a new agent protocol. It adds OAA bindings to
existing agent/tool manifests.
