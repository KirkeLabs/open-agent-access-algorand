# ADR 0006: Mandates Before Tool Execution

## Status

Accepted.

## Context

Resource policy answers what a site or API will allow. It does not prove that an
agent is authorised by a user, operator, or institution to perform the action.
Tool calls are especially sensitive because they can cross from information
retrieval into publication, transaction, mutation, or private-data handling.

## Decision

Open Agent Access defines mandate documents at
`/.well-known/agent-mandates.json` and provides a mandate evaluator that fails
closed. MCP-style tool guards should check both resource policy and delegated
authority before running tool handlers.

## Consequences

Agent systems can carry authority context across web, API, and tool boundaries.
Receipts and event trails can bind decisions to mandate hashes, policy hashes,
trace IDs, resources, tools, and consequences.
