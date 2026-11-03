---
name: "maintain-verification-skill"
description: "Audit and update an existing project's Codex verification skill and feature map against source changes and authorized real-app journeys."
---

<!-- pstack-codex-runtime -->
Read [the Codex adapter](../../docs/codex.md) once per session before following this skill.
<!-- /pstack-codex-runtime -->

# Maintain a verification skill

Locate the requested project verification skill, usually under `.agents/skills/verify-*/`. When none exists, explain that prerequisite and point to [create-verification-skill](../create-verification-skill/SKILL.md). Read its feature index, harness, current source, and recent relevant changes.

Keep edits within the verification skill, map, and its owned helpers. Distinguish doc drift, harness gaps, and product defects; report product defects without changing product code unless that work is also authorized.

Cover each mapped feature from source. Read-only feature exploration may be delegated when permitted; otherwise do it sequentially. Reconcile the findings against code before editing. One coordinator owns the actual app/device driving so workers do not interfere with a shared instance.

For authorized live checks, follow the verification skill's launch model. Doctor the instance before the first drive and after surprising behavior; reset owned state when necessary. Record each journey's action, outcome, prerequisite, and evidence. Cleanup failed attempts as well as successful ones, preserving proof artifacts. Redrive any journey affected by a harness correction.

Report `clean`, `changed`, or `incomplete`, with feature coverage and exact gaps. Source inspection alone cannot establish real-app coverage. A user-interface pass does not establish backend commit success unless that side effect was checked. Commit, push, or PR creation follows the user's actual request; this maintenance workflow does not create that authorization.
