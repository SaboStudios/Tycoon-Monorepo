<!--
Thanks for contributing! CI (`PR compliance`) checks this description:
the four "##" sections below must have content, an issue must be linked,
and each package you change needs a CHANGELOG entry. Comments like this
one are ignored by the check, so fill in real text below each heading.

Package-specific templates (append to the PR URL):
  ?template=frontend.md  ?template=backend.md  ?template=shop-api.md  ?template=contract.md

Security vulnerabilities: do NOT open a public PR. Report privately per SECURITY.md.
-->

## Summary

<!-- What changes and why. Link the issue: "Closes #123" (or "Refs #123"). -->

## Changelog

<!--
Which CHANGELOG.md files you added an entry to, under "## [Unreleased]":
  frontend/ -> frontend/CHANGELOG.md     backend/ -> backend/CHANGELOG.md
  shop-api/ -> shop-api/CHANGELOG.md     contract/contracts/<crate>/ -> that crate's CHANGELOG.md
  contract/ (other) -> contract/CHANGELOG.md     anything else -> CHANGELOG.md
Docs-only and test-only changes need no entry. Otherwise, if no entry is
warranted, write one line:  No changelog: <reason of at least 10 characters>
-->

## Test plan

<!-- Exact commands you ran and their results (paste failing output too; see "CI honesty" in CONTRIBUTING.md). -->

## Rollback

<!-- How to undo this safely: revert / flag / env var, order of operations, data migration notes. "Revert the PR" is fine when true. -->

## Checklist

- [ ] No secrets, tokens, or real credentials in code, examples, logs, or this description
- [ ] No PII in telemetry labels/payloads; analytics stays consent-gated
- [ ] New external entrypoints are authenticated, rate-limited, and deny-by-default
- [ ] Server stays the source of truth for money, dice, inventory, and admin mutations
- [ ] No ungated Stellar UI or copy (NEAR is the only supported chain UI, ADR-003)
- [ ] Docs/runbooks updated; nothing claims CI passes unless it did
