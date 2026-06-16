# `@kirkelabs/open-agent-access-otel`

OpenTelemetry-shaped observability helpers for Open Agent Access.

Use this package to export OAA receipts, access events, and policy decisions into
trace/span/log shapes that enterprise observability and SIEM pipelines can
ingest.

## Install

```sh
npm install @kirkelabs/open-agent-access-otel @kirkelabs/open-agent-access-core
```

## Exports

- `receiptToOtelSpan(receipt, options)`
- `accessEventToOtelLog(event)`
- `decisionToOtelSpan(input)`
- `OAA_OTEL_ATTRIBUTES`

The package is intentionally vendor-neutral. It emits OpenTelemetry-shaped
objects, not a collector client.
