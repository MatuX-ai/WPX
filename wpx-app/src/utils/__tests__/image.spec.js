import { describe, it, expect } from 'vitest'
import { isRemoteUrl, toWebp, toFallback, buildPictureSources } from '../image.js'

describe('utils/image', () => {
  describe('isRemoteUrl', () => {
    it('识别 http / https', () => {
      expect(isRemoteUrl('http://a.com/x.png')).toBe(true)
      expect(isRemoteUrl('https://a.com/x.png')).toBe(true)
    })

    it('识别 data: / blob:', () => {
      expect(isRemoteUrl('data:image/png;base64,abc')).toBe(true)
      expect(isRemoteUrl('blob:https://a.com/uuid')).toBe(true)
    })

    it('相对路径 / 根路径视为本地', () => {
      expect(isRemoteUrl('/assets/x.png')).toBe(false)
      expect(isRemoteUrl('./x.png')).toBe(false)
      expect(isRemoteUrl('x.png')).toBe(false)
    })

    it('空值 / null', () => {
      expect(isRemoteUrl('')).toBe(false)
      expect(isRemoteUrl(null)).toBe(false)
      expect(isRemoteUrl(undefined)).toBe(false)
    })
  })

  describe('toWebp', () => {
    it('png -> webp', () => {
      expect(toWebp('/assets/hero.png')).toBe('/assets/hero.webp')
    })

    it('jpg / jpeg / gif -> webp', () => {
      expect(toWebp('/x/y.jpg')).toBe('/x/y.webp')
      expect(toWebp('/x/y.jpeg')).toBe('/x/y.webp')
      expect(toWebp('/x/y.gif')).toBe('/x/y.webp')
    })

    it('已经是 webp 时保持不变', () => {
      expect(toWebp('/a/b.webp')).toBe('/a/b.webp')
    })

    it('无扩展名 / 远程 URL 不转换', () => {
      expect(toWebp('/a/b')).toBe('/a/b')
      expect(toWebp('https://cdn.example.com/x.png')).toBe('https://cdn.example.com/x.png')
    })
  })

  describe('toFallback', () => {
    it('.webp -> .png', () => {
      expect(toFallback('/a/b.webp')).toBe('/a/b.png')
    })

    it('非 webp 时保持不变', () => {
      expect(toFallback('/a/b.png')).toBe('/a/b.png')
    })
  })

  describe('buildPictureSources', () => {
    it('生成 { webp, fallback }', () => {
      const out = buildPictureSources('/assets/hero.png')
      expect(out.webp).toBe('/assets/hero.webp')
      expect(out.fallback).toBe('/assets/hero.png')
    })

    it('webp 源时回退为 .png', () => {
      const out = buildPictureSources('/assets/foo.webp')
      expect(out.webp).toBe('/assets/foo.webp')
      expect(out.fallback).toBe('/assets/foo.png')
    })
  })
})
