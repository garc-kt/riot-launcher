import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { LcuClient, getSgpContext, SGP_REGIONS } from '../packages/lcu/src/index.ts'

/** Minimal mock of the fork's real socket (plugins/src/preload/rcp/socket.ts):
 * delivers a wrapped {data, uri, eventType} envelope, not the raw payload. */
function createMockSocket() {
  const subs = new Map()
  return {
    observe(uri, cb) {
      if (!subs.has(uri)) subs.set(uri, new Set())
      subs.get(uri).add(cb)
      return { disconnect: () => subs.get(uri)?.delete(cb) }
    },
    emit(uri, data) {
      for (const cb of subs.get(uri) || []) {
        cb({ data, uri, eventType: 'Update' })
      }
    },
    activeCount(uri) {
      return subs.get(uri)?.size || 0
    },
  }
}

describe('LcuClient — event subscription (observe/bind)', () => {
  test('observe() receives the unwrapped payload, not the {data,uri,eventType} envelope', () => {
    const client = new LcuClient()
    const socket = createMockSocket()
    client.bind({ socket })

    let received
    client.observe('/lol-gameflow/v1/gameflow-phase', (phase) => { received = phase })
    socket.emit('/lol-gameflow/v1/gameflow-phase', 'ChampSelect')

    assert.equal(received, 'ChampSelect')
  })

  test('multiple observers on the same URI all fire, independently', () => {
    const client = new LcuClient()
    const socket = createMockSocket()
    client.bind({ socket })

    const calls = []
    client.observe('/x', () => calls.push('a'))
    client.observe('/x', () => calls.push('b'))
    socket.emit('/x', {})

    assert.deepEqual(calls.sort(), ['a', 'b'])
  })

  test('one observer throwing does not prevent the others from running', () => {
    const client = new LcuClient()
    const socket = createMockSocket()
    client.bind({ socket })

    const calls = []
    client.observe('/x', () => { throw new Error('boom') })
    client.observe('/x', () => calls.push('ok'))
    socket.emit('/x', {})

    assert.deepEqual(calls, ['ok'])
  })

  test('unsubscribe stops further callbacks and disconnects once the last listener leaves', () => {
    const client = new LcuClient()
    const socket = createMockSocket()
    client.bind({ socket })

    let count = 0
    const unsub = client.observe('/x', () => { count++ })
    socket.emit('/x', {})
    assert.equal(count, 1)

    unsub()
    assert.equal(socket.activeCount('/x'), 0)
    socket.emit('/x', {})
    assert.equal(count, 1, 'no further callbacks after unsubscribe')
  })

  test('observing before bind() queues the URI and subscribes once a context arrives', () => {
    const client = new LcuClient()
    let received
    client.observe('/x', (data) => { received = data })

    const socket = createMockSocket()
    client.bind({ socket })
    socket.emit('/x', 'late-bound')

    assert.equal(received, 'late-bound')
  })

  test('rebinding to a new context re-subscribes observers against the new socket', () => {
    const client = new LcuClient()
    const socketA = createMockSocket()
    const socketB = createMockSocket()

    let received
    client.bind({ socket: socketA })
    client.observe('/x', (data) => { received = data })

    client.bind({ socket: socketB })
    socketA.emit('/x', 'stale')
    assert.equal(received, undefined, 'events from the old socket after rebind must not fire')

    socketB.emit('/x', 'fresh')
    assert.equal(received, 'fresh')
  })

  test('unbind() clears all subscriptions and listeners', () => {
    const client = new LcuClient()
    const socket = createMockSocket()
    client.bind({ socket })
    client.observe('/x', () => {})
    assert.equal(socket.activeCount('/x'), 1)

    client.unbind()
    assert.equal(socket.activeCount('/x'), 0)
  })
})

describe('SGP region table', () => {
  test('uses the working -red hostnames, not the non-functional -blue-1 ones', () => {
    assert.ok(SGP_REGIONS.includes('NA1'))
    assert.ok(SGP_REGIONS.includes('EUW'))
    // The bug this replaced used na-blue-1.lol.sgp.pvp.net, which does not
    // resolve to a working SGP endpoint.
    assert.ok(!SGP_REGIONS.some(r => r.includes('blue')))
  })

  test('getSgpContext resolves matchHistoryBase/commonBase for an overridden region', async () => {
    const stubLcu = { get: async () => null }
    const ctx = await getSgpContext(stubLcu, 'KR')
    assert.equal(ctx.commonBase, 'https://kr-red.lol.sgp.pvp.net')
    assert.equal(ctx.matchHistoryBase, 'https://apne1-red.pp.sgp.pvp.net')
    assert.equal(ctx.sgpBase, ctx.matchHistoryBase)
  })

  test('falls back to EUW endpoints for an unrecognized region with no Tencent issuer', async () => {
    const stubLcu = { get: async () => null }
    const ctx = await getSgpContext(stubLcu, 'NOT_A_REAL_REGION')
    assert.equal(ctx.commonBase, 'https://euw-red.lol.sgp.pvp.net')
  })

  test('caches the context per region and does not re-fetch within the TTL', async () => {
    let calls = 0
    const stubLcu = { get: async () => { calls++; return null } }
    await getSgpContext(stubLcu, 'BR1')
    await getSgpContext(stubLcu, 'BR1')
    // One entitlements-token fetch for the first call; the second call is
    // served from the 5-minute cache and must not fetch again.
    assert.equal(calls, 1)
  })
})
