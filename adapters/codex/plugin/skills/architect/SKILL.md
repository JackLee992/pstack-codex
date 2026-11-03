---
name: architect
description: Design an interface, data shape, ownership boundary, or lifecycle change against the surrounding implementation before committing to a costly code structure.
disable-model-invocation: true
---

# Design a change

Ground the problem with [how](../how/SKILL.md) when the surrounding implementation is not already understood. Identify caller behavior, existing contracts, lifecycle ownership, failure modes, and the constraints that make this decision consequential.

Sketch caller usage first, then the types and interfaces needed to support it. Compare structurally different alternatives only where they resolve a real tradeoff. Use [design red flags](references/design-red-flags.md), the [design brief](references/runner-prompt.md), and [rationale template](references/rationale-template.md). Prefer a small public surface that hides complex coordination and keeps changes correct across layers.

Independent design perspectives can help when delegation is permitted; they are optional, use supported model choices, and do not require a bakeoff or a separate tool plugin. With one agent, compare alternatives directly.

Deliver the requested design. If implementation is also authorized, carry it through with suitable verification. Stop at design when that is the requested scope. An explicit review checkpoint remains binding; ordinary design decisions do not create a new approval gate.

Revisit the design when implementation repeatedly needs incompatible workarounds, not merely because one routine edge case appears. Record the material decision and its validation boundary without leaving intentional broken scaffolding in a finished change.
