/**
 * CI 预检：确保 Vite 8 / Tailwind 4 的平台原生 binding 可加载。
 * 解决 npm optional dependency bug (npm/cli#4828) 在 GHA 上跳过 transitive optional deps 的问题。
 */
import { createRequire } from 'node:module'
import { platform, arch } from 'node:os'

const require = createRequire(import.meta.url)

const ROLLDOWN_BINDINGS = {
  'darwin-arm64': '@rolldown/binding-darwin-arm64',
  'darwin-x64': '@rolldown/binding-darwin-x64',
  'linux-x64': '@rolldown/binding-linux-x64-gnu',
  'win32-x64': '@rolldown/binding-win32-x64-msvc',
}

const OXIDE_BINDINGS = {
  'darwin-arm64': '@tailwindcss/oxide-darwin-arm64',
  'darwin-x64': '@tailwindcss/oxide-darwin-x64',
  'linux-x64': '@tailwindcss/oxide-linux-x64-gnu',
  'win32-x64': '@tailwindcss/oxide-win32-x64-msvc',
}

const key = `${platform()}-${arch()}`
const rolldownPkg = ROLLDOWN_BINDINGS[key]
const oxidePkg = OXIDE_BINDINGS[key]

console.log(`[ci-native] node ${process.version} on ${key}`)

if (!rolldownPkg || !oxidePkg) {
  console.error(`[ci-native] Unsupported runner platform: ${key}`)
  process.exit(1)
}

for (const pkg of [rolldownPkg, oxidePkg]) {
  try {
    require.resolve(pkg)
    require(pkg)
    console.log(`[ci-native] OK ${pkg}`)
  } catch (err) {
    console.error(`[ci-native] Failed to load native binding: ${pkg}`)
    console.error(err)
    process.exit(1)
  }
}

try {
  await import('vite')
  console.log('[ci-native] vite import OK')
} catch (err) {
  console.error('[ci-native] Failed to import vite')
  console.error(err)
  process.exit(1)
}

try {
  await import('@tailwindcss/vite')
  console.log('[ci-native] @tailwindcss/vite import OK')
} catch (err) {
  console.error('[ci-native] Failed to import @tailwindcss/vite')
  console.error(err)
  process.exit(1)
}

console.log('[ci-native] All checks passed')
