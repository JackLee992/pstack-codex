---
name: create-verification-skill
description: Create a project-local Codex skill that launches and drives a real app, CLI, service, or device journey with reproducible evidence and owned cleanup.
disable-model-invocation: true
---

# Create a verification skill

Inspect the repository's real user surface, documented run commands, existing harnesses, evidence outputs, prerequisites, and isolation options. Prefer an existing harness to inventing a new one. Discover startup failures before writing instructions that assume a working app.

Create `.agents/skills/verify-<app>/SKILL.md`, or the user's chosen supported location, with valid `name` and a specific `description`. Use the actual application's name and commands; resolve placeholders before handoff. The skill should cover:

- **Launch:** build/start, readiness that means usable, prerequisites, and teardown.
- **Doctor:** read-only checks for the correct instance, revision, owned port/device, and authorization.
- **Drive:** real stable selectors or commands for the user journey.
- **Evidence:** action and resulting state, observable side effects, exact inputs, and output location.
- **Cleanup:** only processes and state this run owns; preserve evidence after cleanup.
- **Helpers:** executable scripts with documented invocations, only when they improve repeatability.

Seed a small feature map using [the example structure](references/feature-map-example/README.md). Record how each feature is reached, driven, and proven. An unreachable feature needs its prerequisite and attempted route, not a passing label. Do not weaken a journey or change product behavior to match a harness.

Run the generated instructions for one mapped feature when the target and required actions are authorized: launch, doctor, drive, capture, cleanup, then verify that the evidence survives. When the actual target cannot be exercised, label the skill a draft and identify the unverified steps. Do not operate an unrelated live instance or perform an external side effect just to finish the exercise.

Report the concrete coverage and gaps. [Maintain-verification-skill](../maintain-verification-skill/SKILL.md) provides the later upkeep loop; do not create a recurring job without a request.
