Follow AGENTS.md at the repository root. It is binding. Its performance guardrails (MediaTek
Helio phones overheated until they were applied) are enforced by CI:
src/__tests__/performanceGuardrails.test.ts and scripts/check-bundle-budget.js with
perf-budget.json. The reasons are in docs/PERFORMANCE.md. Never loosen an exception list, a
ceiling or a budget to make CI pass.
