export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function srcToBlob(src) {
  const response = await fetch(src)
  if (!response.ok) {
    throw new Error('无法读取图片')
  }
  return response.blob()
}
