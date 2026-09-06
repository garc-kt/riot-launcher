/**
 * Static game data (champions, items) from the client's own asset server.
 *
 * These come from /lol-game-data/assets/..., which the client serves on the
 * same origin as the page we're injected into — no Data Dragon, no network
 * egress, and always the exact patch the client is running.
 *
 * Indexing is kept pure and separate from fetching so the shape handling
 * (notably the id === -1 "None" champion Riot ships in champion-summary.json)
 * is covered by tests without a live client — see tests/game_data.test.mjs.
 */

import { ENDPOINTS } from './endpoints.ts'

export interface ChampionInfo {
  id: number
  name: string
  alias: string
  roles: string[]
  /** Root-relative; resolves against the client origin. */
  squarePortraitPath: string
}

export interface ItemInfo {
  id: number
  name: string
  /** Root-relative. Mixed-case as returned; the asset server is case-insensitive. */
  iconPath: string
  priceTotal: number
}

/** Champion icon path for an id, without needing the full summary loaded. */
export function championIconPath(championId: number): string {
  return `/lol-game-data/assets/v1/champion-icons/${championId}.png`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Index champion-summary.json by champion id.
 *
 * Riot's payload leads with a sentinel `{ id: -1, name: null }` entry meaning
 * "no champion"; it must not land in the map or callers resolve nonsense for
 * unpicked/unknown slots.
 */
export function indexChampions(raw: unknown): Map<number, ChampionInfo> {
  const out = new Map<number, ChampionInfo>()
  if (!Array.isArray(raw)) return out

  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const id = entry.id
    const name = entry.name
    if (typeof id !== 'number' || id <= 0) continue
    if (typeof name !== 'string' || name.length === 0) continue

    out.set(id, {
      id,
      name,
      alias: typeof entry.alias === 'string' ? entry.alias : name,
      roles: Array.isArray(entry.roles) ? entry.roles.filter((r): r is string => typeof r === 'string') : [],
      squarePortraitPath:
        typeof entry.squarePortraitPath === 'string' && entry.squarePortraitPath.length > 0
          ? entry.squarePortraitPath
          : championIconPath(id),
    })
  }

  return out
}

/**
 * Index items.json by item id.
 *
 * Item id 0 means "empty slot" in match payloads and is dropped for the same
 * reason as the champion sentinel above.
 */
export function indexItems(raw: unknown): Map<number, ItemInfo> {
  const out = new Map<number, ItemInfo>()
  if (!Array.isArray(raw)) return out

  for (const entry of raw) {
    if (!isRecord(entry)) continue
    const id = entry.id
    const name = entry.name
    if (typeof id !== 'number' || id <= 0) continue
    if (typeof name !== 'string' || name.length === 0) continue

    out.set(id, {
      id,
      name,
      iconPath: typeof entry.iconPath === 'string' ? entry.iconPath : '',
      priceTotal: typeof entry.priceTotal === 'number' ? entry.priceTotal : 0,
    })
  }

  return out
}

/** Split "Name#TAG" into its parts. Returns null when there's no tag line. */
export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const trimmed = (input ?? '').trim()
  const hash = trimmed.lastIndexOf('#')
  if (hash <= 0 || hash === trimmed.length - 1) return null

  const gameName = trimmed.slice(0, hash).trim()
  const tagLine = trimmed.slice(hash + 1).trim()
  if (!gameName || !tagLine) return null

  return { gameName, tagLine }
}

/** Loose PUUID check — Riot uses a canonical UUID here. */
export function looksLikePuuid(input: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((input ?? '').trim())
}

export interface ChampionAbility {
  /** "passive", then "q" | "w" | "e" | "r". */
  key: string
  name: string
  description: string
  iconPath: string
}

export interface ChampionDetail {
  id: number
  name: string
  title: string
  shortBio: string
  roles: string[]
  abilities: ChampionAbility[]
  /** 0-3 ratings Riot ships per champion; absent for some. */
  playstyle: Record<string, number>
}

/**
 * Parse /lol-game-data/assets/v1/champions/{id}.json.
 *
 * Note there is deliberately no build/recommended-items handling: that payload
 * carries `recommendedItemDefaults`, but it comes back empty for every champion
 * on current patches (verified across a spread of ids), and no other client
 * endpoint exposes builds. Abilities are the real, reliable content here.
 */
export function parseChampionDetail(raw: unknown): ChampionDetail | null {
  if (!isRecord(raw)) return null
  const id = raw.id
  const name = raw.name
  if (typeof id !== 'number' || id <= 0) return null
  if (typeof name !== 'string' || !name) return null

  const abilities: ChampionAbility[] = []

  const passive = raw.passive
  if (isRecord(passive) && typeof passive.name === 'string') {
    abilities.push({
      key: 'passive',
      name: passive.name,
      description: typeof passive.description === 'string' ? passive.description : '',
      iconPath: typeof passive.abilityIconPath === 'string' ? passive.abilityIconPath : '',
    })
  }

  if (Array.isArray(raw.spells)) {
    for (const spell of raw.spells) {
      if (!isRecord(spell) || typeof spell.name !== 'string') continue
      abilities.push({
        key: typeof spell.spellKey === 'string' ? spell.spellKey : '',
        name: spell.name,
        description: typeof spell.description === 'string' ? spell.description : '',
        iconPath: typeof spell.abilityIconPath === 'string' ? spell.abilityIconPath : '',
      })
    }
  }

  const playstyle: Record<string, number> = {}
  if (isRecord(raw.playstyleInfo)) {
    for (const [key, value] of Object.entries(raw.playstyleInfo)) {
      if (typeof value === 'number') playstyle[key] = value
    }
  }

  return {
    id,
    name,
    title: typeof raw.title === 'string' ? raw.title : '',
    shortBio: typeof raw.shortBio === 'string' ? raw.shortBio : '',
    roles: Array.isArray(raw.roles) ? raw.roles.filter((r): r is string => typeof r === 'string') : [],
    abilities,
    playstyle,
  }
}

interface GetLike {
  get<T = any>(url: string): Promise<T | null>
}

export async function fetchChampionDetail(lcu: GetLike, championId: number): Promise<ChampionDetail | null> {
  return parseChampionDetail(await lcu.get(`/lol-game-data/assets/v1/champions/${championId}.json`))
}

export async function fetchChampions(lcu: GetLike): Promise<Map<number, ChampionInfo>> {
  return indexChampions(await lcu.get(ENDPOINTS.CHAMPION_SUMMARY))
}

export async function fetchItems(lcu: GetLike): Promise<Map<number, ItemInfo>> {
  return indexItems(await lcu.get(ENDPOINTS.ITEMS))
}
