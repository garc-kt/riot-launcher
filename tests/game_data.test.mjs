// Shapes here are taken from a live client (patch 16.17): champion-summary.json
// leads with a { id: -1, name: null } sentinel, and item icon paths come back
// mixed-case under /lol-game-data/assets/ASSETS/...

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import {
  indexChampions,
  indexItems,
  parseRiotId,
  looksLikePuuid,
  championIconPath,
  parseChampionDetail,
} from '../packages/lcu/src/game-data.ts'

const CHAMPION_PAYLOAD = [
  { id: -1, name: null, alias: null, roles: [], squarePortraitPath: null },
  {
    id: 1,
    name: 'Annie',
    alias: 'Annie',
    roles: ['mage', 'support'],
    squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/1.png',
  },
  {
    id: 103,
    name: 'Ahri',
    alias: 'Ahri',
    roles: ['mage', 'assassin'],
    squarePortraitPath: '/lol-game-data/assets/v1/champion-icons/103.png',
  },
]

const ITEM_PAYLOAD = [
  { id: 0, name: '', iconPath: '', priceTotal: 0 },
  {
    id: 3020,
    name: "Sorcerer's Shoes",
    iconPath: '/lol-game-data/assets/ASSETS/Items/Icons2D/3020_Class_T2_SorcerersShoes.png',
    priceTotal: 1100,
  },
]

describe('Champion indexing', () => {
  test('drops the id -1 "None" sentinel Riot ships', () => {
    const map = indexChampions(CHAMPION_PAYLOAD)
    assert.equal(map.has(-1), false, 'the sentinel must never be resolvable')
    assert.equal(map.size, 2)
  })

  test('indexes by champion id', () => {
    const map = indexChampions(CHAMPION_PAYLOAD)
    assert.equal(map.get(103).name, 'Ahri')
    assert.deepEqual(map.get(1).roles, ['mage', 'support'])
    assert.equal(map.get(103).squarePortraitPath, '/lol-game-data/assets/v1/champion-icons/103.png')
  })

  test('falls back to the conventional icon path when one is missing', () => {
    const map = indexChampions([{ id: 7, name: 'LeBlanc' }])
    assert.equal(map.get(7).squarePortraitPath, '/lol-game-data/assets/v1/champion-icons/7.png')
    assert.equal(map.get(7).alias, 'LeBlanc')
  })

  test('survives malformed payloads', () => {
    for (const bad of [null, undefined, {}, 'nope', [null, 5, { id: 'x' }, { name: 'no id' }]]) {
      assert.equal(indexChampions(bad).size, 0)
    }
  })
})

describe('Item indexing', () => {
  test('drops item id 0, which means "empty slot" in match payloads', () => {
    const map = indexItems(ITEM_PAYLOAD)
    assert.equal(map.has(0), false)
    assert.equal(map.size, 1)
  })

  test('preserves the mixed-case icon path verbatim', () => {
    // The asset server is case-insensitive; rewriting the case is needless
    // churn and risks breaking on paths that do not round-trip.
    const map = indexItems(ITEM_PAYLOAD)
    assert.equal(
      map.get(3020).iconPath,
      '/lol-game-data/assets/ASSETS/Items/Icons2D/3020_Class_T2_SorcerersShoes.png',
    )
    assert.equal(map.get(3020).priceTotal, 1100)
  })

  test('survives malformed payloads', () => {
    assert.equal(indexItems(undefined).size, 0)
    assert.equal(indexItems([{ id: 1 }]).size, 0, 'an item with no name is unusable')
  })
})

describe('Riot ID parsing', () => {
  test('splits Name#TAG', () => {
    assert.deepEqual(parseRiotId('Garc#4645'), { gameName: 'Garc', tagLine: '4645' })
    assert.deepEqual(parseRiotId('  Garc#4645  '), { gameName: 'Garc', tagLine: '4645' })
  })

  test('splits on the LAST # so names containing one still resolve', () => {
    assert.deepEqual(parseRiotId('a#b#TAG'), { gameName: 'a#b', tagLine: 'TAG' })
  })

  test('rejects anything without a usable tag line', () => {
    for (const bad of ['', '   ', 'Garc', '#4645', 'Garc#', 'Garc#   ']) {
      assert.equal(parseRiotId(bad), null, `${JSON.stringify(bad)} should not parse`)
    }
  })

  test('recognises a real puuid', () => {
    assert.equal(looksLikePuuid('ec1693f9-58dc-54f6-aeff-0810fd93537a'), true)
    assert.equal(looksLikePuuid('Garc#4645'), false)
    assert.equal(looksLikePuuid(''), false)
  })
})

test('championIconPath builds the conventional asset path', () => {
  assert.equal(championIconPath(103), '/lol-game-data/assets/v1/champion-icons/103.png')
})

describe('Champion detail parsing', () => {
  // Shape from a live client: /lol-game-data/assets/v1/champions/103.json
  const DETAIL = {
    id: 103,
    name: 'Ahri',
    title: 'the Nine-Tailed Fox',
    shortBio: 'Innately connected to the magic of the spirit realm...',
    roles: ['mage', 'assassin'],
    passive: {
      name: 'Essence Theft',
      description: 'Ahri gains a stack...',
      abilityIconPath: '/lol-game-data/assets/ASSETS/Characters/Ahri/HUD/Icons2D/Icons_Ahri_Passive.png',
    },
    spells: [
      { spellKey: 'q', name: 'Orb of Deception', description: 'x', abilityIconPath: '/icons/q.png' },
      { spellKey: 'w', name: 'Fox-Fire', description: 'x', abilityIconPath: '/icons/w.png' },
      { spellKey: 'e', name: 'Charm', description: 'x', abilityIconPath: '/icons/e.png' },
      { spellKey: 'r', name: 'Spirit Rush', description: 'x', abilityIconPath: '/icons/r.png' },
    ],
    playstyleInfo: { damage: 3, durability: 1, crowdControl: 2, mobility: 3, utility: 1 },
    // Present but always empty on current patches — verified across many ids.
    recommendedItemDefaults: [],
  }

  test('lists the passive first, then Q/W/E/R', () => {
    const d = parseChampionDetail(DETAIL)
    assert.deepEqual(d.abilities.map(a => a.key), ['passive', 'q', 'w', 'e', 'r'])
    assert.equal(d.abilities[0].name, 'Essence Theft')
    assert.equal(d.abilities[4].name, 'Spirit Rush')
  })

  test('keeps title, bio, roles and playstyle ratings', () => {
    const d = parseChampionDetail(DETAIL)
    assert.equal(d.title, 'the Nine-Tailed Fox')
    assert.deepEqual(d.roles, ['mage', 'assassin'])
    assert.equal(d.playstyle.damage, 3)
    assert.equal(d.playstyle.durability, 1)
  })

  test('tolerates a champion with no passive or spells', () => {
    const d = parseChampionDetail({ id: 7, name: 'LeBlanc' })
    assert.deepEqual(d.abilities, [])
    assert.deepEqual(d.playstyle, {})
    assert.equal(d.title, '')
  })

  test('rejects unusable payloads', () => {
    for (const bad of [null, undefined, {}, { id: -1, name: 'x' }, { id: 1 }, 'nope']) {
      assert.equal(parseChampionDetail(bad), null)
    }
  })
})
