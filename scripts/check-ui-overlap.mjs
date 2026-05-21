#!/usr/bin/env node
import { chromium } from 'playwright'

const targetUrl = process.argv[2] || process.env.CHEMLAB_UI_URL || 'http://127.0.0.1:5173/'
const viewports = [
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'desktop-1366', width: 1366, height: 768 },
  { name: 'tablet-1180', width: 1180, height: 760 },
]
const panelSelector = '[data-panel="challenge-hud"], [data-panel="challenge-action-dock"], [data-panel="challenge-proof-panel"], [data-panel="workspace"], [data-panel="reagent-shelf"], [data-panel="lavoisier-panel"], header, aside'
const allowed = new Set([
  'challenge-hud::workspace',
  'challenge-action-dock::workspace',
  'challenge-proof-panel::workspace',
  'lavoisier-panel::workspace',
  'reagent-shelf::workspace',
  'aside::reagent-shelf',
])

function area(rect) {
  return Math.max(0, rect.width) * Math.max(0, rect.height)
}

function intersectionArea(a, b) {
  const left = Math.max(a.left, b.left)
  const right = Math.min(a.right, b.right)
  const top = Math.max(a.top, b.top)
  const bottom = Math.min(a.bottom, b.bottom)
  return Math.max(0, right - left) * Math.max(0, bottom - top)
}

function pairKey(a, b) {
  return [a.name, b.name].sort().join('::')
}

async function collectPanels(page) {
  return page.locator(panelSelector).evaluateAll((nodes) => nodes.map((node, index) => {
    const rect = node.getBoundingClientRect()
    const role = node.getAttribute('data-panel') || node.tagName.toLowerCase()
    const hidden = rect.width < 2 || rect.height < 2 || getComputedStyle(node).visibility === 'hidden' || getComputedStyle(node).display === 'none'
    return {
      name: role === 'aside' ? 'aside' : role,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      hidden,
    }
  }).filter(panel => !panel.hidden))
}

async function failOnOverlap(page, label) {
  const panels = await collectPanels(page)
  const issues = []
  for (let i = 0; i < panels.length; i += 1) {
    for (let j = i + 1; j < panels.length; j += 1) {
      const a = panels[i]
      const b = panels[j]
      const overlap = intersectionArea(a, b)
      if (overlap < 90) continue
      const ratio = overlap / Math.min(area(a), area(b))
      if (ratio < 0.08) continue
      if (allowed.has(pairKey(a, b))) continue
      issues.push(`${label}: ${a.name} overlaps ${b.name} (${Math.round(overlap)}px², ${(ratio * 100).toFixed(1)}%)`)
    }
  }
  if (issues.length) {
    throw new Error(issues.join('\n'))
  }
}

async function run() {
  const browser = await chromium.launch({ headless: true })
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport })
      await page.goto(targetUrl, { waitUntil: 'networkidle' })
      await page.evaluate(() => {
        localStorage.clear()
        sessionStorage.clear()
      })
      await page.reload({ waitUntil: 'networkidle' })
      await failOnOverlap(page, `${viewport.name}: landing`)
      await page.getByRole('button', { name: '开始第 1 关' }).click()
      await page.waitForTimeout(500)
      await failOnOverlap(page, `${viewport.name}: challenge-start`)
      await page.close()
    }
  } finally {
    await browser.close()
  }
  console.log(`UI overlap check passed for ${viewports.map(viewport => viewport.name).join(', ')} at ${targetUrl}`)
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
