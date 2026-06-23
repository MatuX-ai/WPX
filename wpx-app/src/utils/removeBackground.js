import { getLocalApiBase } from '@/utils/localApi'

export async function parseRemoveBgError(response) {
  try {
    const data = await response.json()
    if (typeof data.details === 'string') return data.details
    if (typeof data.detail === 'string') return data.detail
    if (typeof data.error === 'string') return data.error
    if (typeof data.message === 'string') return data.message
  } catch {
    // ignore json parse errors
  }
  return `去背景失败（${response.status}）`
}

export async function removeImageBackground(blob, filename = 'image.png') {
  const formData = new FormData()
  formData.append('file', blob, filename)

  const apiBase = await getLocalApiBase()
  const response = await fetch(`${apiBase}/api/remove-bg`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    throw new Error(await parseRemoveBgError(response))
  }

  return response.blob()
}
