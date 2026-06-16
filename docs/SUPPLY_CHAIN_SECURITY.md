# Supply Chain Security

Open Agent Access is a public package set that can sit in front of paid routes,
agent identity checks, and receipts. Treat dependency and release security as
part of the protocol surface.

## Release Gates

Before publishing, the release workflow must pass:

- `corepack pnpm build`
- `corepack pnpm test`
- `corepack pnpm lint`
- `corepack pnpm package:check`
- `corepack pnpm pack:dry-run`
- `corepack pnpm security:check`
- `corepack pnpm audit:prod`

The publish script uses npm provenance with `--provenance` and `--access public`.
Do not remove provenance unless npm or GitHub changes the trusted publishing
flow and the replacement is documented here.

## GitHub Controls

Enable these repository settings:

- private vulnerability reporting
- branch protection on `main`
- required status checks for CI, CodeQL, Dependency Review, and package release
  gates
- required CODEOWNERS review for security-sensitive paths
- signed commits or verified commits where practical
- npm token stored only as `NPM_TOKEN` in GitHub Actions secrets

The current solo-maintainer CODEOWNERS file points at `@jayke-dev`. When OAA has
additional maintainers, create a `KirkeLabs/open-agent-access-maintainers` team,
add active maintainers, and replace the CODEOWNERS owner with that team.

The release workflow is intentionally restricted to the KirkeLabs repository and
the `main` branch. Do not publish npm packages from feature branches, forks, or
personal-account mirrors.

## Dependency Monitoring

Dependabot tracks npm and GitHub Actions updates. Dependency Review blocks pull
requests that introduce high-severity vulnerable dependencies.

Production dependency audit is enforced with:

```sh
corepack pnpm audit:prod
```

If an override is needed, document why in the pull request and keep the override
as narrow as possible.

## Static Analysis

CodeQL scans TypeScript on pull requests, pushes to `main`, and a weekly
schedule. OSSF Scorecard runs weekly and publishes SARIF results to GitHub code
scanning.

## Secret Handling

Never commit mnemonics, private keys, seed phrases, production wallet addresses,
facilitator credentials, npm tokens, or GitHub tokens. Local TestNet mnemonic
loading is only for development. Production signing should use wallet
integration, KMS, smart-wallet delegation, Liquid Auth, or another explicit
authorization flow.

## Package Consumers

Consumers should pin package versions, verify npm provenance where their tooling
supports it, and run their own dependency audit. OAA receipts and transparency
proofs make access decisions auditable; they do not replace application-level
security review.
