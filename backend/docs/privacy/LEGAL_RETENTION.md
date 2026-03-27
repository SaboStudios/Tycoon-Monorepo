# Legal review: retention exceptions

## Status

**Pending legal review.** This file records categories of data that may be **retained** or **not fully deleted** after an erasure request, and the **stated basis** (e.g. legal obligation, legitimate interest). Product and engineering must not treat this as legal advice until counsel signs off.

## Template for exceptions

| Data / system | Retention period | Basis (to be validated by legal) | Owner |
|---------------|------------------|----------------------------------|-------|
| Example: payment transaction metadata | 7 years | Tax / accounting | Finance |
| Example: security logs | 90 days | Fraud prevention | Security |

## Action items

1. Counsel to confirm which backend tables and third-party systems fall under each exception.
2. Update `ERASURE_WORKFLOW.md` with approved handling (delete vs anonymize vs retain-minimum).
3. Ensure support runbook lists what the user is told when exceptions apply.
