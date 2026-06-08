import { create } from 'zustand'
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type {
  AgentName,
  DecisionReceipt,
  Mode,
  ResearchBrief,
  RunEvent,
} from '@/lib/ats/types'

export type NodeState = 'idle' | 'thinking' | 'done' | 'vetoed'
export type EdgeState = 'idle' | 'active' | 'complete' | 'veto'

export interface AgentNodeData extends Record<string, unknown> {
  agentId: AgentName
  label: string
  roleLabel: string
  processLabel: string
  state: NodeState
  lastOutput: string
  confidence: number | null
  subTasks: { label: string; done: boolean }[]
}

export interface ResearchEdgeData extends Record<string, unknown> {
  status: EdgeState
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'error'
  content: string
  ts: string
  pending?: boolean
  brief?: ResearchBrief | null
}

export interface PendingApproval {
  run_id: string
  decision: 'BUY' | 'SELL'
  size_usd: number
}

const AGENT_META: Record<AgentName, { label: string; roleLabel: string; processLabel: string }> = {
  data: {
    label: 'Data Agent',
    roleLabel: 'Market Intake',
    processLabel: 'Price, volume, and news aggregation',
  },
  regime: {
    label: 'Regime Agent',
    roleLabel: 'Regime Model',
    processLabel: 'Market regime classification',
  },
  signal: {
    label: 'Signal Agent',
    roleLabel: 'Signal Stack',
    processLabel: 'Technical, sentiment, causal, and institutional checks',
  },
  graph: {
    label: 'Graph Agent',
    roleLabel: 'Contagion Map',
    processLabel: 'BTC correlation and contagion analysis',
  },
  risk: {
    label: 'Risk Agent',
    roleLabel: 'Risk Control',
    processLabel: 'Sizing, exposure caps, and veto rules',
  },
  orchestrator: {
    label: 'Orchestrator',
    roleLabel: 'Decision Desk',
    processLabel: 'Consensus and thesis synthesis',
  },
  execution: {
    label: 'Execution Agent',
    roleLabel: '0G Execution',
    processLabel: '0G execution readiness and approval state',
  },
}

const INCOMING_EDGE_IDS: Record<AgentName, string[]> = {
  data: [],
  regime: ['data-regime'],
  signal: ['data-signal'],
  graph: ['data-graph'],
  risk: ['regime-risk', 'signal-risk', 'graph-risk'],
  orchestrator: ['risk-orch'],
  execution: ['orch-exec'],
}

const OUTGOING_EDGE_IDS: Record<AgentName, string[]> = {
  data: ['data-regime', 'data-signal', 'data-graph'],
  regime: ['regime-risk'],
  signal: ['signal-risk'],
  graph: ['graph-risk'],
  risk: ['risk-orch'],
  orchestrator: ['orch-exec'],
  execution: [],
}

function createNode(agentId: AgentName, position: { x: number; y: number }, subTasks: AgentNodeData['subTasks'] = []): Node<AgentNodeData> {
  const meta = AGENT_META[agentId]
  return {
    id: agentId,
    type: 'agentNode',
    position,
    data: {
      agentId,
      label: meta.label,
      roleLabel: meta.roleLabel,
      processLabel: meta.processLabel,
      state: 'idle',
      lastOutput: '',
      confidence: null,
      subTasks,
    },
  }
}

const INITIAL_NODES: Node<AgentNodeData>[] = [
  createNode('data',         { x:  60, y: 360 }),
  createNode('regime',       { x: 420, y:  30 }),
  createNode('signal',       { x: 420, y: 330 }, [
    { label: 'Technical',    done: false },
    { label: 'Sentiment',    done: false },
    { label: 'Causal',       done: false },
    { label: 'Institutional',done: false },
  ]),
  createNode('graph',        { x: 420, y: 720 }),
  createNode('risk',         { x: 780, y: 360 }),
  createNode('orchestrator', { x: 1140, y: 180 }),
  createNode('execution',    { x: 1140, y: 490 }),
]

function edgeVisuals(status: EdgeState) {
  if (status === 'active') {
    return {
      animated: true,
      color: '#8b5cf6',
      width: 2.4,
    }
  }

  if (status === 'complete') {
    return {
      animated: false,
      color: '#34d399',
      width: 2.6,
    }
  }

  if (status === 'veto') {
    return {
      animated: false,
      color: '#f87171',
      width: 2.4,
    }
  }

  return {
    animated: false,
    color: '#4b5563',
    width: 1.6,
  }
}

function styleEdge(edge: Edge<ResearchEdgeData>, status: EdgeState): Edge<ResearchEdgeData> {
  const visuals = edgeVisuals(status)
  return {
    ...edge,
    data: { status },
    animated: visuals.animated,
    style: {
      stroke: visuals.color,
      strokeWidth: visuals.width,
      opacity: status === 'idle' ? 0.65 : 1,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: visuals.color,
      width: 18,
      height: 18,
    },
  }
}

function createEdge(id: string, source: string, target: string): Edge<ResearchEdgeData> {
  return styleEdge(
    {
      id,
      source,
      target,
      type: 'smoothstep',
      data: { status: 'idle' },
    },
    'idle',
  )
}

const INITIAL_EDGES: Edge<ResearchEdgeData>[] = [
  createEdge('data-regime', 'data', 'regime'),
  createEdge('data-signal', 'data', 'signal'),
  createEdge('data-graph', 'data', 'graph'),
  createEdge('regime-risk', 'regime', 'risk'),
  createEdge('signal-risk', 'signal', 'risk'),
  createEdge('graph-risk', 'graph', 'risk'),
  createEdge('risk-orch', 'risk', 'orchestrator'),
  createEdge('orch-exec', 'orchestrator', 'execution'),
]

interface ResearchStore {
  nodes: Node<AgentNodeData>[]
  edges: Edge<ResearchEdgeData>[]
  messages: ChatMessage[]
  currentRun: string | null
  currentTicker: string | null
  currentReceipt: DecisionReceipt | null
  currentBrief: ResearchBrief | null
  mode: Mode
  isRunning: boolean
  receiptOpen: boolean
  pendingApproval: PendingApproval | null
  pendingAssistantMessageId: string | null

  setMode: (mode: Mode) => void
  setReceiptOpen: (open: boolean) => void
  clearPendingApproval: () => void
  addUserMessage: (content: string) => void
  startAssistantDraft: (content?: string) => void
  applyEvent: (evt: RunEvent) => void
  resetRun: () => void
}

function cloneInitialNodes(): Node<AgentNodeData>[] {
  return INITIAL_NODES.map((node) => ({
    ...node,
    data: {
      ...node.data,
      state: 'idle',
      lastOutput: '',
      confidence: null,
      subTasks: node.data.subTasks.map((task) => ({ ...task, done: false })),
    },
  }))
}

function cloneInitialEdges(): Edge<ResearchEdgeData>[] {
  return INITIAL_EDGES.map((edge) => styleEdge(edge, 'idle'))
}

function patchNode(
  nodes: Node<AgentNodeData>[],
  agentId: AgentName,
  patch: Partial<AgentNodeData>,
): Node<AgentNodeData>[] {
  return nodes.map((node) =>
    node.id === agentId ? { ...node, data: { ...node.data, ...patch } } : node,
  )
}

function setEdgeStatus(
  edges: Edge<ResearchEdgeData>[],
  ids: string[],
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return edges.map((edge) => (ids.includes(edge.id) ? styleEdge(edge, status) : edge))
}

function setAgentIncomingStatus(
  edges: Edge<ResearchEdgeData>[],
  agentId: AgentName,
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return setEdgeStatus(edges, INCOMING_EDGE_IDS[agentId], status)
}

function setAgentOutgoingStatus(
  edges: Edge<ResearchEdgeData>[],
  agentId: AgentName,
  status: EdgeState,
): Edge<ResearchEdgeData>[] {
  return setEdgeStatus(edges, OUTGOING_EDGE_IDS[agentId], status)
}

function updateSignalTasks(
  nodes: Node<AgentNodeData>[],
  completedLabels: string[],
  lastOutput: string,
): Node<AgentNodeData>[] {
  return nodes.map((node) => {
    if (node.id !== 'signal') return node
    return {
      ...node,
      data: {
        ...node.data,
        state: 'thinking',
        lastOutput,
        subTasks: node.data.subTasks.map((task) => ({
          ...task,
          done: task.done || completedLabels.some((label) => label.toLowerCase() === task.label.toLowerCase()),
        })),
      },
    }
  })
}

function buildPendingAssistantMessage(content?: string): ChatMessage {
  return {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    content: content ?? 'Six ATS agents are gathering data, scoring the setup, and building the final brief.',
    ts: new Date().toISOString(),
    pending: true,
    brief: null,
  }
}

function buildFinalAssistantMessage(receipt: DecisionReceipt): ChatMessage {
  const brief = receipt.research_brief ?? null
  return {
    id: `assistant_${Date.now()}`,
    role: 'assistant',
    content: brief?.summary ?? `Research complete for ${receipt.ticker}.`,
    ts: new Date().toISOString(),
    pending: false,
    brief,
  }
}

function finalizeAssistantMessage(
  messages: ChatMessage[],
  pendingId: string | null,
  nextMessage: ChatMessage,
): ChatMessage[] {
  if (!pendingId) {
    return [...messages, nextMessage]
  }

  let replaced = false
  const nextMessages = messages.map((message) =>
    message.id === pendingId ? { ...nextMessage, id: message.id } : message,
  )
  replaced = nextMessages.some((message) => message.id === pendingId)
  return replaced ? nextMessages : [...messages, nextMessage]
}

export const useResearchStore = create<ResearchStore>((set) => ({
  nodes: cloneInitialNodes(),
  edges: cloneInitialEdges(),
  messages: [],
  currentRun: null,
  currentTicker: null,
  currentReceipt: null,
  currentBrief: null,
  mode: 'solo',
  isRunning: false,
  receiptOpen: false,
  pendingApproval: null,
  pendingAssistantMessageId: null,

  setMode: (mode) => set({ mode }),
  setReceiptOpen: (open) => set({ receiptOpen: open }),
  clearPendingApproval: () => set({ pendingApproval: null }),

  addUserMessage: (content) => {
    const message: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content,
      ts: new Date().toISOString(),
    }
    set((state) => ({ messages: [...state.messages, message] }))
  },

  startAssistantDraft: (content) =>
    set((state) => {
      const pending = buildPendingAssistantMessage(content)
      return {
        messages: [...state.messages, pending],
        pendingAssistantMessageId: pending.id,
      }
    }),

  resetRun: () =>
    set({
      nodes: cloneInitialNodes(),
      edges: cloneInitialEdges(),
      currentRun: null,
      currentTicker: null,
      currentReceipt: null,
      currentBrief: null,
      isRunning: false,
      receiptOpen: false,
      pendingApproval: null,
      pendingAssistantMessageId: null,
    }),

  applyEvent: (evt) =>
    set((state) => {
      let nodes = state.nodes
      let edges = state.edges
      let isRunning = state.isRunning
      let currentRun = state.currentRun
      let currentTicker = state.currentTicker
      let currentReceipt = state.currentReceipt
      let currentBrief = state.currentBrief
      let receiptOpen = state.receiptOpen
      let pendingApproval = state.pendingApproval
      let pendingAssistantMessageId = state.pendingAssistantMessageId
      let messages = state.messages

      switch (evt.type) {
        case 'run.start': {
          const payloadTicker =
            typeof evt.payload?.ticker === 'string' ? evt.payload.ticker.toUpperCase() : null
          nodes = cloneInitialNodes()
          edges = cloneInitialEdges()
          isRunning = true
          currentRun = evt.run_id
          currentTicker = payloadTicker
          currentReceipt = null
          currentBrief = null
          receiptOpen = false
          pendingApproval = null
          break
        }

        case 'run.done':
          isRunning = false
          pendingApproval = null
          currentRun = evt.run_id
          currentReceipt = evt.receipt ?? state.currentReceipt
          currentBrief = evt.receipt?.research_brief ?? null
          currentTicker = evt.receipt?.ticker ?? state.currentTicker
          receiptOpen = false
          if (evt.receipt) {
            messages = finalizeAssistantMessage(
              messages,
              pendingAssistantMessageId,
              buildFinalAssistantMessage(evt.receipt),
            )
            pendingAssistantMessageId = null
          }
          nodes = patchNode(nodes, 'orchestrator', {
            state: 'done',
            lastOutput: evt.message ?? 'Research brief ready',
            confidence: evt.receipt?.consensus.confidence ?? nodes.find((node) => node.id === 'orchestrator')?.data.confidence ?? null,
          })
          edges = setAgentIncomingStatus(edges, 'orchestrator', 'complete')
          break

        case 'run.error':
          isRunning = false
          pendingApproval = null
          messages = finalizeAssistantMessage(messages, pendingAssistantMessageId, {
            id: `error_${Date.now()}`,
            role: 'error',
            content: evt.message ?? 'Research failed.',
            ts: evt.ts,
            pending: false,
            brief: null,
          })
          pendingAssistantMessageId = null
          break

        case 'agent.thinking':
          if (evt.agent) {
            nodes = patchNode(nodes, evt.agent, {
              state: 'thinking',
              lastOutput: evt.message ?? '',
            })
            if (evt.agent === 'data') {
              edges = setAgentOutgoingStatus(edges, 'data', 'active')
            } else {
              edges = setAgentIncomingStatus(edges, evt.agent, 'active')
            }
          }
          break

        case 'agent.done': {
          if (evt.agent) {
            const confidence =
              typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
            nodes = patchNode(nodes, evt.agent, {
              state: 'done',
              lastOutput: evt.message ?? '',
              confidence,
            })
            edges = setAgentIncomingStatus(edges, evt.agent, 'complete')
            if (evt.agent === 'data' || evt.agent === 'regime' || evt.agent === 'signal' || evt.agent === 'graph') {
              edges = setAgentOutgoingStatus(edges, evt.agent, 'complete')
            }
          }
          break
        }

        case 'agent.vetoed':
          if (evt.agent) {
            nodes = patchNode(nodes, evt.agent, {
              state: 'vetoed',
              lastOutput: evt.message ?? 'Blocked by risk controls',
            })
            edges = setAgentIncomingStatus(edges, evt.agent, 'veto')
            edges = setAgentOutgoingStatus(edges, evt.agent, 'veto')
          }
          break

        case 'agent.data':
          nodes = patchNode(nodes, 'data', {
            state: 'done',
            lastOutput: evt.message ?? 'Fresh market packet ready',
          })
          edges = setAgentOutgoingStatus(edges, 'data', 'complete')
          break

        case 'regime.classified': {
          const confidence =
            typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
          nodes = patchNode(nodes, 'regime', {
            state: 'done',
            lastOutput: evt.message ?? '',
            confidence,
          })
          edges = setAgentIncomingStatus(edges, 'regime', 'complete')
          edges = setAgentOutgoingStatus(edges, 'regime', 'complete')
          break
        }

        case 'signal.update': {
          const submodule = typeof evt.payload?.submodule === 'string' ? evt.payload.submodule : ''
          const completed =
            submodule === 'technical'
              ? ['Technical']
              : submodule === 'llm'
                ? ['Sentiment', 'Causal', 'Institutional']
                : []
          nodes = updateSignalTasks(nodes, completed, evt.message ?? '')
          edges = setAgentIncomingStatus(edges, 'signal', 'active')
          break
        }

        case 'graph.update':
          nodes = patchNode(nodes, 'graph', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'graph', 'active')
          break

        case 'risk.sizing': {
          const vetoTriggered = evt.payload?.veto_triggered === true
          nodes = patchNode(nodes, 'risk', {
            state: vetoTriggered ? 'vetoed' : 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'risk', vetoTriggered ? 'veto' : 'complete')
          edges = setAgentOutgoingStatus(edges, 'risk', vetoTriggered ? 'veto' : 'active')
          break
        }

        case 'consensus.reached': {
          const confidence =
            typeof evt.payload?.confidence === 'number' ? evt.payload.confidence : null
          nodes = patchNode(nodes, 'orchestrator', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
            confidence,
          })
          edges = setAgentIncomingStatus(edges, 'orchestrator', 'active')
          break
        }

        case 'execution.pending': {
          const decision = evt.payload?.decision
          const sizeUsd =
            typeof evt.payload?.size_usd === 'number' ? evt.payload.size_usd : 0
          if (evt.payload?.awaiting_approval === true && (decision === 'BUY' || decision === 'SELL')) {
            pendingApproval = {
              run_id: evt.run_id,
              decision,
              size_usd: sizeUsd,
            }
          }

          nodes = patchNode(nodes, 'execution', {
            state: 'thinking',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'execution', 'active')
          break
        }

        case 'execution.done': {
          const status = typeof evt.payload?.status === 'string' ? evt.payload.status : null
          const blocked = status === 'failed' || status === 'pending_deployment'
          pendingApproval = null
          nodes = patchNode(nodes, 'execution', {
            state: blocked ? 'vetoed' : 'done',
            lastOutput: evt.message ?? '',
          })
          edges = setAgentIncomingStatus(edges, 'execution', blocked ? 'veto' : 'complete')
          break
        }
      }

      return {
        nodes,
        edges,
        messages,
        currentRun,
        currentTicker,
        currentReceipt,
        currentBrief,
        isRunning,
        receiptOpen,
        pendingApproval,
        pendingAssistantMessageId,
      }
    }),
}))
