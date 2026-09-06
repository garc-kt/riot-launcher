/**
 * Classify a match outcome for display.
 *
 * A remake reports `win: false` exactly like a real defeat, so reading `win`
 * alone paints remakes red and makes a history of aborted games look like a
 * losing streak. The early-surrender flag has to be checked first.
 */

export type MatchResult = 'victory' | 'defeat' | 'remake'

export interface MatchResultInput {
  win?: boolean
  gameEndedInEarlySurrender?: boolean
}

export function matchResult(participant: MatchResultInput | null | undefined): MatchResult {
  if (!participant) return 'defeat'
  if (participant.gameEndedInEarlySurrender) return 'remake'
  return participant.win ? 'victory' : 'defeat'
}

export const MATCH_RESULT_LABEL: Record<MatchResult, string> = {
  victory: 'VICTORY',
  defeat: 'DEFEAT',
  remake: 'REMAKE',
}

/** Token-backed text colour per outcome. */
export const MATCH_RESULT_COLOR: Record<MatchResult, string> = {
  victory: 'var(--success)',
  defeat: 'var(--destructive)',
  remake: 'var(--neutral)',
}

export interface ChampionItemUsage {
  itemId: number
  /** How many of the player's games on this champion ended with the item. */
  games: number
}

interface MatchLike {
  participants?: { puuid?: string; championId?: number; items?: number[] }[]
}

/**
 * Most-built items on a champion, from the player's own completed games.
 *
 * The client exposes no recommended builds (`recommendedItemDefaults` is empty
 * on every champion), so this is derived from real history instead of showing
 * a constant dressed up as a recommendation. Trinkets are kept — they're a
 * genuine choice — but empty slots (id 0) are not items and are dropped.
 *
 * Ids are counted once per game, so a duplicated slot can't inflate a rank.
 */
export function championItemUsage(
  matches: MatchLike[] | null | undefined,
  championId: number,
  puuid?: string,
  limit = 6,
): ChampionItemUsage[] {
  if (!Array.isArray(matches) || !championId || championId <= 0) return []

  const counts = new Map<number, number>()
  let games = 0

  for (const match of matches) {
    const participants = match?.participants
    if (!Array.isArray(participants)) continue

    const mine = puuid
      ? participants.find(p => p?.puuid === puuid && p?.championId === championId)
      : participants.find(p => p?.championId === championId)
    if (!mine || !Array.isArray(mine.items)) continue

    games++
    for (const itemId of new Set(mine.items)) {
      if (typeof itemId !== 'number' || itemId <= 0) continue
      counts.set(itemId, (counts.get(itemId) ?? 0) + 1)
    }
  }

  if (games === 0) return []

  return [...counts.entries()]
    .map(([itemId, n]) => ({ itemId, games: n }))
    // Ties broken by id so the order is stable across renders.
    .sort((a, b) => b.games - a.games || a.itemId - b.itemId)
    .slice(0, limit)
}
