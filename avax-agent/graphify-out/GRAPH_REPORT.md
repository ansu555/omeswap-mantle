# Graph Report - /home/anik2003/Documents/omeswap/avax-agent  (2026-04-19)

## Corpus Check
- Corpus is ~22,567 words - fits in a single context window. You may not need a graph.

## Summary
- 184 nodes · 157 edges · 50 communities detected
- Extraction: 85% EXTRACTED · 15% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Backtestrunner Botrunner Canvaspage|Backtestrunner Botrunner Canvaspage]]
- [[_COMMUNITY_Scheduletriggernode Topbar Execute|Scheduletriggernode Topbar Execute]]
- [[_COMMUNITY_Workflowmanager Usestore Listworkflows|Workflowmanager Usestore Listworkflows]]
- [[_COMMUNITY_Variablenode Backtestrunner Fetchhistory|Variablenode Backtestrunner Fetchhistory]]
- [[_COMMUNITY_Chat Crypto Get|Chat Crypto Get]]
- [[_COMMUNITY_Basenode Registry Constructor|Basenode Registry Constructor]]
- [[_COMMUNITY_Home Local Development|Home Local Development]]
- [[_COMMUNITY_Analyzewallet Hooks Index|Analyzewallet Hooks Index]]
- [[_COMMUNITY_Text Line Document|Text Line Document]]
- [[_COMMUNITY_Systemprompt Post Buildsystemprompt|Systemprompt Post Buildsystemprompt]]
- [[_COMMUNITY_Globe Clip Icon|Globe Clip Icon]]
- [[_COMMUNITY_Wordmark Geometry Fill|Wordmark Geometry Fill]]
- [[_COMMUNITY_Vercel Logo Triangle|Vercel Logo Triangle]]
- [[_COMMUNITY_Inlinemarkdown Rendermarkdown Agentsidebar|Inlinemarkdown Rendermarkdown Agentsidebar]]
- [[_COMMUNITY_Chartpanel Onmove Onup|Chartpanel Onmove Onup]]
- [[_COMMUNITY_Configpanel Formatvalue Handlechange|Configpanel Formatvalue Handlechange]]
- [[_COMMUNITY_Addchartmarkernode Execute|Addchartmarkernode Execute]]
- [[_COMMUNITY_Limitordernode Execute|Limitordernode Execute]]
- [[_COMMUNITY_Notificationnode Execute|Notificationnode Execute]]
- [[_COMMUNITY_Swapnode Execute|Swapnode Execute]]
- [[_COMMUNITY_Dexpricenode Execute|Dexpricenode Execute]]
- [[_COMMUNITY_Pricefeednode Execute|Pricefeednode Execute]]
- [[_COMMUNITY_Walletbalancenode Execute|Walletbalancenode Execute]]
- [[_COMMUNITY_Endnode Execute|Endnode Execute]]
- [[_COMMUNITY_Mergenode Execute|Mergenode Execute]]
- [[_COMMUNITY_Startnode Execute|Startnode Execute]]
- [[_COMMUNITY_Accumulatornode Execute|Accumulatornode Execute]]
- [[_COMMUNITY_Conditionnode Execute|Conditionnode Execute]]
- [[_COMMUNITY_Delaynode Execute|Delaynode Execute]]
- [[_COMMUNITY_Mathnode Execute|Mathnode Execute]]
- [[_COMMUNITY_Movingaveragenode Execute|Movingaveragenode Execute]]
- [[_COMMUNITY_Previousvaluenode Execute|Previousvaluenode Execute]]
- [[_COMMUNITY_Thresholdalertnode Execute|Thresholdalertnode Execute]]
- [[_COMMUNITY_Createnodeinstance Registry Swapnode|Createnodeinstance Registry Swapnode]]
- [[_COMMUNITY_Fetchprices Generatechartdata Portfolio|Fetchprices Generatechartdata Portfolio]]
- [[_COMMUNITY_Window Top Bar|Window Top Bar]]
- [[_COMMUNITY_Home|Home]]
- [[_COMMUNITY_Canvaspage|Canvaspage]]
- [[_COMMUNITY_Backtestsummarymodal|Backtestsummarymodal]]
- [[_COMMUNITY_Next Config|Next Config]]
- [[_COMMUNITY_Postcss Config Mjs|Postcss Config Mjs]]
- [[_COMMUNITY_Backtestconfigstrip|Backtestconfigstrip]]
- [[_COMMUNITY_Flowcanvas|Flowcanvas]]
- [[_COMMUNITY_Nodepalette|Nodepalette]]
- [[_COMMUNITY_Toastcontainer|Toastcontainer]]
- [[_COMMUNITY_Basenodecomponent|Basenodecomponent]]
- [[_COMMUNITY_Templates|Templates]]
- [[_COMMUNITY_Tools|Tools]]
- [[_COMMUNITY_Provider|Provider]]
- [[_COMMUNITY_Index|Index]]

## God Nodes (most connected - your core abstractions)
1. `handleRun()` - 7 edges
2. `runBot()` - 6 edges
3. `ScheduleTriggerNode` - 6 edges
4. `Main Route Entrypoints and Layouts` - 6 edges
5. `CanvasPage` - 4 edges
6. `Document File Icon` - 4 edges
7. `executeOnce()` - 3 edges
8. `handleBacktest()` - 3 edges
9. `runBacktest()` - 3 edges
10. `createNodeInstance()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Main Route Entrypoints and Layouts` --references--> `RootLayout()`  [EXTRACTED]
  avax-agent/public/graphify-out/memory/query_20260418_101338_what_are_the_main_route_entrypoints_and_layouts_in.md → avax-agent/app/layout.tsx
- `runBot()` --calls--> `setStatus()`  [INFERRED]
  avax-agent/lib/engine/BotRunner.ts → avax-agent/lib/nodes/BaseNode.ts
- `executeOnce()` --calls--> `runBot()`  [INFERRED]
  avax-agent/components/canvas/TopBar.tsx → avax-agent/lib/engine/BotRunner.ts
- `POST()` --calls--> `buildSystemPrompt()`  [INFERRED]
  avax-agent/app/api/agent/route.ts → avax-agent/lib/agent/systemPrompt.ts
- `handleBacktest()` --calls--> `fetchBinanceHistory()`  [INFERRED]
  avax-agent/components/canvas/TopBar.tsx → avax-agent/lib/backtest/fetchHistory.ts

## Hyperedges (group relationships)
- **Route and Layout Entrypoints** — main_route_entrypoints_layouts, layout_rootlayout, layout_applayout, layout_builderlayout, layout_landinglayout, api_crypto_route_ts, api_agent_chat_route_ts [EXTRACTED 1.00]
- **Live Execution Flow** — canvas_page, topbar_tsx, handle_run, schedule_trigger_node, execute_once, run_bot, botrunner_ts [INFERRED 0.88]
- **Backtest Execution Flow** — handle_backtest, run_backtest, run_bot, backtestrunner_ts [EXTRACTED 1.00]
- **Wallet Analysis Pipeline** — wallet_analysis_panel, hooks_index_ts, use_wallet_analysis, use_wallet_analysis_query, analyze_wallet [EXTRACTED 1.00]
- **Portfolio Page Local Data Pipeline** — portfolio_page, generate_chart_data, fetch_prices [EXTRACTED 1.00]
- **Text Content Group** — file_svg_text_line_top, file_svg_text_line_middle, file_svg_text_line_bottom [INFERRED 0.84]
- **Globe Icon Render Group** — globe_icon, main_path_shape, clip_path_a [EXTRACTED 1.00]
- **Next.js wordmark shape set** — next_svg_path_1, next_svg_path_2, next_svg_root [EXTRACTED 1.00]
- **Vercel Logo Rendering Components** — vercel_svg_asset, vercel_svg_triangle_path, vercel_svg_white_fill, vercel_svg_viewbox_1155_1000 [EXTRACTED 1.00]
- **Window UI Structure** — window_svg_window_icon, window_svg_window_frame, window_svg_window_controls [EXTRACTED 1.00]

## Communities

### Community 0 - "Backtestrunner Botrunner Canvaspage"
Cohesion: 0.16
Nodes (13): BacktestRunner.ts, BotRunner.ts, CanvasPage, ConfigPanel, executeOnce(), FlowCanvas.tsx, handleRun(), NodePalette (+5 more)

### Community 1 - "Scheduletriggernode Topbar Execute"
Cohesion: 0.29
Nodes (4): ScheduleTriggerNode, executeOnce(), getScheduleNode(), handleRun()

### Community 2 - "Workflowmanager Usestore Listworkflows"
Cohesion: 0.2
Nodes (3): listWorkflows(), handleDelete(), handleSave()

### Community 3 - "Variablenode Backtestrunner Fetchhistory"
Cohesion: 0.2
Nodes (6): runBacktest(), runBot(), topologicalSort(), fetchBinanceHistory(), handleBacktest(), VariableNode

### Community 4 - "Chat Crypto Get"
Cohesion: 0.2
Nodes (4): app/api/agent-builder/chat/route.ts, app/api/crypto/route.ts, RootLayout(), Main Route Entrypoints and Layouts

### Community 5 - "Basenode Registry Constructor"
Cohesion: 0.25
Nodes (5): init(), setConfig(), setStatus(), createNodeInstance(), loadFromSession()

### Community 6 - "Home Local Development"
Cohesion: 0.4
Nodes (4): app/page.tsx, Local Development Server, Next.js Starter Project, Vercel Deployment

### Community 7 - "Analyzewallet Hooks Index"
Cohesion: 0.5
Nodes (5): analyzeWallet(), hooks/index.ts, useWalletAnalysis(), useWalletAnalysisQuery(), WalletAnalysisPanel.tsx

### Community 8 - "Text Line Document"
Cohesion: 0.4
Nodes (5): Document File Icon, Folded Corner, Bottom Text Line, Middle Text Line, Top Text Line Block

### Community 9 - "Systemprompt Post Buildsystemprompt"
Cohesion: 0.5
Nodes (2): POST(), buildSystemPrompt()

### Community 10 - "Globe Clip Icon"
Cohesion: 0.67
Nodes (3): Clip Path a, Globe Icon, Main Globe Path Shape

### Community 11 - "Wordmark Geometry Fill"
Cohesion: 0.67
Nodes (4): Fill Color #000, Path 1 (wordmark geometry), Path 2 (wordmark geometry), next.svg root element

### Community 12 - "Vercel Logo Triangle"
Cohesion: 0.5
Nodes (4): Vercel SVG Logo, Triangle Path Shape, ViewBox 1155x1000, White Fill Color (#fff)

### Community 13 - "Inlinemarkdown Rendermarkdown Agentsidebar"
Cohesion: 1.0
Nodes (2): inlineMarkdown(), renderMarkdown()

### Community 14 - "Chartpanel Onmove Onup"
Cohesion: 0.67
Nodes (0): 

### Community 15 - "Configpanel Formatvalue Handlechange"
Cohesion: 0.67
Nodes (0): 

### Community 16 - "Addchartmarkernode Execute"
Cohesion: 0.67
Nodes (1): AddChartMarkerNode

### Community 17 - "Limitordernode Execute"
Cohesion: 0.67
Nodes (1): LimitOrderNode

### Community 18 - "Notificationnode Execute"
Cohesion: 0.67
Nodes (1): NotificationNode

### Community 19 - "Swapnode Execute"
Cohesion: 0.67
Nodes (1): SwapNode

### Community 20 - "Dexpricenode Execute"
Cohesion: 0.67
Nodes (1): DEXPriceNode

### Community 21 - "Pricefeednode Execute"
Cohesion: 0.67
Nodes (1): PriceFeedNode

### Community 22 - "Walletbalancenode Execute"
Cohesion: 0.67
Nodes (1): WalletBalanceNode

### Community 23 - "Endnode Execute"
Cohesion: 0.67
Nodes (1): EndNode

### Community 24 - "Mergenode Execute"
Cohesion: 0.67
Nodes (1): MergeNode

### Community 25 - "Startnode Execute"
Cohesion: 0.67
Nodes (1): StartNode

### Community 26 - "Accumulatornode Execute"
Cohesion: 0.67
Nodes (1): AccumulatorNode

### Community 27 - "Conditionnode Execute"
Cohesion: 0.67
Nodes (1): ConditionNode

### Community 28 - "Delaynode Execute"
Cohesion: 0.67
Nodes (1): DelayNode

### Community 29 - "Mathnode Execute"
Cohesion: 0.67
Nodes (1): MathNode

### Community 30 - "Movingaveragenode Execute"
Cohesion: 0.67
Nodes (1): MovingAverageNode

### Community 31 - "Previousvaluenode Execute"
Cohesion: 0.67
Nodes (1): PreviousValueNode

### Community 32 - "Thresholdalertnode Execute"
Cohesion: 0.67
Nodes (1): ThresholdAlertNode

### Community 33 - "Createnodeinstance Registry Swapnode"
Cohesion: 1.0
Nodes (3): createNodeInstance(), registry.ts, SwapNode

### Community 34 - "Fetchprices Generatechartdata Portfolio"
Cohesion: 0.67
Nodes (1): app/(app)/portfolio/page.tsx

### Community 35 - "Window Top Bar"
Cohesion: 1.0
Nodes (3): Top Bar Control Dots, Window Frame, Window Icon

### Community 36 - "Home"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Canvaspage"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Backtestsummarymodal"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Next Config"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Postcss Config Mjs"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Backtestconfigstrip"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Flowcanvas"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Nodepalette"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Toastcontainer"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Basenodecomponent"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Templates"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Tools"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Provider"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Index"
Cohesion: 1.0
Nodes (0): 

## Knowledge Gaps
- **13 isolated node(s):** `Local Development Server`, `Vercel Deployment`, `NodePalette`, `ConfigPanel`, `ScheduleTriggerNode` (+8 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Home`** (2 nodes): `page.tsx`, `Home()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Canvaspage`** (2 nodes): `page.tsx`, `CanvasPage()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtestsummarymodal`** (2 nodes): `BacktestSummaryModal.tsx`, `BacktestSummaryModal()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Next Config`** (1 nodes): `next.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Postcss Config Mjs`** (1 nodes): `postcss.config.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Backtestconfigstrip`** (1 nodes): `BacktestConfigStrip.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Flowcanvas`** (1 nodes): `FlowCanvas.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Nodepalette`** (1 nodes): `NodePalette.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Toastcontainer`** (1 nodes): `ToastContainer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Basenodecomponent`** (1 nodes): `BaseNodeComponent.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Templates`** (1 nodes): `templates.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Tools`** (1 nodes): `tools.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Provider`** (1 nodes): `provider.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Index`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `runBot()` connect `Variablenode Backtestrunner Fetchhistory` to `Scheduletriggernode Topbar Execute`, `Basenode Registry Constructor`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `setStatus()` connect `Basenode Registry Constructor` to `Variablenode Backtestrunner Fetchhistory`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `loadFromSession()` connect `Basenode Registry Constructor` to `Workflowmanager Usestore Listworkflows`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `handleRun()` (e.g. with `.reset()` and `.shouldContinue()`) actually correct?**
  _`handleRun()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `runBot()` (e.g. with `executeOnce()` and `runBacktest()`) actually correct?**
  _`runBot()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Local Development Server`, `Vercel Deployment`, `NodePalette` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._