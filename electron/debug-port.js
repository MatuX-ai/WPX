const net = require('node:net')

/**
 * @param {number} [preferredPort]
 * @returns {Promise<number>}
 */
function findAvailablePort(preferredPort = 0) {
  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.unref()
    server.on('error', (error) => {
      if (preferredPort > 0) {
        findAvailablePort(0).then(resolve).catch(reject)
        return
      }
      reject(error)
    })

    server.listen(preferredPort, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : preferredPort
      server.close((closeError) => {
        if (closeError) {
          reject(closeError)
          return
        }
        resolve(port)
      })
    })
  })
}

/**
 * @param {number} startPort
 * @param {number} span
 * @returns {Promise<number>}
 */
async function findAvailablePortInRange(startPort, span) {
  const safeStart = Number.isFinite(startPort) && startPort > 0 ? startPort : 9222
  const safeSpan = Number.isFinite(span) && span > 0 ? span : 200

  for (let offset = 0; offset < safeSpan; offset += 1) {
    const candidate = safeStart + offset
    if (await isPortAvailable(candidate)) {
      return candidate
    }
  }

  return findAvailablePort(0)
}

/**
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.unref()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true))
    })
  })
}

module.exports = {
  findAvailablePort,
  findAvailablePortInRange,
  isPortAvailable,
}
