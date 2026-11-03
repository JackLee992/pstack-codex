# Render a statechart

Mermaid text is the default portable artifact. Show the generated `chart.mmd` using the current client's supported Mermaid display, and retain the original text.

If the user needs SVG or an image, inspect the repository's existing renderer and the session's available tools. Use an already installed compatible renderer, retaining its version and the input. Do not install Pele, npm packages, browser binaries, or system tools as a side effect. When rendering dependencies are absent, deliver Mermaid text and state the missing optional capability.

A rendered graph is an explanation of the checked model. Preserve invariant labels, counterexample paths, scope, and hidden-transition notes; do not present it as a trace of the actual device.
