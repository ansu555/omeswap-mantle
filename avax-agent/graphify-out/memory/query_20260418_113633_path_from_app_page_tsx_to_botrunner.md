---
type: "path_query"
date: "2026-04-18T11:36:33.845789+00:00"
question: "Path from app/page.tsx to BotRunner"
contributor: "graphify"
source_nodes: ["page.tsx", "BotRunner.ts"]
---

# Q: Path from app/page.tsx to BotRunner

## Answer

No path is present in the avax-agent graph between the landing page node avax_agent_app_page_tsx and BotRunner. The landing page only connects to Home() and a README reference. The closest execution path encoded by the graph is TopBar.tsx -> executeOnce() -> runBot() -> BotRunner.ts, which suggests the canvas toolbar, not app/page.tsx, is the UI entry point for execution.

## Source Nodes

- page.tsx
- BotRunner.ts