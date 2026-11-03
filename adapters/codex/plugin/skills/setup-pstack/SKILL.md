---
name: setup-pstack
description: Configure pstack's Codex tool and model-role choices when setting up or checking this workflow; inspect available capabilities and preserve the user's preferences.
---

# Set up pstack for Codex

Inspect the current tool catalog and applicable project instructions. Identify file/terminal tools, optional subagent support, configured model/effort, and any user-specified roles. Do not invoke workers just to test that delegation exists.

Report a short usable plan: who handles design, execution, and verification; the actual available model/effort for each; and any missing capability. Without explicit model preferences, inherit the session configuration. Without permitted subagents, use one agent. A role label is not proof of a model switch.

For statecharts, check for an existing TypeScript-capable runtime, `JAVA`, and `TLA2TOOLS`. Their absence does not block the other workflows. The statechart entrypoint never installs them automatically.

This setup does not modify personal rules, `AGENTS.md`, Codex configuration, enabled plugins, or skill directories. If the user requests persistent project preferences, write only the agreed project file and document its intended reader. Installing or enabling this plugin is a separate user action. Apply the bundled runtime contract.
