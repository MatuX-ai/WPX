/**
 * WPX 安装包版本号：0.M.P
 * - 初始 0.1.0
 * - 每次成功打包后 patch +1
 * - patch > 100 时 minor +1，patch 归零（例：0.1.100 → 0.2.0）
 *
 * package.json 的 version 字段表示「下一次打包将使用的版本」。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const packageJsonPath = path.join(rootDir, 'package.json')

/**
 * @param {string} version
 * @returns {string}
 */
export function bumpPackVersion(version) {
  const parts = String(version || '')
    .trim()
    .split('.')
    .map((part) => Number.parseInt(part, 10))

  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error(`无效版本号：${version}，需要 major.minor.patch 格式`)
  }

  let [major, minor, patch] = parts
  patch += 1

  if (patch > 100) {
    minor += 1
    patch = 0
  }

  return `${major}.${minor}.${patch}`
}

/**
 * @returns {{ version: string }}
 */
function readPackageJson() {
  const raw = fs.readFileSync(packageJsonPath, 'utf8')
  return JSON.parse(raw)
}

/**
 * @param {string} version
 */
function writePackageVersion(version) {
  const pkg = readPackageJson()
  pkg.version = version
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')
}

const command = process.argv[2] || 'read'

switch (command) {
  case 'read': {
    const { version } = readPackageJson()
    process.stdout.write(`${version}\n`)
    break
  }
  case 'print': {
    const { version } = readPackageJson()
    console.log(`[pack-version] 本次打包版本：${version}`)
    break
  }
  case 'bump': {
    const { version: current } = readPackageJson()
    const next = bumpPackVersion(current)
    writePackageVersion(next)
    console.log(`[pack-version] 下次打包版本：${current} → ${next}`)
    break
  }
  default:
    console.error(`用法: node scripts/bump-pack-version.mjs <read|print|bump>`)
    process.exit(1)
}
