/**
 * ATS LLM Client — thin OpenRouter wrapper
 *
 * Exports:
 *   callLLM(opts)       — single-shot text completion
 *   callLLMJson<T>(opts) — single-shot JSON completion (parsed)
 *   streamLLM(opts)     — streaming text completion (async generator of delta chunks)
 *
 * API key resolution order (highest priority first):
 *   1. User's key stored encrypted in `user_settings` (decrypted on-the-fly)
 *   2. OPENROUTER_API_KEY env var (fallback / server key)
 *   3. Throws at call-time if neither is available
 *
 * Model resolution order:
 *   1. Explicit `model` argument on the call
 *   2. User's model stored in `user_settings`
 *   3. DEFAULT_MODEL constant below
 *
 * This module is server-only — it imports from Node-only helpers
 * (lib/agent-wallet/crypto, lib/supabase/server).
 */

import OpenAI from 'openai'
import type OpenAITypes from 'openai'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { decrypt } from '@/lib/agent-wallet/crypto'

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite'

/** Models available in the AgentSettingsCard dropdown */
export const AVAILABLE_MODELS = [
  'anthropic/claude-sonnet-4-5',
  'google/gemini-2.5-flash-lite',
  'openai/gpt-4o',
  'qwen/qwen3-8b',
  'meta-llama/llama-4-maverick',
] as const

export type AvailableModel = (typeof AVAILABLE_MODELS)[number]

// ── Public types ──────────────────────────────────────────────────────────────

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMCallOptions {
  messages: LLMMessage[]
  /** Override the resolved model */
  model?: string
  /** Wallet address used to load the user's stored API key + model */
  userWallet?: string
  temperature?: number
  maxTokens?: number
  /** Force JSON response format (model must support it) */
  jsonMode?: boolean
}

// ── Internal helpers ──────────────────────────────────────────────────────────

interface UserLLMConfig {
  apiKey: string | null
  model: string | null
}

async function loadUserConfig(userWallet: string): Promise<UserLLMConfig> {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('user_settings')
      .select('api_key_ct, api_key_iv, api_key_tag, model')
      .eq('user_wallet', userWallet.toLowerCase())
      .maybeSingle()

    if (error || !data) return { apiKey: null, model: null }

    let apiKey: string | null = null
    if (data.api_key_ct && data.api_key_iv && data.api_key_tag) {
      try {
        apiKey = decrypt({
          ct: data.api_key_ct as string,
          iv: data.api_key_iv as string,
          tag: data.api_key_tag as string,
        })
      } catch {
        // Decryption failed — treat as no key
      }
    }

    return { apiKey, model: (data.model as string) ?? null }
  } catch {
    return { apiKey: null, model: null }
  }
}

function buildClient(apiKey: string): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'X-Title': 'Omega ATS',
    },
  })
}

async function resolveKeyAndModel(
  opts: LLMCallOptions,
): Promise<{ apiKey: string; model: string }> {
  let apiKey: string | null = null
  let model: string = opts.model ?? DEFAULT_MODEL

  if (opts.userWallet) {
    const cfg = await loadUserConfig(opts.userWallet)
    if (cfg.apiKey) apiKey = cfg.apiKey
    if (!opts.model && cfg.model) model = cfg.model
  }

  if (!apiKey) {
    apiKey =
      process.env.OPENROUTER_API_KEY ??
      process.env.OPEN_ROUTER_API_KEY ??
      null
  }

  if (!apiKey) {
    throw new Error(
      'No OpenRouter API key available. Set OPENROUTER_API_KEY in .env.local ' +
        'or add one in Portfolio → Agent Settings.',
    )
  }

  return { apiKey, model }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Single-shot LLM call. Returns the full response text.
 *
 * @example
 *   const text = await callLLM({
 *     messages: [{ role: 'user', content: 'What is the RSI of BTC?' }],
 *     userWallet: '0xabc...',
 *   })
 */
export async function callLLM(opts: LLMCallOptions): Promise<string> {
  const { apiKey, model } = await resolveKeyAndModel(opts)
  const client = buildClient(apiKey)

  const params: OpenAITypes.Chat.ChatCompletionCreateParamsNonStreaming = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 1500,
  }

  if (opts.jsonMode) {
    params.response_format = { type: 'json_object' }
  }

  const completion = await client.chat.completions.create(params)
  return completion.choices[0]?.message?.content ?? ''
}

/**
 * Single-shot LLM call that parses the response as JSON.
 * Uses jsonMode so the model is constrained to valid JSON output.
 *
 * @example
 *   const result = await callLLMJson<{ sentiment: number }>({
 *     messages,
 *     userWallet,
 *   })
 */
export async function callLLMJson<T = unknown>(opts: LLMCallOptions): Promise<T> {
  const text = await callLLM({ ...opts, jsonMode: true })
  return JSON.parse(text) as T
}

/**
 * Streaming LLM call. Yields text delta chunks as they arrive from OpenRouter.
 *
 * @example
 *   for await (const chunk of streamLLM({ messages, userWallet })) {
 *     process.stdout.write(chunk)
 *   }
 */
export async function* streamLLM(opts: LLMCallOptions): AsyncGenerator<string> {
  const { apiKey, model } = await resolveKeyAndModel(opts)
  const client = buildClient(apiKey)

  const stream = await client.chat.completions.create({
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.3,
    max_tokens: opts.maxTokens ?? 2000,
    stream: true,
  })

  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content
    if (delta) yield delta
  }
}
