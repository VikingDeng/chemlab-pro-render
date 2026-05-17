import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { test } from 'node:test'

process.env.LLM_API_KEY = ''
process.env.LLM_MODEL = ''
process.env.LLM_API_URL = ''
process.env.LLM_PROVIDER = ''

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

test('Lavoisier does not fake a chemistry answer when LLM is not configured', async () => {
  process.env.LLM_API_KEY = ''
  process.env.LLM_MODEL = ''
  process.env.LLM_API_URL = ''
  process.env.LLM_PROVIDER = ''
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

    assert.match(data.reply, /LLM.*(没接通|未连接)/)
    assert.doesNotMatch(data.reply, /risks为空|Fe|亚铁|沙盒模式|context|localSignals|硫酸|氯化钠|H2O|\*\*|•|^\s*1[.)、]/m)
  } finally {
    await close(server)
  }
})

test('Lavoisier uses the configured LLM response instead of local chemistry fallback', async () => {
  const fakeLlm = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/chat/completions') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    for await (const chunk of req) body += chunk
    const parsed = JSON.parse(body)
    assert.equal(parsed.model, 'fake-mimo')
    const content = JSON.stringify({
      reply: '氯化银沉淀来自 Ag⁺ 和 Cl⁻ 结合形成难溶 AgCl；先静置观察白色絮状物是否继续下沉。',
      headline: '拉瓦锡：白色沉淀已形成',
      suggestedPrompts: ['下一步', '解释现象'],
      toolCalls: [],
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ message: { content } }] }))
  })
  const fakeUrl = await listen(fakeLlm)
  process.env.LLM_API_KEY = 'test-key'
  process.env.LLM_MODEL = 'fake-mimo'
  process.env.LLM_API_URL = fakeUrl
  process.env.LLM_PROVIDER = 'openai-compatible'

  const server = createLavoisierServer()
  const baseUrl = await listen(server)
  try {
    const data = await postJson(baseUrl, {
      message: '请解释当前实验现象和背后的化学原因。',
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

    assert.match(data.reply, /氯化银沉淀来自 Ag⁺ 和 Cl⁻/)
    assert.equal(data.statusLabel, 'LLM 已接入 · openai-compatible/fake-mimo')
    assert.doesNotMatch(data.reply, /LLM 未连接|没接通|\*\*|•|^\s*1[.)、]/m)
  } finally {
    process.env.LLM_API_KEY = ''
    process.env.LLM_MODEL = ''
    process.env.LLM_API_URL = ''
    process.env.LLM_PROVIDER = ''
    await close(server)
    await close(fakeLlm)
  }
})

test('MiMo v2.5 disables thinking to avoid empty final answers', async () => {
  let capturedRequest
  const fakeLlm = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/chat/completions') {
      res.writeHead(404).end()
      return
    }
    let body = ''
    for await (const chunk of req) body += chunk
    capturedRequest = JSON.parse(body)
    const content = JSON.stringify({
      reply: '当前没有明确试剂，先聚焦容器并补充一次观察记录。',
      headline: '拉瓦锡：等待具体体系',
      suggestedPrompts: ['分析当前容器'],
      toolCalls: [],
    })
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }))
  })
  const fakeUrl = await listen(fakeLlm)
  process.env.LLM_API_KEY = 'test-key'
  process.env.LLM_MODEL = 'mimo-v2.5'
  process.env.LLM_API_URL = fakeUrl
  process.env.LLM_PROVIDER = 'mimo'

  const server = createLavoisierServer()
  const baseUrl = await listen(server)
  try {
    const data = await postJson(baseUrl, {
      message: '分析当前状态',
      context: { mode: 'sandbox' },
    })

    assert.deepEqual(capturedRequest.chat_template_kwargs, { enable_thinking: false })
    assert.equal(data.statusLabel, 'LLM 已接入 · mimo/mimo-v2.5')
    assert.match(data.reply, /先聚焦容器/)
  } finally {
    process.env.LLM_API_KEY = ''
    process.env.LLM_MODEL = ''
    process.env.LLM_API_URL = ''
    process.env.LLM_PROVIDER = ''
    await close(server)
    await close(fakeLlm)
  }
})
