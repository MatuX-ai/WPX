'use strict'

/**
 * 推荐的中文免费字体清单。
 *
 * 该列表面向系统已安装但字体库中可下载的"优质免费字体"做检测。
 * 与 frontend `constants/recommendedFonts.js` 中的展示信息保持一致：
 * - id：与 ONLINE_FREE_FONTS 对应的 catalog id
 * - name：用户可读的中文名
 * - category：黑体/宋体/手写 等分类
 * - sampleText：预览文案
 * - downloadUrl/fileName：与 ONLINE_FREE_FONTS 完全一致
 * - systemAliases：系统字体目录可能出现的 family 名称列表（用于匹配是否已安装）
 *
 * 任何修改必须同步到 `wpx-app/src/constants/recommendedFonts.js`。
 */

const RECOMMENDED_FREE_FONTS = [
  {
    id: 'source-han-soft',
    name: '思源柔黑',
    category: '黑体',
    sampleText: '思源柔黑',
    description: '圆润饱满，适合长文阅读与海报。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/source-han-soft.ttf',
    fileName: 'source-han-soft.ttf',
    systemAliases: [
      'source han soft',
      '思源柔黑',
      'sourcehansoft',
      'noto sans cjk sc',
      'noto sans sc',
    ],
  },
  {
    id: 'misans',
    name: 'MiSans',
    category: '黑体',
    sampleText: 'MiSans',
    description: '小米开源黑体，现代简约，跨平台兼容好。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/misans.ttf',
    fileName: 'misans.ttf',
    systemAliases: ['misans', '小米兰亭', 'mi sans'],
  },
  {
    id: 'smile-black',
    name: '得意黑',
    category: '黑体',
    sampleText: '得意黑',
    description: '斜体黑体，时尚活泼，适合标题与海报。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/smile-black.ttf',
    fileName: 'smile-black.ttf',
    systemAliases: ['smile black', '得意黑', '得意'],
  },
  {
    id: 'jiying-wensong',
    name: '极影毁片文宋',
    category: '宋体',
    sampleText: '极影毁片文宋',
    description: '改良宋体，适合古文与正式文档。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/jiying-wensong.ttf',
    fileName: 'jiying-wensong.ttf',
    systemAliases: ['jiying wensong', '极影毁片文宋', '文宋'],
  },
  {
    id: 'zcool-wenyi',
    name: '站酷文艺体',
    category: '手写',
    sampleText: '站酷文艺体',
    description: '手写风格，文艺随性。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/zcool-wenyi.ttf',
    fileName: 'zcool-wenyi.ttf',
    systemAliases: ['zcool wenyi', '站酷文艺体', 'zcool文艺体'],
  },
  {
    id: 'muyao-soft',
    name: '沐瑶软笔手写体',
    category: '手写',
    sampleText: '沐瑶软笔手写体',
    description: '软笔手写，温润有亲和力。',
    downloadUrl: 'https://cdn.wpx.app/fonts/free/muyao-soft.ttf',
    fileName: 'muyao-soft.ttf',
    systemAliases: ['muyao soft', '沐瑶软笔手写体', '沐瑶手写'],
  },
]

function getRecommendedFreeFonts() {
  return RECOMMENDED_FREE_FONTS
}

module.exports = {
  RECOMMENDED_FREE_FONTS,
  getRecommendedFreeFonts,
}
