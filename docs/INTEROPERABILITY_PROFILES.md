# Interoperability Profiles

Open Agent Access should become the permission, payment, receipt, and provenance
rail that other standards plug into.

It should not become a wallet, marketplace, healthcare compliance platform,
supply-chain ERP, rights society, or legal ownership registry.

## Horizontal Adapters

| Adapter | Package | Purpose |
| --- | --- | --- |
| Agent passport credentials | `@kirkelabs/open-agent-access-vc` | W3C VC-shaped agent passports for portable identity claims |
| Rights policy mapping | `@kirkelabs/open-agent-access-odrl` | ODRL-shaped permissions, prohibitions, and duties |
| API policy declaration | `@kirkelabs/open-agent-access-openapi` | `x-open-agent-access` OpenAPI extensions and policy extraction |
| Creative rights | `@kirkelabs/open-agent-access-creative-rights` | Asset passports for samples, stems, datasets, images, and other rights-aware assets |
| Observability | `@kirkelabs/open-agent-access-otel` | OpenTelemetry-shaped spans and logs for receipts, events, and decisions |
| Agent/tool manifests | `@kirkelabs/open-agent-access-agent-card` | OAA bindings for agent cards and MCP-style tool manifests |
| Industry profiles | `@kirkelabs/open-agent-access-industry-profiles` | Conservative policy templates for common sectors |

## Industry Profiles To Build

### Publishing and data

- RSL import/export
- C2PA/content credentials receipt binding
- paid crawl/API access
- attribution and quote-limit receipts

### Music and creative rights

- DDEX-compatible identifiers where available
- C2PA/provenance references
- ODRL-style license duties
- PRS/PPL/collective references
- Algorand receipt anchoring for licenses

### APIs and SaaS

- OpenAPI `x-open-agent-access`
- OAuth/token references
- OTel/SIEM receipt export
- usage-based pricing and budget ceilings

### MCP and agent-to-agent tools

- MCP tool manifests with OAA policy references
- A2A agent-card policy binding
- delegated mandates before tool execution
- bilateral agent-to-agent receipts

### Supply chain and product passports

- GS1 Digital Link references
- EPCIS/event references
- product/resource policies
- paid data access receipts

### Healthcare

- FHIR resource profile references
- consent/mandate checks before access
- fail-closed defaults
- privacy-minimized receipts

This is not compliance-in-a-box. Healthcare deployments need legal, privacy,
clinical-safety, and security review.

### Energy and infrastructure

- OCPP/grid-device references
- load-aware access rules
- paid device/API actions
- incident stop signals and replay protection

## Design Rule

Every profile should answer one question:

> What does this industry already standardize, and how can OAA turn that signal
> into an enforceable access decision with a receipt?

If a profile cannot answer that, it belongs in application code rather than OAA
core.
