/**
 * Ported from Snooze Manager (github.com/ReformedDoge/Snooze-Manager)
 * Original author: SnoozeFest - github@ReformedDoge
 * Kept in personal/ workspace for personal use only under the project's licensing policy.
 *
 * Performance scoring utility — normalizes player stats from different sources
 * and computes z-score rated performance (1-10 scale).
 */

export interface NormalizedPlayerStats {
  puuid: string
  kills: number
  deaths: number
  assists: number
  damage: number
  gold: number
  cs: number
  vision?: number
  healing?: number
  tanking?: number
  win: boolean
  teamId: number
  championName?: string
}

export interface PlayerScoreSummary {
  score: number
  kda: string
  kills: number
  deaths: number
  assists: number
  _scoreRatio: number
}

function mmNorm(arr: number[]): number[] {
  const mn = Math.min(...arr)
  const mx = Math.max(...arr)
  const rng = mx - mn || 1e-6
  return arr.map((v) => (v - mn) / rng)
}

export const Scoring = {
  normalizeEogStats(eogStats: any): NormalizedPlayerStats[] {
    const players: NormalizedPlayerStats[] = []
    for (const team of eogStats?.teams || []) {
      for (const p of team.players || []) {
        const s = p.stats || {}
        players.push({
          puuid: p.puuid,
          kills: s.CHAMPIONS_KILLED || 0,
          deaths: s.NUM_DEATHS || 0,
          assists: s.ASSISTS || 0,
          damage: s.TOTAL_DAMAGE_DEALT_TO_CHAMPIONS || 0,
          gold: s.GOLD_EARNED || 0,
          cs: (s.MINIONS_KILLED || 0) + (s.NEUTRAL_MINIONS_KILLED || 0),
          vision: s.VISION_SCORE || 0,
          healing: (s.TOTAL_HEAL_ON_TEAMMATES || 0) + (s.TOTAL_DAMAGE_SHIELDED_ON_TEAMMATES || 0),
          tanking: (s.TOTAL_DAMAGE_TAKEN || 0) + (s.TOTAL_DAMAGE_SELF_MITIGATED || 0),
          win: Boolean(s.WIN),
          teamId: team.teamId,
          championName: p.championName || p.championId,
        })
      }
    }
    return players
  },

  normalizeParticipants(participants: any[]): NormalizedPlayerStats[] {
    return (participants || []).map((p) => ({
      puuid: p.puuid,
      kills: p.kills || 0,
      deaths: p.deaths || 0,
      assists: p.assists || 0,
      damage: p.totalDamageDealtToChampions || 0,
      gold: p.goldEarned || 0,
      cs: (p.totalMinionsKilled || 0) + (p.neutralMinionsKilled || 0),
      healing: (p.totalHealsOnTeammates || 0) + (p.totalDamageShieldedOnTeammates || 0),
      tanking: (p.totalDamageTaken || 0) + (p.damageSelfMitigated || 0),
      win: Boolean(p.win),
      teamId: p.teamId,
      championName: p.championName || p.championId,
    }))
  },

  computeScores(players: NormalizedPlayerStats[]): Map<string, PlayerScoreSummary> {
    return this._compute(players).scores
  },

  computeScoresDetailed(players: NormalizedPlayerStats[]) {
    return this._compute(players)
  },

  _compute(players: NormalizedPlayerStats[]) {
    if (!players?.length) return { scores: new Map<string, PlayerScoreSummary>(), entries: [] }

    const gameDmg = players.reduce((s, p) => s + p.damage, 0) || 1
    const gameGold = players.reduce((s, p) => s + p.gold, 0) || 1

    const teamKills: Record<number, number> = {}
    players.forEach((p) => {
      teamKills[p.teamId] = (teamKills[p.teamId] || 0) + p.kills
    })

    const entries = players.map((p) => {
      const kda = (p.kills + p.assists) / Math.max(1, p.deaths)
      const kdaNorm = kda / (kda + 4)
      const tk = teamKills[p.teamId] || 1
      const kp = (p.kills + p.assists) / tk
      const killShare = p.kills / tk
      const dmgFrac = p.damage / gameDmg
      const healFrac = (p.healing || 0) / gameDmg
      const tankFrac = (p.tanking || 0) / gameDmg

      return {
        puuid: p.puuid,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        kda,
        kdaNorm,
        kp,
        killShare,
        dmg: p.damage,
        gold: p.gold,
        cs: p.cs,
        vision: p.vision || 0,
        healing: p.healing || 0,
        tanking: p.tanking || 0,
        win: p.win,
        teamId: p.teamId,
        championName: p.championName,
        dmgFrac,
        healFrac,
        tankFrac,
      }
    })

    const kdaN = mmNorm(entries.map((e) => e.kdaNorm))
    const kpN = mmNorm(entries.map((e) => e.kp))
    const killN = mmNorm(entries.map((e) => e.killShare))
    const dmgN = mmNorm(entries.map((e) => e.dmg))
    const goldN = mmNorm(entries.map((e) => e.gold))

    const composites = entries.map((e, i) => {
      const hasRoleData = e.healFrac !== undefined || e.tankFrac !== undefined
      let composite: number

      if (hasRoleData && e.healFrac > 0.04) {
        const healN = mmNorm(entries.map((x) => x.healFrac))[i]
        composite = kdaN[i] * 0.2 + kpN[i] * 0.3 + healN * 0.25 + dmgN[i] * 0.1 + goldN[i] * 0.15
      } else if (hasRoleData && e.tankFrac > 0.12 && e.dmgFrac < 0.1) {
        const tankN = mmNorm(entries.map((x) => x.tankFrac))[i]
        composite = kdaN[i] * 0.25 + kpN[i] * 0.25 + tankN * 0.15 + dmgN[i] * 0.15 + goldN[i] * 0.2
      } else {
        composite = kdaN[i] * 0.25 + kpN[i] * 0.2 + killN[i] * 0.15 + dmgN[i] * 0.25 + goldN[i] * 0.15
      }

      return composite
    })

    const mean = composites.reduce((a, b) => a + b, 0) / composites.length
    const std = Math.sqrt(composites.reduce((a, v) => a + (v - mean) ** 2, 0) / composites.length) || 1e-6

    const rawScores = entries.map((e, i) => {
      const z = (composites[i] - mean) / std
      let score = 5.5 + z * 1.5 + (e.win ? 0.5 : -0.5)
      score = Math.max(1.0, Math.min(10.0, Math.round(score * 10) / 10))
      return { puuid: e.puuid, score, z, composite: composites[i] }
    })

    const scoreVals = rawScores.map((s) => s.score)
    const minScore = Math.min(...scoreVals)
    const maxScore = Math.max(...scoreVals)
    const range = maxScore - minScore || 1

    const result = new Map<string, PlayerScoreSummary>()
    entries.forEach((e, i) => {
      const s = rawScores[i]
      result.set(s.puuid, {
        score: s.score,
        kda: e.kda.toFixed(1),
        kills: e.kills,
        deaths: e.deaths,
        assists: e.assists,
        _scoreRatio: (s.score - minScore) / range,
      })
    })

    return { scores: result, entries }
  },
}
