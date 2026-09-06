import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  fetchChampions,
  fetchItems,
  fetchChampionDetail,
  championIconPath,
  type ChampionInfo,
  type ItemInfo,
  type ChampionDetail,
} from '@riot/lcu'
import { lcuClient } from '@/services/lcu/client'

/**
 * Champion and item metadata, loaded once from the client's own asset server.
 *
 * Match payloads only ever carry numeric ids, so without this every view can
 * do no better than render "Champ #103" and blank icon slots. Both files are
 * static per patch, so they're fetched once and cached for the session; the
 * in-flight promise is cached too, so N components mounting at once share a
 * single request instead of racing.
 */
export const useGameDataStore = defineStore('gameData', () => {
  const champions = ref<Map<number, ChampionInfo>>(new Map())
  const items = ref<Map<number, ItemInfo>>(new Map())
  const loaded = ref(false)
  const failed = ref(false)

  let inFlight: Promise<void> | null = null

  /** Outside the injected client there's no asset server to read from. */
  const isMock = () => typeof window === 'undefined' || !(window as any).__companion_context

  const MOCK_CHAMPIONS: ChampionInfo[] = [
    { id: 103, name: 'Ahri', alias: 'Ahri', roles: ['mage', 'assassin'], squarePortraitPath: championIconPath(103) },
    { id: 238, name: 'Zed', alias: 'Zed', roles: ['assassin'], squarePortraitPath: championIconPath(238) },
    { id: 81, name: 'Ezreal', alias: 'Ezreal', roles: ['marksman'], squarePortraitPath: championIconPath(81) },
  ]

  async function ensureLoaded(): Promise<void> {
    if (loaded.value) return
    if (inFlight) return inFlight

    inFlight = (async () => {
      try {
        if (isMock()) {
          champions.value = new Map(MOCK_CHAMPIONS.map(c => [c.id, c]))
          items.value = new Map()
        } else {
          const [c, i] = await Promise.all([
            fetchChampions(lcuClient.raw),
            fetchItems(lcuClient.raw),
          ])
          champions.value = c
          items.value = i
        }
        loaded.value = true
        failed.value = false
      } catch (err) {
        // Non-fatal: views fall back to ids, which is degraded but readable.
        failed.value = true
        console.warn('[Companion] Could not load champion/item data:', err)
      } finally {
        inFlight = null
      }
    })()

    return inFlight
  }

  /** Display name for a champion id, falling back to the id itself. */
  function championName(championId: number | undefined | null): string {
    if (!championId || championId <= 0) return 'Unknown'
    return champions.value.get(championId)?.name ?? `Champion ${championId}`
  }

  /**
   * Icon URL for a champion id. Built from the id rather than read from the
   * map so icons still render before (or without) the summary loading.
   */
  function championIcon(championId: number | undefined | null): string | null {
    if (!championId || championId <= 0) return null
    return champions.value.get(championId)?.squarePortraitPath ?? championIconPath(championId)
  }

  function item(itemId: number | undefined | null): ItemInfo | null {
    if (!itemId || itemId <= 0) return null
    return items.value.get(itemId) ?? null
  }

  // Champion detail is a ~75 KB payload each, so it's fetched per selection
  // and cached rather than pulled for all 237 up front.
  const details = ref<Map<number, ChampionDetail>>(new Map())
  const detailInFlight = new Map<number, Promise<ChampionDetail | null>>()

  async function loadChampionDetail(championId: number): Promise<ChampionDetail | null> {
    if (!championId || championId <= 0) return null
    const cached = details.value.get(championId)
    if (cached) return cached
    const pending = detailInFlight.get(championId)
    if (pending) return pending

    const request = (async () => {
      try {
        if (isMock()) return null
        const detail = await fetchChampionDetail(lcuClient.raw, championId)
        if (detail) details.value = new Map(details.value).set(championId, detail)
        return detail
      } catch (err) {
        console.warn('[Companion] Could not load champion detail:', err)
        return null
      } finally {
        detailInFlight.delete(championId)
      }
    })()

    detailInFlight.set(championId, request)
    return request
  }

  function championDetail(championId: number | null | undefined): ChampionDetail | null {
    if (!championId) return null
    return details.value.get(championId) ?? null
  }

  function championList(): ChampionInfo[] {
    return [...champions.value.values()].sort((a, b) => a.name.localeCompare(b.name))
  }

  return {
    champions,
    items,
    loaded,
    failed,
    ensureLoaded,
    loadChampionDetail,
    championDetail,
    championName,
    championIcon,
    item,
    championList,
  }
})
