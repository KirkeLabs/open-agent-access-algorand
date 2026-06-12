# Mandates

Policies govern resources. Mandates govern delegated authority.

Open Agent Access uses mandates to make agent autonomy inspectable:

- who delegated the action
- which agent and principal are covered
- what purpose, use, tool, method, resource, consequence class, and budget are allowed
- when authority expires
- when human approval is required
- which evidence must be retained
- how authority can be revoked

The recommended discovery path is:

```text
/.well-known/agent-mandates.json
```

The TypeScript package is `@open-agent-access/mandates`. It validates mandate documents, hashes individual mandates, evaluates an invocation, and produces receipt context.

Mandates are intentionally stricter than ordinary request metadata. If a mandate cannot be matched, the evaluator denies the action. If a consequence or budget requires approval, it returns `needs_approval` instead of allowing the tool or fetch.
