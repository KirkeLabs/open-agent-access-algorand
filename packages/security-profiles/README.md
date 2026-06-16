# `@kirkelabs/open-agent-access-security-profiles`

Named deployment security profile checks for Open Agent Access.

## Profiles

- `local-dev`
- `public-demo`
- `production`
- `enterprise`
- `regulated`

## Export

- `evaluateSecurityProfile(policy, profile)`

The stricter profiles require fail-closed posture, identity/purpose/receipt
requirements, rate limits, paid-route metadata, review paths, and signing
posture. This package is a hardening checklist, not a compliance certification.
