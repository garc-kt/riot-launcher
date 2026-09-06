import { createRouter, createMemoryHistory } from 'vue-router'
import MyStatsView from '@/components/summoner/SummonerCard.vue'
import MatchesView from '@/components/matches/MatchHistoryTable.vue'
import ChampionsView from '@/components/champions/ChampionDeepDive.vue'
import PlayerLookupView from '@/components/summoner/PlayerLookup.vue'
import SettingsView from '@/components/settings/SettingsForm.vue'

const routes = [
  { path: '/', name: 'Stats', component: MyStatsView },
  { path: '/matches', name: 'Matches', component: MatchesView },
  { path: '/champions', name: 'Champions', component: ChampionsView },
  { path: '/lookup/:riotId?', name: 'Lookup', component: PlayerLookupView },
  { path: '/settings', name: 'Settings', component: SettingsView },
]

export const router = createRouter({
  history: createMemoryHistory(),
  routes,
})
