const BASE = process.env.EXPORT_API_URL || 'http://localhost:3001'
const MARKDOWN = `# WPX 导出测试

这是一段**加粗**与*斜体*文本。

## 列表

- 项目 A
- 项目 B

| 列1 | 列2 |
| --- | --- |
| A | B |
`

async function testHealth() {
  const res = await fetch(`${BASE}/api/health`)
  const data = await res.json()
  console.log('HEALTH', res.status, JSON.stringify(data))
  return data.pandoc
}

async function testExport(format) {
  const res = await fetch(`${BASE}/api/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: MARKDOWN, format }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.log(`EXPORT ${format}`, res.status, JSON.stringify(err))
    return false
  }

  const buf = Buffer.from(await res.arrayBuffer())
  console.log(`EXPORT ${format}`, res.status, `ok`, `${buf.length} bytes`, res.headers.get('content-type'))
  return true
}

const pandocOk = await testHealth()
if (!pandocOk) {
  console.error('Pandoc not detected by service')
  process.exit(1)
}

const results = {
  html: await testExport('html'),
  docx: await testExport('docx'),
  pdf: await testExport('pdf'),
}

const passed = Object.values(results).filter(Boolean).length
console.log(`SUMMARY: ${passed}/3 formats succeeded`)
process.exit(passed === 3 ? 0 : 1)
