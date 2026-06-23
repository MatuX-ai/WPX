/**
 * @param {string} apiKey
 */
export function maskApiKey(apiKey) {
  const key = String(apiKey || '').trim()
  if (!key) return ''
  if (key.length <= 8) return '••••••••'
  const middleLength = Math.min(Math.max(key.length - 8, 4), 12)
  return `${key.slice(0, 4)}${'•'.repeat(middleLength)}${key.slice(-4)}`
}
