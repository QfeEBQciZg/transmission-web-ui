import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getHandshakeRpcVersion, resetHandshake, rpcCall, RpcError } from '../api/rpc'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

function handshakeResponse(sessionId: string, rpcVersion?: string): Response {
  const headers: Record<string, string> = { 'X-Transmission-Session-Id': sessionId }
  if (rpcVersion) headers['X-Transmission-Rpc-Version'] = rpcVersion
  return new Response('Conflict', { status: 409, headers })
}

function lastCallHeaders(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  const init = fetchMock.mock.calls[callIndex][1] as { headers: Record<string, string> }
  return init.headers
}

describe('rpc client', () => {
  beforeEach(() => {
    resetHandshake()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('replays the request once after a 409 handshake and returns the result', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(handshakeResponse('sess-1', '6.0.0'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: { ok: true }, id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await rpcCall<{ ok: boolean }>('session_get')

    expect(result.ok).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(lastCallHeaders(fetchMock, 1)['X-Transmission-Session-Id']).toBe('sess-1')
    expect(getHandshakeRpcVersion()).toBe('6.0.0')
  })

  it('sends the captured session id on subsequent requests without re-handshaking', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(handshakeResponse('sess-2', '6.1.0'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {}, id: 1 }))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {}, id: 2 }))
    vi.stubGlobal('fetch', fetchMock)

    await rpcCall('session_get')
    await rpcCall('session_stats')

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(lastCallHeaders(fetchMock, 2)['X-Transmission-Session-Id']).toBe('sess-2')
  })

  it('re-handshakes and replays when the daemon expires the token mid-session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(handshakeResponse('sess-old', '6.0.0'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: {}, id: 1 }))
      .mockResolvedValueOnce(handshakeResponse('sess-new', '6.0.0'))
      .mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', result: { ok: true }, id: 2 }))
    vi.stubGlobal('fetch', fetchMock)

    await rpcCall('session_get')
    const result = await rpcCall<{ ok: boolean }>('session_stats')

    expect(result.ok).toBe(true)
    expect(lastCallHeaders(fetchMock, 3)['X-Transmission-Session-Id']).toBe('sess-new')
  })

  it('throws RpcError with the detail message on JSON-RPC error objects', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        jsonrpc: '2.0',
        error: { code: 3, message: 'torrent not found', data: { error_string: 'no such id' } },
        id: 1,
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const err = await rpcCall('torrent_get').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(RpcError)
    expect((err as RpcError).message).toBe('torrent not found (no such id)')
    expect((err as RpcError).code).toBe(3)
  })

  it('throws when the response has neither result nor error', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ jsonrpc: '2.0', id: 1 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(rpcCall('session_get')).rejects.toThrow('Malformed RPC response')
  })

  it('throws RpcError on non-409 HTTP errors', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 401, statusText: 'Unauthorized' }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(rpcCall('session_get')).rejects.toThrow('HTTP 401')
  })

  it('throws when the 409 response carries no session id header', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('Conflict', { status: 409 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(rpcCall('session_get')).rejects.toThrow('Handshake failed')
  })
})
