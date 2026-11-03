---
name: "poteto-mode"
description: "Use pstack's evidence-driven engineering workflow in Codex when explicitly requested, with source grounding, narrow changes, and verification proportional to risk."
---

<!-- pstack-codex-runtime -->
Read [the Codex adapter](../../docs/codex.md) once per session before following this skill.
<!-- /pstack-codex-runtime -->

# Poteto mode for Codex

Start from the requested outcome and the smallest useful unit of work. Read the surrounding implementation and repository instructions before choosing a change. Preserve existing contracts and reuse established ownership and lifecycle paths.

- For subsystem understanding, use [how](../how/SKILL.md). For a consequential interface or ownership choice, use [architect](../architect/SKILL.md). A small edit does not need an architecture ceremony.
- When a defect has a cheap meaningful regression target, use [tdd](../tdd/SKILL.md). Missing runtime evidence calls for instrumentation or a bounded reproduction before a speculative fix.
- Use [benchmark-checklist](../benchmark-checklist/SKILL.md) for performance claims. Choose [formal verification](../create-formal-verification-skill/SKILL.md) when event ordering or a bounded state space needs exhaustive checking.
- For a reusable real-app journey, use [create-verification-skill](../create-verification-skill/SKILL.md).

Parallel work is useful when slices are independent and delegation is permitted. Give workers distinct ownership and check their evidence before integration. Respect the selected models and reasoning effort; do not impose a model family or a fixed number of workers. The bundled runtime contract defines capability and authorization handling.

Implement and verify the authorized result through completion. When a test fails, diagnose the first meaningful boundary and repair the cause; do not weaken requirements to get green output. Keep prose direct and report what changed, why, validation, and material gaps. Do not require extra skills, automatic commits, PRs, messages, or persistent setup to use this workflow.
