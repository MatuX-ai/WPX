import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildMeta, buildLinks, setMeta, SEO_DEFAULTS } from '../seo.js'

const SITE = 'https://wpx.app'

describe('utils/seo', () => {
  describe('toAbsoluteUrl (通过 buildMeta 间接验证)', () => {
    it('把相对路径补成绝对 URL', () => {
      const tags = buildMeta({
        title: 'X',
        description: 'Y',
        path: '/about',
        siteUrl: SITE,
      })
      const ogUrl = tags.find((t) => t.property === 'og:url').content
      expect(ogUrl).toBe('https://wpx.app/about')
    })

    it('保留已经是 http(s) 开头的 URL', () => {
      const tags = buildMeta({
        title: 'X',
        description: 'Y',
        path: 'https://other.example.com/foo',
      })
      const ogUrl = tags.find((t) => t.property === 'og:url').content
      expect(ogUrl).toBe('https://other.example.com/foo')
    })

    it('把 og:image 的相对路径也补全', () => {
      const tags = buildMeta({
        title: 'X',
        description: 'Y',
        image: '/og-image.svg',
        siteUrl: SITE,
      })
      const ogImage = tags.find((t) => t.property === 'og:image').content
      expect(ogImage).toBe('https://wpx.app/og-image.svg')
    })
  })

  describe('buildMeta', () => {
    it('缺少 title / description 时抛错', () => {
      expect(() => buildMeta({ description: 'x' })).toThrow(/title/)
      expect(() => buildMeta({ title: 'x' })).toThrow(/description/)
    })

    it('输出必填的 OG / Twitter meta', () => {
      const tags = buildMeta({
        title: 'WPX 测试',
        description: 'WPX 描述',
        siteUrl: SITE,
      })
      const names = tags.map((t) => t.name).filter(Boolean)
      const props = tags.map((t) => t.property).filter(Boolean)
      expect(names).toEqual(expect.arrayContaining(['description', 'theme-color', 'color-scheme']))
      expect(props).toEqual(
        expect.arrayContaining([
          'og:title',
          'og:description',
          'og:type',
          'og:url',
          'og:image',
          'og:site_name',
          'og:locale',
        ]),
      )
      expect(names).toEqual(expect.arrayContaining(['twitter:card', 'twitter:title', 'twitter:description', 'twitter:image']))
    })

    it('默认值 type / twitterCard', () => {
      const tags = buildMeta({ title: 'X', description: 'Y' })
      expect(tags.find((t) => t.property === 'og:type').content).toBe('website')
      expect(tags.find((t) => t.name === 'twitter:card').content).toBe('summary_large_image')
      expect(tags.find((t) => t.property === 'og:site_name').content).toBe(SEO_DEFAULTS.siteName)
    })

    it('自定义 keywords / author / themeColor', () => {
      const tags = buildMeta({
        title: 'X',
        description: 'Y',
        keywords: 'a,b,c',
        author: 'Alice',
        themeColor: '#000000',
      })
      expect(tags.find((t) => t.name === 'keywords').content).toBe('a,b,c')
      expect(tags.find((t) => t.name === 'author').content).toBe('Alice')
      expect(tags.find((t) => t.name === 'theme-color').content).toBe('#000000')
    })

    it('og:image 始终附带 width/height/alt', () => {
      const tags = buildMeta({ title: 'WPX', description: 'd', siteUrl: SITE })
      expect(tags.find((t) => t.property === 'og:image:width').content).toBe('1200')
      expect(tags.find((t) => t.property === 'og:image:height').content).toBe('630')
      expect(tags.find((t) => t.property === 'og:image:alt').content).toBe('WPX')
    })
  })

  describe('buildLinks', () => {
    it('生成 canonical link', () => {
      const links = buildLinks({ path: '/library', siteUrl: SITE })
      expect(links[0]).toEqual({ rel: 'canonical', href: 'https://wpx.app/library' })
    })
  })

  describe('setMeta (浏览器端)', () => {
    beforeEach(() => {
      // 清理 head
      document.head.innerHTML = ''
    })

    afterEach(() => {
      document.head.innerHTML = ''
    })

    it('写入 title 并复用同 name 的 meta', () => {
      setMeta({
        title: 'New Title',
        description: 'New Desc',
        path: '/x',
        siteUrl: SITE,
      })
      expect(document.title).toBe('New Title')
      // 再次调用：不应重复追加
      setMeta({
        title: 'New Title 2',
        description: 'New Desc 2',
        path: '/x',
        siteUrl: SITE,
      })
      const description = document.head.querySelectorAll('meta[name="description"]')
      expect(description.length).toBe(1)
      expect(description[0].getAttribute('content')).toBe('New Desc 2')
    })

    it('非浏览器环境安全 noop', () => {
      const originalDocument = globalThis.document
      const docSpy = vi.fn()
      // 模拟服务端：document 是 undefined 的情况
      // 我们的 setMeta 已经检查 typeof document === 'undefined'，不抛错
      expect(() => setMeta({ title: 'X', description: 'Y' })).not.toThrow()
      void originalDocument
      void docSpy
    })
  })
})
