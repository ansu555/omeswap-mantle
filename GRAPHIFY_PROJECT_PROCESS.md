# Graphify Process For The Entire Omeswap Project

This repo is too large for a single `graphify` pass at the root, so the reliable way to cover the whole codebase is to run `graphify` in ordered slices, preserve each slice's output, and then create one final synthesis graph from the slice reports.

The structure this process is built around:

- `app/` - main Next.js routes and layouts
- `components/` - the largest surface area, with UI, trade, portfolio, explore, and agent-builder features
- `lib/` - shared logic, agent-builder engine, API helpers, chain config
- `hooks/` - React/Web3 integration layer
- `contracts/` and `scripts/` - on-chain config and Hardhat interaction scripts
- `avax-agent/` - a second app with overlapping agent-builder concepts

## Goal

By the end of this process you will have:

- one archived `graphify` output per major project slice
- one meta-graph that summarizes the whole repo
- a repeatable update loop for future changes

## Ground Rules

1. Run all commands from the repo root: `/home/anik2003/Documents/omeswap`
2. Do not run `graphify` on the repo root again as the main pass; use the root only for inventory and final synthesis.
3. Archive every `graphify-out/` before starting the next slice, otherwise the next run will overwrite the previous outputs.
4. Use `--mode deep` for slices with business logic or duplicated logic across apps.
5. Keep `node_modules/`, `.next/`, `.venv/`, and `.git/` out of scope. `graphify` already avoids unsupported content, but the process below assumes we only target source folders.

## Step 1. Create A Place To Archive Runs

```bash
mkdir -p .graphify-runs
```

Use this pattern after every successful run:

```bash
cp -R graphify-out ".graphify-runs/01-app-shell"
```

Replace `01-app-shell` with the phase name from the steps below.

## Step 2. Do A Root Inventory Only

Use the root once to confirm the corpus shape and top-level hotspots:

```text
/graphify .
```

Because the root is above the threshold, `graphify` will ask for a subfolder. Do not continue the full run at the root. Use that warning as the inventory checkpoint, then move into the phased runs below.

## Step 3. Graph The Main App Shell

First understand routing, layouts, providers, and the UI shell before diving into feature logic.

Run:

```text
/graphify app --mode deep
```

Archive:

```bash
cp -R graphify-out ".graphify-runs/01-app-shell"
```

Then ask:

```text
/graphify query "What are the main route entrypoints and layouts in the app?"
/graphify path "layout" "trade page"
/graphify explain "portfolio page"
```

What this gives you:

- how `app/(landing)`, `app/(app)`, and `app/(builder)` are separated
- where API routes sit relative to UI routes
- which pages matter most before exploring components

## Step 4. Graph Shared UI And Layout Infrastructure

This repo has a very large `components/ui/` surface, plus layout and provider wiring. Cover it as infrastructure rather than mixing it into domain graphs.

Run these in order:

```text
/graphify components/layout --mode deep
/graphify components/providers --mode deep
/graphify components/shared
/graphify components/ui
```

Archive after each run:

```bash
cp -R graphify-out ".graphify-runs/02-layout"
cp -R graphify-out ".graphify-runs/03-providers"
cp -R graphify-out ".graphify-runs/04-shared"
cp -R graphify-out ".graphify-runs/05-ui-kit"
```

Then ask:

```text
/graphify query "Which providers and shared UI primitives are reused across pages?"
/graphify query "What are the core reusable interaction patterns in the UI kit?"
```

What this gives you:

- the app shell dependencies you will see repeated later
- which components are generic primitives versus domain-specific UI

## Step 5. Graph The Trading And On-Chain Execution Slice

This is the most important business flow in the main app. Cover the trading UI, hooks, contracts, and scripts as one investigation track.

Run in this order:

```text
/graphify components/trade --mode deep
/graphify hooks --mode deep
/graphify contracts
/graphify scripts
/graphify lib/chains
```

Archive after each run:

```bash
cp -R graphify-out ".graphify-runs/06-trade-components"
cp -R graphify-out ".graphify-runs/07-hooks"
cp -R graphify-out ".graphify-runs/08-contracts"
cp -R graphify-out ".graphify-runs/09-scripts"
cp -R graphify-out ".graphify-runs/10-chain-config"
```

Then ask:

```text
/graphify query "How does a token swap flow from UI to hook to contract interaction?"
/graphify path "SwapCardDex" "MultiHopSwapRouter"
/graphify path "AddLiquidityCard" "MultiTokenLiquidityPools"
/graphify explain "use-dex-swap"
```

What this gives you:

- the actual trade execution chain
- where approvals, quotes, routing, and liquidity management live
- where frontend intent turns into blockchain calls

## Step 6. Graph Portfolio, Explore, Token, And Analytics Features

These features are spread across several component families but belong to one read-heavy product slice.

Run in this order:

```text
/graphify components/portfolio --mode deep
/graphify components/explore --mode deep
/graphify components/transaction --mode deep
/graphify components/token --mode deep
/graphify components/token-detail --mode deep
/graphify lib/api --mode deep
/graphify app/api --mode deep
```

Archive after each run:

```bash
cp -R graphify-out ".graphify-runs/11-portfolio"
cp -R graphify-out ".graphify-runs/12-explore"
cp -R graphify-out ".graphify-runs/13-transactions"
cp -R graphify-out ".graphify-runs/14-token"
cp -R graphify-out ".graphify-runs/15-token-detail"
cp -R graphify-out ".graphify-runs/16-lib-api"
cp -R graphify-out ".graphify-runs/17-app-api"
```

Then ask:

```text
/graphify query "How does wallet and token analysis data flow from API routes into UI panels?"
/graphify path "wallet analysis" "WalletAnalysisPanel"
/graphify path "token analysis route" "token detail page"
```

What this gives you:

- the read/query side of the product
- which components are driven by API routes versus local client state
- where token analytics and portfolio analytics overlap

## Step 7. Graph The Main Agent-Builder System

This repo has a substantial agent-builder subsystem inside the main app. Treat it as its own platform.

Run in this order:

```text
/graphify components/agent-builder --mode deep
/graphify lib/agent-builder --mode deep
/graphify store --mode deep
/graphify types --mode deep
```

Archive after each run:

```bash
cp -R graphify-out ".graphify-runs/18-agent-builder-components"
cp -R graphify-out ".graphify-runs/19-agent-builder-lib"
cp -R graphify-out ".graphify-runs/20-store"
cp -R graphify-out ".graphify-runs/21-types"
```

Then ask:

```text
/graphify query "What are the core execution flows in the agent builder?"
/graphify path "FlowCanvas" "BotRunner"
/graphify path "node registry" "SwapNode"
/graphify explain "BacktestRunner"
```

What this gives you:

- the canvas/editor architecture
- how nodes are registered, executed, and backtested
- where state, templates, and execution engine meet

## Step 8. Graph The Nested `avax-agent` App As A Separate Product

The nested `avax-agent/` directory is big enough and distinct enough that it deserves its own full pass.

Run:

```text
/graphify avax-agent --mode deep
```

Archive:

```bash
cp -R graphify-out ".graphify-runs/22-avax-agent"
```

Then ask:

```text
/graphify query "What is the architecture of the avax-agent app?"
/graphify path "app/page.tsx" "BotRunner"
/graphify query "Which concepts in avax-agent overlap with the main app's agent-builder?"
```

What this gives you:

- a self-contained graph of the second app
- duplicated or parallel concepts relative to the main app
- a clear boundary between reusable logic and forked logic

## Step 9. Compare The Two Agent Systems Explicitly

After both agent-builder graphs exist, use the archived reports side by side. This is the highest-value cross-check in the repo because both code paths appear to implement similar ideas.

Open these archived reports:

- `.graphify-runs/19-agent-builder-lib/GRAPH_REPORT.md`
- `.graphify-runs/22-avax-agent/GRAPH_REPORT.md`

Use these comparison prompts in the corresponding runs:

```text
/graphify query "What execution concepts appear repeatedly across the agent system?"
/graphify query "Where do workflow manager, node palette, and bot runner connect?"
```

Write down:

- duplicated node types
- duplicated engine logic
- UI concepts that exist in both apps
- opportunities for consolidation

## Step 10. Cover Static Assets And Visual Design Last

There are a small number of images in `public/` and `avax-agent/public/`. These are useful, but only after the code graphs exist.

Run:

```text
/graphify public
/graphify avax-agent/public
```

Archive:

```bash
cp -R graphify-out ".graphify-runs/23-public"
cp -R graphify-out ".graphify-runs/24-avax-agent-public"
```

Use this only to answer questions like:

```text
/graphify query "What product areas and features are represented in the visual assets?"
```

## Step 11. Build A Meta-Graph For The Entire Project

Because the root source tree is too large for a clean single-pass graph, the best way to cover the entire project is to graph the outputs of the slice runs.

Create a synthesis folder:

```bash
mkdir -p graphify-meta
cp README.md graphify-meta/00-root-README.md
cp IMPLEMENTATION_SUMMARY.md graphify-meta/01-implementation-summary.md
cp .graphify-runs/01-app-shell/GRAPH_REPORT.md graphify-meta/10-app-shell-report.md
cp .graphify-runs/05-ui-kit/GRAPH_REPORT.md graphify-meta/11-ui-kit-report.md
cp .graphify-runs/06-trade-components/GRAPH_REPORT.md graphify-meta/12-trade-report.md
cp .graphify-runs/11-portfolio/GRAPH_REPORT.md graphify-meta/13-portfolio-report.md
cp .graphify-runs/18-agent-builder-components/GRAPH_REPORT.md graphify-meta/14-agent-builder-components-report.md
cp .graphify-runs/19-agent-builder-lib/GRAPH_REPORT.md graphify-meta/15-agent-builder-lib-report.md
cp .graphify-runs/22-avax-agent/GRAPH_REPORT.md graphify-meta/16-avax-agent-report.md
cp .graphify-runs/16-lib-api/GRAPH_REPORT.md graphify-meta/17-lib-api-report.md
cp .graphify-runs/17-app-api/GRAPH_REPORT.md graphify-meta/18-app-api-report.md
```

Then graph the synthesis set:

```text
/graphify graphify-meta --mode deep
```

Archive:

```bash
cp -R graphify-out ".graphify-runs/25-meta-project-graph"
```

Then ask:

```text
/graphify query "What are the major systems across the entire project and how do they connect?"
/graphify query "Where do trading, analytics, and agent systems intersect?"
/graphify query "What are the most surprising bridges across the whole repo?"
```

This is the step that turns the slice-by-slice work into one whole-project understanding pass.

## Step 12. Create A Short Final Audit

After the meta-graph is done, summarize the repo in four buckets:

1. Product surfaces
2. Execution paths
3. Shared infrastructure
4. Duplication or refactor opportunities

Use the meta-graph plus the per-slice reports to write one short note with:

- the top 5 god nodes across the project
- the top 3 surprising cross-slice connections
- the top 3 areas that deserve deeper manual review

## Step 13. Use `--update` For Ongoing Maintenance

Once the first pass is complete, do not repeat the full process unless the repo changes dramatically.

Use:

```text
/graphify <slice-path> --update
```

Recommended update policy:

- changed `app/` or route files: update `app`
- changed trade hooks or contract integration: update `components/trade`, `hooks`, `contracts`, or `scripts`
- changed agent-builder logic: update `components/agent-builder`, `lib/agent-builder`, or `avax-agent`
- changed docs or architecture notes: update `graphify-meta`

## Suggested Run Order Summary

Follow this sequence:

1. inventory at root
2. `app`
3. `components/layout`
4. `components/providers`
5. `components/shared`
6. `components/ui`
7. `components/trade`
8. `hooks`
9. `contracts`
10. `scripts`
11. `lib/chains`
12. `components/portfolio`
13. `components/explore`
14. `components/transaction`
15. `components/token`
16. `components/token-detail`
17. `lib/api`
18. `app/api`
19. `components/agent-builder`
20. `lib/agent-builder`
21. `store`
22. `types`
23. `avax-agent`
24. `public`
25. `avax-agent/public`
26. `graphify-meta`

## What To Ignore Until The End

Do not spend early time on these:

- tiny visual assets
- generic UI primitives without clear domain ties
- generated output in `.graphify-runs/` and `graphify-out/`
- build artifacts

Start with entrypoints and business flows first, then circle back to presentation details.

## Best Single Question To Ask After The Whole Process

When all phases are done, ask the meta-graph:

```text
/graphify query "Where does the repo duplicate agent-builder and workflow logic across the main app and avax-agent?"
```

That question is the most likely to reveal real architecture decisions, hidden coupling, and high-value refactor opportunities.
