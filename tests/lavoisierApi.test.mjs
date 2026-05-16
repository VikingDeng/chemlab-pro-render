import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.LLM_API_KEY = ''
process.env.LLM_MODEL = ''
process.env.LLM_API_URL = ''

const { createLavoisierServer } = await import('../server/index.mjs')

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject)
      const address = server.address()
      resolve(`http://127.0.0.1:${address.port}`)
    })
  })
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve())
  })
}

async function postJson(baseUrl, payload) {
  const response = await fetch(`${baseUrl}/api/lavoisier`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  assert.equal(response.status, 200)
  return response.json()
}

test('Lavoisier refuses to invent a concrete chemistry system without container species', async () => {
  const server = createLavoisierServer()
  const baseUrl = await listen(server)
  try {
    const data = await postJson(baseUrl, {
      message: '请检查当前实验风险，并给出安全操作建议。',
      context: {
        mode: 'sandbox',
        localSignals: { intent: 'precipitation', risks: [] },
      },
    })

    assert.match(data.reply, /没有锁定主容器|没有足够信息|不会臆测/)
    assert.doesNotMatch(data.reply, /risks为空|Fe|亚铁|沙盒模式|context|localSignals|\*\*|•|^\s*1[.)、]/m)
  } finally {
    await close(server)
  }
})

test('Lavoisier uses known species when the focused container provides them', async () => {
  const server = createLavoisierServer()
  const baseUrl = await listen(server)
  try {
    const data = await postJson(baseUrl, {
      message: '请检查当前实验风险，并给出安全操作建议。',
      context: {
        mode: 'sandbox',
        focusedContainer: {
          id: 'b1',
          name: '烧杯',
          type: 'beaker',
          volume: 40,
          temperature: 22.4,
          ph: 7,
          pressure: 1,
          state: 'precipitate_ag',
          species: [
            { formula: 'AgCl', label: '氯化银沉淀', amount: 0.001 },
            { formula: 'HNO3', label: '硝酸', amount: 0.001 },
          ],
        },
        localSignals: { intent: 'precipitation', risks: [] },
      },
    })

    assert.match(data.reply, /氯化银沉淀/)
    assert.match(data.reply, /硝酸/)
    assert.doesNotMatch(data.reply, /\*\*|•|^\s*1[.)、]/m)
  } finally {
    await close(server)
  }
})
