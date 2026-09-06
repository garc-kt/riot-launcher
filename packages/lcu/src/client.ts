import { z } from 'zod'
import { ENDPOINTS } from './endpoints.ts'
import { normalizeSgpRegion } from './sgp.ts'
import {
  SummonerSchema,
  MatchHistoryItemSchema,
  GameVersionSchema,
  GameflowPhaseSchema,
} from './schemas.ts'

export interface LcuBindContext {
  socket?: {
    // The real socket (plugins/src/preload/rcp/socket.ts) delivers a
    // wrapped {data, uri, eventType} envelope, not the raw payload —
    // LcuClient.subscribe() unwraps it before calling registered observers.
    observe: (uri: string, cb: (event: { data: any; uri: string; eventType: string }) => void) => { disconnect(): void } | (() => void)
    disconnect?: (uri: string, listener: (data: any) => void) => void
  }
}

export class LcuRequestError extends Error {
  method: string
  url: string
  status: number | null
  statusText: string
  responseBody: string | null

  constructor(method: string, url: string, message: string, details: { status?: number; statusText?: string; responseBody?: string; cause?: unknown } = {}) {
    super(`[LCU] ${method} ${url}: ${message}`)
    this.name = 'LcuRequestError'
    this.method = method
    this.url = url
    this.status = details.status ?? null
    this.statusText = details.statusText ?? ''
    this.responseBody = details.responseBody ?? null
    if (details.cause) this.cause = details.cause as Error
  }
}

/** Thrown by request methods when a strict-passive module calls out to the
 * LCU during a live match — loud and typed, rather than the request just
 * silently failing or (worse) silently succeeding and doing real work
 * during a game. See packages/contracts PassivePolicy. */
export class PassiveModeError extends Error {
  constructor(method: string, url: string) {
    super(`[LCU] ${method} ${url} blocked: this module is passive during a live match`)
    this.name = 'PassiveModeError'
  }
}

function serializeBody(body: unknown): string | undefined {
  if (body === undefined || body === null) return undefined
  return typeof body === 'string' ? body : JSON.stringify(body)
}

function normalizeUrl(url: string): string {
  if (typeof url !== 'string' || url.length === 0) {
    throw new TypeError('[LCU] Request URL must be a non-empty string')
  }
  return url.startsWith('/') ? url : '/' + url
}

interface RequestOptions {
  headers?: HeadersInit
  body?: BodyInit
}

async function requestLCU<T = any>(method: string, url: string, options: RequestOptions = {}): Promise<T | null> {
  const normalizedUrl = normalizeUrl(url)
  let response: Response

  try {
    response = await fetch(normalizedUrl, {
      method,
      headers: options.headers,
      body: options.body,
    })
  } catch (cause) {
    throw new LcuRequestError(method, normalizedUrl, cause instanceof Error ? cause.message : 'request failed before receiving a response', { cause })
  }

  let responseText = ''
  try {
    responseText = await response.text()
  } catch (cause) {
    throw new LcuRequestError(method, normalizedUrl, 'failed to read response body', {
      status: response.status,
      statusText: response.statusText,
      cause,
    })
  }

  if (!response.ok) {
    const summary = responseText.trim().slice(0, 300)
    const status = `${response.status}${response.statusText ? ` ${response.statusText}` : ''}`
    throw new LcuRequestError(method, normalizedUrl, summary ? `${status} - ${summary}` : status, {
      status: response.status,
      statusText: response.statusText,
      responseBody: responseText,
    })
  }

  if (!responseText) return null
  try {
    return JSON.parse(responseText)
  } catch {
    return responseText as unknown as T
  }
}

interface Subscription {
  ctx: LcuBindContext
  listener: (data: any) => void
  raw: { disconnect(): void } | (() => void)
}

/**
 * LCU REST + event transport, ported from Snooze Manager's Utils.LCU
 * (generalUtils.js:982). Handles the plugin-context rebind case (observers
 * re-subscribe against the new context instead of silently going dead) and
 * isolates one observer's error from every other observer on the same URI
 * — neither of which the companion's original ad-hoc fetch wrapper did.
 */
export class LcuClient {
  private ctx: LcuBindContext | null = null
  private listeners = new Map<string, Set<(data: any) => void | Promise<void>>>()
  private uris = new Set<string>()
  private subscribed = new Set<string>()
  private subscriptions = new Map<string, Subscription>()

  bind(ctx: LcuBindContext) {
    if (this.ctx && this.ctx !== ctx) {
      for (const uri of [...this.subscriptions.keys()]) this.disconnectUri(uri)
      this.subscribed.clear()
      this.subscriptions.clear()
    }
    this.ctx = ctx
    for (const uri of this.uris) this.subscribe(uri)
  }

  unbind() {
    for (const uri of [...this.subscriptions.keys()]) this.disconnectUri(uri)
    this.listeners.clear()
    this.uris.clear()
    this.subscribed.clear()
    this.subscriptions.clear()
    this.ctx = null
  }

  async get<T = any>(url: string): Promise<T | null> {
    return requestLCU<T>('GET', url)
  }

  async getParsed<T>(url: string, schema: z.ZodType<T>): Promise<T> {
    const raw = await this.get(url)
    return schema.parse(raw)
  }

  async post<T = any>(url: string, body?: unknown, options: { headers?: HeadersInit; raw?: boolean } = {}): Promise<T | null> {
    const { headers = {}, raw = false } = options
    const finalHeaders = raw ? headers : { 'Content-Type': 'application/json', ...headers }
    return requestLCU<T>('POST', url, { headers: finalHeaders, body: raw ? (body as BodyInit) : serializeBody(body) })
  }

  async put<T = any>(url: string, body?: unknown): Promise<T | null> {
    return requestLCU<T>('PUT', url, { headers: { 'Content-Type': 'application/json' }, body: serializeBody(body) })
  }

  async patch<T = any>(url: string, body?: unknown): Promise<T | null> {
    return requestLCU<T>('PATCH', url, { headers: { 'Content-Type': 'application/json' }, body: serializeBody(body) })
  }

  async delete<T = any>(url: string): Promise<T | null> {
    return requestLCU<T>('DELETE', url)
  }

  /** Subscribe to an LCU event URI. Returns an unsubscribe function. */
  observe<T = any>(uri: string, cb: (data: T) => void | Promise<void>): () => void {
    if (!this.listeners.has(uri)) this.listeners.set(uri, new Set())
    this.listeners.get(uri)!.add(cb)
    this.uris.add(uri)
    if (this.ctx?.socket) this.subscribe(uri)

    return () => {
      const listeners = this.listeners.get(uri)
      if (!listeners) return
      listeners.delete(cb)
      if (listeners.size === 0) {
        this.listeners.delete(uri)
        this.uris.delete(uri)
        this.disconnectUri(uri)
      }
    }
  }

  private subscribe(uri: string) {
    const ctx = this.ctx
    if (!ctx?.socket) return
    if (this.subscribed.has(uri)) return
    this.subscribed.add(uri)
    const socket = ctx.socket

    // The fork's real socket (plugins/src/preload/rcp/socket.ts) delivers a
    // wrapped {data, uri, eventType} event, not the raw payload — unwrap it
    // here so observe()'s callback signature (data: T) => void, matching
    // Snooze's original LCU.observe contract, is actually honored.
    const listener = (event: any) => {
      if (this.ctx !== ctx) return
      const data = event && typeof event === 'object' && 'data' in event ? event.data : event
      for (const callback of this.listeners.get(uri) || []) {
        try {
          const result = callback(data)
          if (result && typeof (result as Promise<void>).catch === 'function') {
            (result as Promise<void>).catch(err => console.error(`[LCU] Observer callback rejected for ${uri}:`, err))
          }
        } catch (err) {
          console.error(`[LCU] Observer callback failed for ${uri}:`, err)
        }
      }
    }

    let raw: Subscription['raw']
    try {
      raw = socket.observe(uri, listener)
    } catch (err) {
      this.subscribed.delete(uri)
      console.error(`[LCU] Failed to subscribe to ${uri}:`, err)
      return
    }
    this.subscriptions.set(uri, { ctx, listener, raw })
  }

  private disconnectUri(uri: string) {
    const sub = this.subscriptions.get(uri)
    if (!sub) return
    try {
      if (typeof sub.raw === 'function') sub.raw()
      else if (sub.raw && typeof sub.raw.disconnect === 'function') sub.raw.disconnect()
      else sub.ctx.socket?.disconnect?.(uri, sub.listener)
    } catch {
      // best-effort teardown
    }
    this.subscriptions.delete(uri)
    this.subscribed.delete(uri)
  }

  // --- Typed convenience methods over the endpoints/schemas in this package ---

  async getGameVersion(): Promise<string> {
    const raw = await this.get(ENDPOINTS.GAME_VERSION)
    const parsed = GameVersionSchema.safeParse(raw)
    return parsed.success ? parsed.data : '0.0.0'
  }

  async getCurrentSummoner() {
    const raw = await this.get(ENDPOINTS.CURRENT_SUMMONER)
    return SummonerSchema.parse(raw)
  }

  async getMatchHistory(puuid?: string) {
    const url = puuid ? ENDPOINTS.MATCH_HISTORY(puuid) : ENDPOINTS.CURRENT_MATCH_HISTORY()
    const raw = await this.get<{ games?: { games?: unknown[] } }>(url)
    const games = raw?.games?.games || []
    const items = []
    for (const game of games) {
      const normalized = normalizeMatchGame(game)
      const parsed = MatchHistoryItemSchema.safeParse(normalized)
      items.push(parsed.success ? parsed.data : normalized)
    }
    return items
  }

  async getGameflowPhase() {
    const raw = await this.get(ENDPOINTS.GAMEFLOW_PHASE).catch(() => 'None')
    const parsed = GameflowPhaseSchema.safeParse(raw)
    return parsed.success ? parsed.data : 'None'
  }

  async getEntitlements(): Promise<{ token?: string; accessToken?: string }> {
    const raw = await this.get<{ token?: string; accessToken?: string }>(ENDPOINTS.ENTITLEMENTS_TOKEN)
    if (!raw) throw new Error('Failed to retrieve entitlements token')
    return raw
  }

  /**
   * Resolve a Riot ID ("Name#TAG") to a puuid.
   *
   * Every SGP call is keyed by puuid, and the old name-based summoner lookup
   * returns 422 on current patches, so this is the only way a human-typed
   * identifier reaches those APIs.
   */
  async resolveRiotId(gameName: string, tagLine: string): Promise<string | null> {
    const raw = await this.get<{ puuid?: string } | { puuid?: string }[]>(
      ENDPOINTS.ALIAS_LOOKUP(gameName, tagLine),
    )
    // The endpoint has returned both a bare object and a single-element array
    // across patches; accept either rather than depending on which one ships.
    const entry = Array.isArray(raw) ? raw[0] : raw
    const puuid = entry?.puuid
    return typeof puuid === 'string' && puuid.length > 0 ? puuid : null
  }

  /**
   * The account's platform region, normalised to the SGP form ("BR" -> "BR1").
   * Without this, lookups silently default to NA1 and return nothing for
   * everyone who doesn't happen to play there.
   */
  async getRegion(): Promise<string | null> {
    const raw = await this.get<{ region?: string }>(ENDPOINTS.REGION_LOCALE)
    const region = raw?.region
    if (typeof region !== 'string' || !region) return null
    return normalizeSgpRegion(region)
  }
}

/**
 * Reshape a raw LCU game-history entry into the flat MatchHistoryItem
 * shape: the live client returns fully-flat participants, but historical
 * `/lol-match-history` entries nest stats under `stats` and identities
 * under a separate `participantIdentities` array keyed by participantId.
 */
export function normalizeMatchGame(game: any): any {
  if (!game) return game

  if (Array.isArray(game.participants) && game.participants.length > 0 && 'kills' in game.participants[0]) {
    return game
  }

  const identities = new Map<number, any>()
  if (Array.isArray(game.participantIdentities)) {
    for (const identity of game.participantIdentities) {
      if (identity && identity.participantId) {
        identities.set(identity.participantId, identity.player || {})
      }
    }
  }

  const rawParticipants = Array.isArray(game.participants) ? game.participants : []
  const normalizedParticipants = rawParticipants.map((p: any) => {
    const player = identities.get(p.participantId) || {}
    const stats = p.stats || {}
    const items = [stats.item0, stats.item1, stats.item2, stats.item3, stats.item4, stats.item5, stats.item6]
      .filter((it) => typeof it === 'number')

    return {
      puuid: p.puuid || player.puuid || '',
      summonerName: player.summonerName || player.gameName || p.summonerName || '',
      riotIdGameName: player.gameName || p.riotIdGameName,
      riotIdTagline: player.tagLine || p.riotIdTagline,
      championId: p.championId || 0,
      championName: p.championName,
      teamId: p.teamId || (stats.win ? 100 : 200),
      win: Boolean(stats.win ?? p.win),
      kills: Number(stats.kills ?? p.kills ?? 0),
      deaths: Number(stats.deaths ?? p.deaths ?? 0),
      assists: Number(stats.assists ?? p.assists ?? 0),
      goldEarned: Number(stats.goldEarned ?? p.goldEarned ?? 0),
      totalDamageDealtToChampions: Number(stats.totalDamageDealtToChampions ?? p.totalDamageDealtToChampions ?? 0),
      totalMinionsKilled: Number(stats.totalMinionsKilled ?? p.totalMinionsKilled ?? 0),
      neutralMinionsKilled: Number(stats.neutralMinionsKilled ?? p.neutralMinionsKilled ?? 0),
      visionScore: Number(stats.visionScore ?? p.visionScore ?? 0),
      items: items.length > 0 ? items : (p.items || []),
      // A remake reports win:false like a defeat; without this the UI can't
      // tell the two apart. Lives on stats in /lol-match-history payloads.
      gameEndedInEarlySurrender: Boolean(
        stats.gameEndedInEarlySurrender ?? p.gameEndedInEarlySurrender ?? false,
      ),
      spell1Id: p.spell1Id || 0,
      spell2Id: p.spell2Id || 0,
    }
  })

  return { ...game, participants: normalizedParticipants }
}
