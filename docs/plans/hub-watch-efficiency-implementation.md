# Cheap waiting for Hub coordinators

Local implementation brief, authorized 2026-10-12 (Pacific). Implement with
GPT-6.1 Sol, reasoning effort **high**. This is a local patch, with no upstream
submission or deployment.

The coordinator should spend model work on new evidence and decisions. Code
already knows when workers finish, fail, become blocked, or need input. A timed
monitor should read its declared sources and stop before the model when they
are unchanged. When something changes, it should use the existing dispatch path
and preserve the coordinator's full instructions and authority.

## What exists

The Birdclaw audit measured the coordinator alone: ten unchanged monitoring
checks accounted for 30.4% of its recorded input processing. Workers were outside
that measurement. The evidence is at
`/Users/alchang/.synara/userdata/project-context/e1875ac1-ff7e-40e4-8dc3-4119a11ad81e/library/birdclaw-hub-token-audit/REPORT.md`.

Local commit `c4badd010` already reduces repeated Hub context packaging:
one memory index, concise decision/report previews with exact document
references, and intact structured goal boundaries, worker identities, errors,
and user-owned instructions. Representative synthetic packets fell from
24,901 to 10,881 characters and from 31,779 to 12,839 characters. Those savings
do **not** prove avoided model wakes. The full documents remain readable.

Relevant code:

- `apps/server/src/projectAgent/Layers/ProjectAgentReactor.ts` and
  `workerHealth.ts`: worker events, health checks, and wake eligibility.
- `apps/server/src/projectAgent/Layers/ProjectAgentService.ts`: pending wake
  cursor, receipts, coalescing, busy handling, and context packing.
- `apps/server/src/automation/Layers/AutomationService.ts`: scheduled runs,
  deferred retries, canonical `dispatchRun`, completion reconciliation, caps,
  failure reporting, and explicit Run now.
- `packages/contracts/src/automation.ts`: existing definition/run contracts.
- `apps/server/src/git/Services/GitHubCli.ts` and its layer: existing read-only
  PR/check readers. Resolve their current filenames in the checkout.
- `apps/server/src/pullRequestAutoFix/`: an example of deterministic CI
  observation. Reuse read primitives, **not** its fixing/pushing behavior.

The built-in Hub wake automation uses project events. A separate timed monitor
is additional work. A silent automation still starts a model today.

## The bounded change

First check which timed worker/report polls duplicate existing event coverage.
Prefer removing redundant work when the existing event/receipt path actually
covers its completion, failure, blocker, and input duties. Do not disable a live
automation or remove external PR observation to claim that saving.

For an explicitly configured timed watch that still needs external observation,
add one small gate before any provider turn, prompt/history append, Hub packet
construction, or model-based completion evaluation. Put it on the existing
dispatch path so deferred runs cannot bypass it. Other automations retain their
current behavior; explicit Run now bypasses the unchanged gate.

The watch names exact PRs, Hub work/worker identities, and report/artifact paths.
Do not infer a dependency list or watch intent from arbitrary natural-language
prompts. Choose the smallest opt-in configuration that fits the existing local
definition/config path. Configuration describes sources; it is not a new
durable polling cursor. Keep machine-specific IDs out of shared defaults.
Before implementation, report the exact configuration shape, reader coverage,
dispatch hook, and estimated diff size to the creating thread. Continue routine
work without waiting for permission; stop for the scope boundaries below.

| Observation                                                         | Action                                                                                      |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Complete and identical to the last successfully handled observation | Finish through the existing skipped-run/reporting path; no model work.                      |
| Complete and new, or no baseline after startup                      | Use existing dispatch, with the current full watch brief and authorization.                 |
| Missing, partial, unreadable, or failed                             | Surface the observation failure through existing error reporting; never label it unchanged. |

No new scheduler, daemon, table, lease, queue, general predicate language, broad
UI, or delta protocol. No automatic fix/retest/merge/deploy decisions in the gate.
This detects changed evidence; the coordinator still judges its meaning.

## What counts as changed

Use a small canonical metadata snapshot. Stable sorting prevents enumeration
order from becoming an event. Poll time, UI read flags, and incidental progress
timestamps are not evidence. Include, when declared by the watch:

- PR identity, exact head commit, open/closed/merged state, and check identities
  and conclusions/statuses. Same-head CI changes still matter.
- Review/comment identities and relevant edit/change metadata. An edited review
  must not disappear behind an unchanged aggregate review decision.
- Work-item-to-worker binding, request/batch/dispatch identity, exact assigned
  revision, worker turn/terminal state, errors, blockers, and needs-input state.
- Report/document path, revision and content hash; published artifact/library
  Git revision. A new report matters even if all checks are green.
- Effective watch scope and instruction/authorization changes. Reconfiguring a
  watch or changing its brief invalidates the baseline.

Read metadata first, and fetch full reports or documents for meaningful model
decisions. Do not repeatedly run tests as a polling operation. Do not interpret
green CI as acceptance, a passing test as deployment, or a closed PR as deployed.
If the existing readers cannot observe a promised duty, report that gap rather
than silently dropping the duty or adding a second subsystem.

## Delivery, cache, and stop rules

Keep the comparison baseline in memory, scoped to the watch. Restart may cause
one conservative model wake. Use the existing automation run/receipt identities
to associate a dispatched snapshot with its own outcome; do not invent another
durable acknowledgment system.

Advance the baseline only when that exact observation was delivered to a
successful settled run. Busy deferral, enqueue failure, model failure,
interruption, or an unrelated turn completing does not consume a change.
Do not acknowledge a newer snapshot fetched after the run: the model may never
have seen it. Compare with the last handled state, not a global set of seen
hashes; A -> B -> A is a change. An old run cannot acknowledge a reconfigured
watch. Invalidate or otherwise conservatively handle changes while busy.

Preserve risk acknowledgments, filesystem/approval boundaries, existing input
and permission waits, run caps, wall-clock limits, consecutive-failure limits,
and completion/error notifications. Unchanged skips must not accidentally extend
a bounded watch forever or invoke an LLM completion checker. If a natural-language
stop condition depends on facts absent from the declared observation, leave it
outside the gate and report the limitation before claiming complete coverage.

This is not permission to weaken the packing fix. Preserve user-owned
instructions, active authorization, blockers, exact revisions, and dispatch
identities. An unstructured decision preview is **not** a complete current
policy. Do not classify old prose as expired automatically. Inspect the full
document before a consequential decision, and make any remaining reliance on
that read explicit. Prefer preserving ambiguous constraints to losing them.

## Birdclaw fixture: useful evidence, not live authorization

The audited watch followed Birdclaw PR 4, a bounded repair, and an independent
retest. Its duties included resolving the current worker from a work item,
waiting for a new exact ready revision, inspecting a finished tester report,
reporting material outcomes once, and observing eventual PR/deployment lifecycle.
Its constraints included one additional review round, reuse of the existing
tester, and no periodic rerunning of acceptance tests. It kept the last retest
revision and accepted dispatch identity in automation memory.

Preserve that kind of semantic memory verbatim. It is agent-owned and can be
replaced by the agent, so do not hide the machine baseline in it. Permission
snapshots likewise remain authorization records, not cache storage.

Use synthetic fixtures for this workflow. The historical prompt is evidence,
not permission to operate Birdclaw: do not change its watch, message its workers,
run its tests, touch its PR, merge, deploy, or spend on paid external services.
Deployment needs an explicit receipt/probe if it is to be an observed stop
condition. A PR reader alone cannot establish deployment.

## Proof and finish line

Focused tests should cover the boundary, with fake readers and a counted model
dispatch, rather than tests that merely repeat a hash implementation:

1. After the initial successful observation, ten identical ticks produce **zero
   provider turns**, transcript prompts, packets, or LLM completion evaluations.
2. New head, same-head CI/review edit, report revision, changed worker binding,
   failure/blocker/input, artifact revision, and scope/instruction change each
   remain visible. A -> B -> A wakes again. Stable reordering alone does not.
3. Missing/partial/error observations are visible failures. Recovery still
   delivers a pending change. Busy, failed enqueue, failed/interrupted turn,
   unrelated completion, restart, and deferred dispatch cannot swallow evidence.
4. Manual Run now and ordinary automations behave as before. Existing caps,
   failure stops, authorization and bounded completion duties survive skips.
5. Packing fixtures retain important constraints and exact references. Report
   packet sizes separately from actual avoided execution counts.

Run affected Vitest checks with `bun run test`, then `bun run fmt:check`,
`bun run lint`, and `bun run typecheck`. Run the broader repository suite for
cross-package/lifecycle changes. The current checkout uses Bun 1.4.2:
`/tmp/synara-hub-bun.clqNGR/bun-darwin-aarch64/bun`; the system Bun 1.3.14 cannot
parse this lockfile. Preserve `bun.lock`. Prior full verification passed with
`TZ=UTC` (15,868 passed, 37 skipped); the Pacific run had two unrelated web
day-boundary failures. Report timezone-dependent results honestly.

If a native smoke check is useful, use an isolated home, unused IPv4/IPv6 ports,
and the dev runner's dry-run first. Do not reuse/reset production data or deploy
to make a test pass. Source tests do not prove a live provider or signed release.

Stop and report before broad infrastructure, new durable polling state, generic
prompt inference, removal of unobserved duties, altered authorization, or external
mutation. If the narrow gate is not straightforward with existing readers and
receipts, keep the packing fix and deliver the precise gap; do not substitute a
throttle or silent LLM turn and call the goal achieved. The working estimate is
2-3 focused days, not a requirement to consume that time.

Keep the patch local, on a branch based on the packing commit and this brief.
No push, upstream PR, merge to main, deployment, or provider/account changes.
Report the commit, changed behavior, execution counts, packet sizes, actual
checks, and remaining unverified behavior to the creating thread. A small
reviewable local patch is the deliverable.
