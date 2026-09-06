export const ENDPOINTS = {
  GAME_VERSION: '/lol-patch/v1/game-version',
  REGION_LOCALE: '/riotclient/region-locale',
  CURRENT_SUMMONER: '/lol-summoner/v1/current-summoner',
  SUMMONER_BY_PUUID: (puuid: string) => `/lol-summoner/v2/summoners/puuid/${puuid}`,
  MATCH_HISTORY: (puuid: string, begIndex = 0, endIndex = 20) =>
    `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=${begIndex}&endIndex=${endIndex}`,
  CURRENT_MATCH_HISTORY: (begIndex = 0, endIndex = 20) =>
    `/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${begIndex}&endIndex=${endIndex}`,
  GAMEFLOW_PHASE: '/lol-gameflow/v1/gameflow-phase',
  CHAMP_SELECT_SESSION: '/lol-champ-select/v1/session',
  CHAMPIONS: (summonerId: number) => `/lol-champions/v1/inventories/${summonerId}/champions`,
  CHAMPION_SUMMARY: '/lol-game-data/assets/v1/champion-summary.json',
  ENTITLEMENTS_TOKEN: '/entitlements/v1/token',
} as const
