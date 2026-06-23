import Module from 'node:module'

const originalLoad = Module._load

Module._load = function loadWithElectronMock(request, parent, isMain) {
  if (request === 'electron') {
    return {
      app: {
        isPackaged: false,
        isReady: () => true,
        whenReady: () => Promise.resolve(),
      },
    }
  }

  return originalLoad.call(this, request, parent, isMain)
}
