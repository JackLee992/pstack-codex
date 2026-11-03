---
name: "how"
description: "Explain an existing subsystem's architecture, runtime flow, ownership, and integration points from source evidence before a change or during onboarding."
---

<!-- pstack-codex-runtime -->
Read [the Codex adapter](../../docs/codex.md) once per session before following this skill.
<!-- /pstack-codex-runtime -->

# Explain how a subsystem works

Define the scope from the user's question, inspect its entrypoints, and trace the data and lifecycle through the actual implementation. Use [explorer guidance](references/explorer-prompt.md) for evidence collection and [explainer guidance](references/explainer-prompt.md) to synthesize it.

For a narrow question, inspect and explain directly. For a cross-cutting subsystem, divide it into useful angles. Delegate read-only exploration only when allowed and useful; otherwise cover those angles sequentially. Each worker needs the actual revision, scope, paths, and the evidence to return. Do not require a particular model or spawn an explainer for a one-function question.

Explain the main flow, ownership, state transitions, integration seams, and relevant failure handling. Cite concrete files and symbols. Mark assumptions and missing runtime evidence. Adjust detail to the reader; source listings are not an explanation. Keep the requested read-only boundary unless implementation was also requested.
