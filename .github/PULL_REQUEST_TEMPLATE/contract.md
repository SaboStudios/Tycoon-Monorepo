## Description

<!-- What does this PR change and why? Link the issue: Closes #NNNN -->

## CI Summary (`make ci`)

<!--
Paste the output of `make ci` run from the `contract/` directory.
All checks must be green before requesting review.

```
cd contract && make ci
```

Replace this block with your actual output:
-->

```
$ make ci
make hygiene: OK (fmt --check + clippy -D warnings)
make ci: OK (hygiene + build + wasm-check + test)
```

## Checklist

- [ ] `make ci` passes locally (output pasted above)
- [ ] New or changed behaviour is covered by tests
- [ ] `GAS_SNAPSHOT_DIFF.md` updated if storage ops changed
- [ ] `docs/NEP_STANDARDS_CHECKLIST.md` updated if token interface changed
- [ ] No regressions in related flows
- [ ] PR title follows `feat|fix|chore|docs(scope): summary [#issue]`
- [ ] Changes comply with the [Workspace Security Review Checklist](../contract/SECURITY_REVIEW_CHECKLIST.md) (SW-CONTRACT-HYGIENE-001)
