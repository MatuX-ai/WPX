<script setup>
/**
 * FontsView.vue
 * ------------------------------------------------------------
 * WPX 营销站 · 字体库
 *
 *  - 内置 8 款免费开源字体（随安装包）
 *  - 在线免费字体（按需下载，100+ 款可商用）
 *  - 自导入本地已授权字体说明
 *
 * V1.1 变更：不再提供商业字体 Token 充值；商业字体需用户自行采购后导入。
 * 点击交互：网页端点击字体名跳转到官方下载源 / 百度搜索；下载后由用户导入 WPX。
 * ------------------------------------------------------------
 */

/**
 * 在线免费字体下载源映射表
 * - 热门 / 厂商品牌字体：指向官方 GitHub 仓库 / 官网下载页
 * - 表中查不到的字体：自动兑底到百度搜索「{名称} 字体 免费下载」
 */
const FONT_HOMES = {
  // ───── 思源 / Noto（GitHub adobe-fonts / notofonts） ─────
  '思源黑体 CN': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源黑体 TW': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源黑体 JP': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源黑体 KR': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源黑体 HW': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源黑体 VF': 'https://github.com/adobe-fonts/source-han-sans/releases/latest',
  '思源宋体 CN': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源宋体 TW': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源宋体 JP': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源宋体 KR': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源宋体 VF': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源楷体': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源柔黑': 'https://github.com/Pal3love/Source-Han-TrueType',
  '思源仿宋': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  '思源点阵宋': 'https://github.com/adobe-fonts/source-han-serif/releases/latest',
  'Noto Sans CJK SC': 'https://github.com/notofonts/noto-cjk',
  'Noto Serif CJK SC': 'https://github.com/notofonts/noto-cjk',
  'Noto Sans Mono CJK SC': 'https://github.com/notofonts/noto-cjk',
  'Noto Color Emoji': 'https://github.com/googlefonts/noto-emoji',

  // ───── 阿里 / 蚂蚁 ─────
  '阿里巴巴普惠体 1.0': 'https://fonts.alibabagroup.com/#/fonts',
  '阿里巴巴普惠体 2.0': 'https://fonts.alibabagroup.com/#/fonts',
  '阿里巴巴普惠体 3.0': 'https://fonts.alibabagroup.com/#/fonts',
  '阿里巴巴妈妈体': 'https://fonts.alibabagroup.com/#/fonts',
  '阿里汉仪智能黑': 'https://fonts.alibabagroup.com/#/fonts',

  // ───── 华为 / 荣耀 ─────
  'HarmonyOS Sans SC': 'https://developer.huawei.com/consumer/cn/design/resource/HarmonyOS-sans',
  'HarmonyOS Sans TC': 'https://developer.huawei.com/consumer/cn/design/resource/HarmonyOS-sans',
  'HarmonyOS Sans Latin': 'https://developer.huawei.com/consumer/cn/design/resource/HarmonyOS-sans',
  'HarmonyOS Sans Mono': 'https://developer.huawei.com/consumer/cn/design/resource/HarmonyOS-sans',
  '荣耀 Honor Sans': 'https://www.hihonor.com/',

  // ───── OPPO / vivo / 小米 ─────
  'OPPO Sans': 'https://www.oppo.com/cn/event/opposans/',
  'OPPO Sans 4.0': 'https://www.oppo.com/cn/event/opposans/',
  'vivo Sans': 'https://shop.vivo.com.cn/font/',
  'MiSans': 'https://hyperos.mi.com/font/',
  'MiSans VF': 'https://hyperos.mi.com/font/',
  'MiSans Latin': 'https://hyperos.mi.com/font/',

  // ───── 站酷系列 ─────
  '站酷快乐体': 'https://www.zcool.com.cn/special/zcoolkuaile/',
  '站酷文艺体': 'https://www.zcool.com.cn/',
  '站酷高端黑': 'https://www.zcool.com.cn/special/zcoolgaoduanhei/',
  '站酷小薇 LOGO 体': 'https://www.zcool.com.cn/special/zcoolxiaowei/',
  '站酷酷黑体': 'https://www.zcool.com.cn/special/zcoolkuheiti/',
  '站库意大利体': 'https://www.zcool.com.cn/',
  '站酷庆科黄油体': 'https://www.zcool.com.cn/special/zcoolqingKeHuangYouTi/',
  '小薇 LOGO 体': 'https://www.zcool.com.cn/special/zcoolxiaowei/',

  // ───── 霞鹜文楷（GitHub） ─────
  '霞鹜文楷': 'https://github.com/lxgw/LxgwWenKai/releases',
  '霞鹜文楷 TC': 'https://github.com/lxgw/LxgwWenKaiTC/releases',
  '霞鹜文楷等宽': 'https://github.com/lxgw/LxgwWenKaiMono',
  '霞鹜文楷屏幕阅读版': 'https://github.com/lxgw/LxgwWenKai-Screen',

  // ───── 文泉驿 ─────
  '文泉驿微米黑': 'https://github.com/anthonyfok/fonts-wqy-microhei',
  '文泉驿正黑': 'https://github.com/anthonyfok/fonts-wqy-zenhei',
  '文泉驿点阵宋': 'https://github.com/anthonyfok/fonts-wqy-bitmap-song',
  '文泉驿等宽微米黑': 'https://github.com/anthonyfok/fonts-wqy-microhei',

  // ───── 英文/国际化：Google Fonts 收录 ─────
  'Inter': 'https://fonts.google.com/specimen/Inter',
  'Inter Display': 'https://fonts.google.com/specimen/Inter',
  'Roboto': 'https://fonts.google.com/specimen/Roboto',
  'Roboto Flex': 'https://fonts.google.com/specimen/Roboto+Flex',
  'Roboto Condensed': 'https://fonts.google.com/specimen/Roboto+Condensed',
  'Open Sans': 'https://fonts.google.com/specimen/Open+Sans',
  'Lato': 'https://fonts.google.com/specimen/Lato',
  'Montserrat': 'https://fonts.google.com/specimen/Montserrat',
  'Poppins': 'https://fonts.google.com/specimen/Poppins',
  'Nunito': 'https://fonts.google.com/specimen/Nunito',
  'Nunito Sans': 'https://fonts.google.com/specimen/Nunito+Sans',
  'Manrope': 'https://fonts.google.com/specimen/Manrope',
  'DM Sans': 'https://fonts.google.com/specimen/DM+Sans',
  'Public Sans': 'https://fonts.google.com/specimen/Public+Sans',
  'Source Sans 3': 'https://github.com/adobe-fonts/source-sans',
  'IBM Plex Sans': 'https://github.com/IBM/plex',
  'Work Sans': 'https://fonts.google.com/specimen/Work+Sans',
  'Plus Jakarta Sans': 'https://fonts.google.com/specimen/Plus+Jakarta+Sans',
  'Figtree': 'https://fonts.google.com/specimen/Figtree',
  'Outfit': 'https://fonts.google.com/specimen/Outfit',
  'Sora': 'https://fonts.google.com/specimen/Sora',
  'Be Vietnam Pro': 'https://fonts.google.com/specimen/Be+Vietnam+Pro',
  'Atkinson Hyperlegible': 'https://fonts.google.com/specimen/Atkinson+Hyperlegible',
  'Lexend': 'https://fonts.google.com/specimen/Lexend',
  'Space Grotesk': 'https://fonts.google.com/specimen/Space+Grotesk',
  'Archivo': 'https://fonts.google.com/specimen/Archivo',
  'Archivo Black': 'https://fonts.google.com/specimen/Archivo+Black',
  'Rubik': 'https://fonts.google.com/specimen/Rubik',
  'Karla': 'https://fonts.google.com/specimen/Karla',
  'Hind': 'https://fonts.google.com/specimen/Hind',
  'Heebo': 'https://fonts.google.com/specimen/Heebo',
  'Mulish': 'https://fonts.google.com/specimen/Mulish',
  'Barlow': 'https://fonts.google.com/specimen/Barlow',
  'Asap': 'https://fonts.google.com/specimen/Asap',
  'Cabin': 'https://fonts.google.com/specimen/Cabin',
  'Quicksand': 'https://fonts.google.com/specimen/Quicksand',
  'Source Serif 4': 'https://github.com/adobe-fonts/source-serif',
  'IBM Plex Serif': 'https://github.com/IBM/plex',
  'Lora': 'https://fonts.google.com/specimen/Lora',
  'Merriweather': 'https://fonts.google.com/specimen/Merriweather',
  'Playfair Display': 'https://fonts.google.com/specimen/Playfair+Display',
  'Cormorant Garamond': 'https://fonts.google.com/specimen/Cormorant+Garamond',
  'Crimson Pro': 'https://fonts.google.com/specimen/Crimson+Pro',
  'EB Garamond': 'https://fonts.google.com/specimen/EB+Garamond',
  'PT Serif': 'https://fonts.google.com/specimen/PT+Serif',
  'Roboto Slab': 'https://fonts.google.com/specimen/Roboto+Slab',
  'Bitter': 'https://fonts.google.com/specimen/Bitter',
  'DM Serif Display': 'https://fonts.google.com/specimen/DM+Serif+Display',
  'Spectral': 'https://fonts.google.com/specimen/Spectral',
  'Libre Baskerville': 'https://fonts.google.com/specimen/Libre+Baskerville',
  'Cardo': 'https://fonts.google.com/specimen/Cardo',
  'JetBrains Mono': 'https://www.jetbrains.com/lp/mono/',
  'JetBrains Mono NL': 'https://www.jetbrains.com/lp/mono/',
  'Fira Code': 'https://github.com/tonsky/FiraCode',
  'Fira Mono': 'https://github.com/tonsky/FiraCode',
  'Source Code Pro': 'https://github.com/adobe-fonts/source-code-pro',
  'IBM Plex Mono': 'https://github.com/IBM/plex',
  'Cascadia Code': 'https://github.com/microsoft/cascadia-code',
  'Cascadia Mono': 'https://github.com/microsoft/cascadia-code',
  'Hack': 'https://github.com/source-foundry/Hack',
  'Inconsolata': 'https://github.com/googlefonts/Inconsolata',
  'Roboto Mono': 'https://fonts.google.com/specimen/Roboto+Mono',
  'Ubuntu Mono': 'https://fonts.google.com/specimen/Ubuntu+Mono',
  'Iosevka': 'https://github.com/be5invis/Iosevka',
  'Geist Mono': 'https://github.com/vercel/geist-font',
  'DM Mono': 'https://fonts.google.com/specimen/DM+Mono',
  'Space Mono': 'https://fonts.google.com/specimen/Space+Mono',
  'Berkeley Mono': 'https://berkeleygraphics.com/typefaces/berkeley-mono/',
  'Intel One Mono': 'https://github.com/intel/intel-one-mono',
  'Maple Mono': 'https://github.com/subframe7536/Maple-font',
  'Commit Mono': 'https://github.com/eigilhs/commit-mono',
  'Caveat': 'https://fonts.google.com/specimen/Caveat',
  'Pacifico': 'https://fonts.google.com/specimen/Pacifico',
  'Dancing Script': 'https://fonts.google.com/specimen/Dancing+Script',
  'Lobster': 'https://fonts.google.com/specimen/Lobster',
  'Bebas Neue': 'https://fonts.google.com/specimen/Bebas+Neue',
  'Anton': 'https://fonts.google.com/specimen/Anton',
  'Oswald': 'https://fonts.google.com/specimen/Oswald',
  'Abril Fatface': 'https://fonts.google.com/specimen/Abril+Fatface',
  'Righteous': 'https://fonts.google.com/specimen/Righteous',
  'Fredoka': 'https://fonts.google.com/specimen/Fredoka',
  'Twemoji Mozilla': 'https://github.com/twitter/twemoji',
  'OpenMoji': 'https://openmoji.org/',

  // ───── 中文社区作品（GitHub / 字体网） ─────
  '得意黑': 'https://github.com/atelier-anchor/smiley-sans',
  '未来荧黑': 'https://github.com/watanabei/Source-Han-TrueType',
  '未来风黑体': 'https://github.com/watanabei/Source-Han-TrueType',
  '极影毁片文宋': 'https://github.com/Pal3love/Source-Han-TrueType',
  '鸿雷板书简体': 'https://github.com/wordshub/free-font',
  '演示佛系体': 'https://github.com/wordshub/free-font',
  '演示悠然小楷': 'https://github.com/wordshub/free-font',
  '演示夏行楷': 'https://github.com/wordshub/free-font',
  '寒蝉正楷体': 'https://github.com/StellarCN/scp_zh',
  '寒蝉端黑体': 'https://github.com/StellarCN/scp_zh',
  '寒蝉半糖体': 'https://github.com/StellarCN/scp_zh',
  '寒蝉全圆体': 'https://github.com/StellarCN/scp_zh',
  '江西拙楷体': 'https://github.com/wordshub/free-font',
  '优设标题黑': 'https://github.com/wordshub/free-font',
  '优设巧巧体': 'https://github.com/wordshub/free-font',
  '优设鲨鱼菲特健康体': 'https://github.com/wordshub/free-font',
  '庞门正道粗书体': 'https://github.com/wordshub/free-font',
  '庞门正道标题体': 'https://github.com/wordshub/free-font',
  '摄图摩登小方体': 'https://github.com/wordshub/free-font',
  '摄图胖体': 'https://github.com/wordshub/free-font',
  '千图笔锋手写体': 'https://github.com/wordshub/free-font',
  '千图纤云体': 'https://github.com/wordshub/free-font',
  '千图方块体': 'https://github.com/wordshub/free-font',
  '千图小石头体': 'https://github.com/wordshub/free-font',
  '字魂扁桃体': 'https://www.hellofont.cn/font',
  '字魂大黑魂': 'https://www.hellofont.cn/font',
  '字魂无外润黑体': 'https://www.hellofont.cn/font',
  '胡晓波男神体': 'https://www.hellofont.cn/font',
  '胡晓波真帅体': 'https://www.hellofont.cn/font',
  '胡晓波骚包体': 'https://www.hellofont.cn/font',
  '沐瑶软笔手写体': 'https://www.hellofont.cn/font',
  '沐瑶随心手写体': 'https://www.hellofont.cn/font',
  '萌神手写体': 'https://github.com/wordshub/free-font',
  '标小智龙珠体': 'https://www.hellofont.cn/font',
  '标小智无界黑': 'https://www.hellofont.cn/font',
  '联盟起艺卢帅正锐黑': 'https://github.com/wordshub/free-font',
  '默陌手写体': 'https://github.com/wordshub/free-font',
  '默陌星球': 'https://github.com/wordshub/free-font',
  '游圆体': 'https://github.com/wordshub/free-font',
  '颜宋体': 'https://github.com/wordshub/free-font',
  '莫大毛笔楷书': 'https://github.com/wordshub/free-font',
  '华康手书体': 'https://github.com/wordshub/free-font',
  '包图小白体': 'https://github.com/wordshub/free-font'
}

/**
 * 兑底搜索 URL（百度，国内可用）
 */
function buildFallbackSearch(name) {
  return 'https://www.baidu.com/s?wd=' + encodeURIComponent(name + ' 字体 免费下载')
}

/**
 * 跳转到字体下载源
 * - 有 event 时阻止 a 标签默认跳转（避免弹两次窗）
 * - 无 event 时使用 window.open
 */
function gotoFontHome(event, name) {
  // a 标签本身已经有正确的 href，阻止默认行为后仅记录点击/不重复跳转
  if (event && typeof event.preventDefault === 'function') {
    event.preventDefault()
  }
  const url = FONT_HOMES[name] || buildFallbackSearch(name)
  window.open(url, '_blank', 'noopener,noreferrer')
}

const builtInFonts = [
  { name: '思源黑体', en: 'Source Han Sans', type: '黑体', weights: 7, scene: '正文 / 标题，通用型', license: 'SIL OFL 1.1', emoji: '黑' },
  { name: '思源宋体', en: 'Source Han Serif', type: '宋体', weights: 7, scene: '正式文档、书籍排版', license: 'SIL OFL 1.1', emoji: '宋' },
  { name: '霞鹜文楷', en: 'LXGW WenKai', type: '楷体 / 手写', weights: 5, scene: '文学创作、个人笔记', license: 'SIL OFL 1.1', emoji: '楷' },
  { name: '霞鹜文楷等宽', en: 'LXGW WenKai Mono', type: '等宽楷体', weights: 1, scene: '代码块、技术文档', license: 'SIL OFL 1.1', emoji: '等' },
  { name: '阿里巴巴普惠体', en: 'Alibaba PuHuiTi', type: '现代黑体', weights: 9, scene: '商务文档、PPT', license: '阿里免费商用', emoji: '商' },
  { name: 'HarmonyOS Sans', en: 'HarmonyOS Sans', type: '无衬线黑体', weights: 9, scene: '科技感文档、UI 设计', license: '华为免费商用', emoji: '和' },
  { name: 'JetBrains Mono', en: 'JetBrains Mono', type: '等宽英文', weights: 5, scene: '代码块', license: 'SIL OFL 1.1', emoji: '码' },
  { name: 'Noto Color Emoji', en: 'Noto Color Emoji', type: '彩色表情', weights: 1, scene: '文档插画', license: 'SIL OFL 1.1', emoji: '😊' }
]

/**
 * 在线免费字体清单（100+）
 * 所有字体均为免费可商用（OFL / Apache 2.0 / 阿里 / 华为 / OPPO / 小米 / 站酷 / 方正免费 等）
 * 字段：name 字体名 · type 分类 · scene 典型场景
 */
const onlineFonts = [
  // ────── 中文字体：黑体类 ──────
  { name: '思源黑体 CN', type: '黑体', scene: '正文 / 标题，通用型' },
  { name: '思源黑体 TW', type: '黑体', scene: '繁中正文' },
  { name: '思源黑体 JP', type: '黑体', scene: '日文文档' },
  { name: '思源黑体 KR', type: '黑体', scene: '韩文文档' },
  { name: '思源黑体 HW', type: '半宽黑体', scene: '等高 / 编程字体' },
  { name: '思源黑体 VF', type: '可变黑体', scene: '任意字重调节' },
  { name: '阿里巴巴普惠体 1.0', type: '现代黑体', scene: '商务文档' },
  { name: '阿里巴巴普惠体 2.0', type: '现代黑体', scene: '电商 / 营销' },
  { name: '阿里巴巴普惠体 3.0', type: '现代黑体', scene: 'UI / Web' },
  { name: '阿里巴巴妈妈体', type: '圆润黑体', scene: '电商海报' },
  { name: '阿里汉仪智能黑', type: '黑体', scene: '智能硬件 UI' },
  { name: 'HarmonyOS Sans SC', type: '黑体', scene: '鸿蒙生态应用' },
  { name: 'HarmonyOS Sans TC', type: '黑体', scene: '繁中鸿蒙生态' },
  { name: 'HarmonyOS Sans Latin', type: '黑体', scene: '鸿蒙英文' },
  { name: 'HarmonyOS Sans Mono', type: '等宽黑体', scene: '代码块' },
  { name: 'OPPO Sans', type: '黑体', scene: 'OPPO 品牌物料' },
  { name: 'OPPO Sans 4.0', type: '黑体', scene: '最新 ColorOS 设计' },
  { name: 'vivo Sans', type: '黑体', scene: 'vivo 品牌物料' },
  { name: 'MiSans', type: '黑体', scene: '小米 / 米家生态' },
  { name: 'MiSans VF', type: '可变黑体', scene: '任意字重调节' },
  { name: 'MiSans Latin', type: '黑体', scene: '英文 / 数字' },
  { name: '荣耀 Honor Sans', type: '黑体', scene: '荣耀终端品牌' },
  { name: '思源真黑', type: '黑体', scene: '更精致的黑体' },
  { name: '优设标题黑', type: '标题黑体', scene: 'UI 大标题' },
  { name: '庞门正道粗书体', type: '粗黑体', scene: '海报标题' },
  { name: '标小智无界黑', type: '无衬线黑体', scene: '无障碍阅读' },
  { name: '联盟起艺卢帅正锐黑', type: '锐利黑体', scene: '科技感海报' },
  { name: '未来荧黑', type: '未来风黑体', scene: '科幻 / 游戏 UI' },
  { name: '鸿雷板书简体', type: '板书黑体', scene: '教学板书 / 字幕' },
  { name: '王者黑体', type: '游戏黑体', scene: '电竞海报' },
  { name: '演示佛系体', type: '圆润黑体', scene: '轻松风格文档' },
  { name: '演示悠然小楷', type: '小楷', scene: '小字注释' },

  // ────── 中文字体：宋体/仿宋/楷体/隶书 ──────
  { name: '思源宋体 CN', type: '宋体', scene: '正式文档 / 书籍排版' },
  { name: '思源宋体 TW', type: '宋体', scene: '繁中书籍' },
  { name: '思源宋体 JP', type: '宋体', scene: '日文书籍' },
  { name: '思源宋体 KR', type: '宋体', scene: '韩文书籍' },
  { name: '思源宋体 VF', type: '可变宋体', scene: '任意字重调节' },
  { name: '思源楷体', type: '楷体', scene: '正式楷书文档' },
  { name: '霞鹜文楷', type: '楷体', scene: '文学创作 / 笔记' },
  { name: '霞鹜文楷 TC', type: '楷体', scene: '繁中楷体' },
  { name: '霞鹜文楷等宽', type: '等宽楷体', scene: '技术文档代码块' },
  { name: '霞鹜文楷屏幕阅读版', type: '楷体', scene: '屏幕优化阅读' },
  { name: '寒蝉正楷体', type: '楷体', scene: '传统楷书' },
  { name: '寒蝉端黑体', type: '黑体', scene: '端正文书' },
  { name: '寒蝉半糖体', type: '圆润黑体', scene: '女性向内容' },
  { name: '寒蝉全圆体', type: '圆润黑体', scene: '可爱风格' },
  { name: '江西拙楷体', type: '手写楷体', scene: '拙朴手书' },
  { name: '演示夏行楷', type: '行楷', scene: '签名 / 标题' },
  { name: '默陌手写体', type: '手写体', scene: '个性签名' },
  { name: '默陌星球', type: '手写体', scene: '文艺 / 笔记' },
  { name: '仿宋 GB2312', type: '仿宋', scene: '公文 / 报告' },
  { name: '楷体 GB2312', type: '楷体', scene: '教育 / 抄录' },
  { name: '方正书宋', type: '宋体', scene: '正式公文' },
  { name: '方正仿宋', type: '仿宋', scene: '公文 / 红头文件' },
  { name: '方正黑体', type: '黑体', scene: '正式公文' },
  { name: '方正楷体', type: '楷体', scene: '教育 / 抄录' },
  { name: '汉仪润圆', type: '圆润字体', scene: '童趣海报' },
  { name: '汉仪细圆', type: '细圆体', scene: '女性杂志' },
  { name: '汉仪南宫体', type: '古风体', scene: '古风设计' },
  { name: '汉仪小麦体', type: '圆润体', scene: '儿童读物' },
  { name: '资源圆体', type: '圆润体', scene: '温暖文案' },
  { name: '资源宋体', type: '宋体', scene: '书籍 / 报刊' },

  // ────── 中文字体：手写 / 创意 / 标题 ──────
  { name: '站酷快乐体', type: '创意手写', scene: '标题 / 海报' },
  { name: '站酷文艺体', type: '文艺手写', scene: '小红书风格' },
  { name: '站酷高端黑', type: '创意黑体', scene: '酷感标题' },
  { name: '站酷小薇 LOGO 体', type: 'LOGO 体', scene: '品牌标识' },
  { name: '站酷酷黑体', type: '粗黑体', scene: '强视觉标题' },
  { name: '站库意大利体', type: '创意斜体', scene: '时尚杂志' },
  { name: '站酷庆科黄油体', type: '圆润手写', scene: '可爱 / 食品' },
  { name: '沐瑶软笔手写体', type: '手写毛笔', scene: '中式风格' },
  { name: '沐瑶随心手写体', type: '手写体', scene: '日常手写' },
  { name: '得意黑', type: '圆体', scene: '可爱风 / 产品介绍' },
  { name: '标小智龙珠体', type: '书法体', scene: '标题 / LOGO' },
  { name: '摄图摩登小方体', type: '方正体', scene: '现代设计' },
  { name: '摄图胖体', type: '粗圆体', scene: '强视觉标题' },
  { name: '千图笔锋手写体', type: '手写体', scene: '个性签名' },
  { name: '千图纤云体', type: '纤细体', scene: '优雅标题' },
  { name: '千图方块体', type: '方块体', scene: '科技标题' },
  { name: '千图小石头体', type: '圆润体', scene: '儿童读物' },
  { name: '字魂扁桃体', type: '圆润体', scene: '食品 / 美妆海报' },
  { name: '字魂大黑魂', type: '粗黑体', scene: '强标题' },
  { name: '字魂无外润黑体', type: '圆润黑体', scene: '新中式' },
  { name: '胡晓波男神体', type: '时尚黑体', scene: '男装海报' },
  { name: '胡晓波真帅体', type: '时尚黑体', scene: '潮流设计' },
  { name: '胡晓波骚包体', type: '圆润体', scene: '女性向' },
  { name: '优设鲨鱼菲特健康体', type: '圆润体', scene: '健康 / 运动' },
  { name: '优设巧巧体', type: '圆润体', scene: '儿童 / 食品' },
  { name: '演示悠然小楷', type: '小楷', scene: '小字注释' },
  { name: '演示佛系体', type: '圆润体', scene: '轻松风格' },
  { name: '萌神手写体', type: '手写体', scene: '少女风 / 笔记' },
  { name: '小薇 LOGO 体', type: 'LOGO 体', scene: '品牌标识' },
  { name: '庞门正道标题体', type: '标题黑体', scene: '强标题' },
  { name: '包图小白体', type: '圆润手写', scene: '可爱设计' },
  { name: '华康手书体', type: '手写体', scene: '广告标题' },
  { name: '游圆体', type: '圆润体', scene: '活泼设计' },
  { name: '颜宋体', type: '装饰宋体', scene: '古风标题' },
  { name: '莫大毛笔楷书', type: '毛笔楷体', scene: '古风设计' },

  // ────── 思源系列衍生 / 圆润体 ──────
  { name: '思源柔黑', type: '圆角黑体', scene: '女性向内容' },
  { name: '思源仿宋', type: '仿宋', scene: '正式公文' },
  { name: '思源点阵宋', type: '点阵宋', scene: '复古风格' },
  { name: '文泉驿微米黑', type: '黑体', scene: '开源 Linux 桌面' },
  { name: '文泉驿正黑', type: '黑体', scene: '开源 Linux 桌面' },
  { name: '文泉驿点阵宋', type: '点阵宋', scene: '复古等宽' },
  { name: '文泉驿等宽微米黑', type: '等宽黑体', scene: '代码编辑器' },
  { name: '极影毁片文宋', type: '仿宋', scene: '公文 / 报告' },
  { name: 'Noto Sans CJK SC', type: '黑体', scene: '国际通用' },
  { name: 'Noto Serif CJK SC', type: '宋体', scene: '国际通用' },
  { name: 'Noto Sans Mono CJK SC', type: '等宽', scene: '代码块' },

  // ────── 英文 / 国际化：黑体 / 无衬线 ──────
  { name: 'Inter', type: '英文黑体', scene: 'UI / Web 首选' },
  { name: 'Inter Display', type: '英文黑体', scene: '大字号标题' },
  { name: 'Roboto', type: '英文黑体', scene: 'Android / Web' },
  { name: 'Roboto Flex', type: '可变黑体', scene: '任意字重调节' },
  { name: 'Roboto Condensed', type: '英文黑体', scene: '紧凑排版' },
  { name: 'Open Sans', type: '英文黑体', scene: '通用阅读' },
  { name: 'Lato', type: '英文黑体', scene: '商务文档' },
  { name: 'Montserrat', type: '英文黑体', scene: '现代设计' },
  { name: 'Poppins', type: '英文黑体', scene: 'UI / 标题' },
  { name: 'Nunito', type: '圆润英文', scene: '友好风格' },
  { name: 'Nunito Sans', type: '英文黑体', scene: '正文阅读' },
  { name: 'Manrope', type: '英文黑体', scene: '现代 UI' },
  { name: 'DM Sans', type: '英文黑体', scene: '数字品牌' },
  { name: 'Public Sans', type: '英文黑体', scene: '美国政府 Web' },
  { name: 'Source Sans 3', type: '英文黑体', scene: 'Adobe 出品' },
  { name: 'IBM Plex Sans', type: '英文黑体', scene: 'IBM 品牌' },
  { name: 'Work Sans', type: '英文黑体', scene: '屏幕优化' },
  { name: 'Plus Jakarta Sans', type: '英文黑体', scene: '现代 UI' },
  { name: 'Figtree', type: '英文黑体', scene: 'UI / Web' },
  { name: 'Outfit', type: '英文黑体', scene: '现代品牌' },
  { name: 'Sora', type: '英文黑体', scene: '科技 UI' },
  { name: 'Be Vietnam Pro', type: '英文黑体', scene: '亚洲适配' },
  { name: 'Atkinson Hyperlegible', type: '无障碍黑体', scene: '视障友好' },
  { name: 'Lexend', type: '无障碍黑体', scene: '阅读研究' },
  { name: 'Space Grotesk', type: '英文黑体', scene: '科技 / 极简' },
  { name: 'Archivo', type: '英文黑体', scene: '极简设计' },
  { name: 'Archivo Black', type: '粗黑体', scene: '强标题' },
  { name: 'Rubik', type: '英文黑体', scene: 'UI / Web' },
  { name: 'Karla', type: '英文黑体', scene: '正文阅读' },
  { name: 'Hind', type: '英文黑体', scene: 'UI / 标题' },
  { name: 'Heebo', type: '英文黑体', scene: '希伯来 / 拉丁' },
  { name: 'Mulish', type: '英文黑体', scene: '极简正文' },
  { name: 'Barlow', type: '英文黑体', scene: '技术文档' },
  { name: 'Asap', type: '英文黑体', scene: 'UI 设计' },
  { name: 'Cabin', type: '英文黑体', scene: '屏幕阅读' },
  { name: 'Quicksand', type: '圆润英文', scene: '友好设计' },

  // ────── 英文：衬线 / 宋体 ──────
  { name: 'Source Serif 4', type: '英文衬线', scene: '长文阅读' },
  { name: 'IBM Plex Serif', type: '英文衬线', scene: 'IBM 品牌' },
  { name: 'Lora', type: '英文衬线', scene: '屏幕阅读' },
  { name: 'Merriweather', type: '英文衬线', scene: '新闻 / 博客' },
  { name: 'Playfair Display', type: '英文衬线', scene: '杂志标题' },
  { name: 'Cormorant Garamond', type: '英文衬线', scene: '优雅设计' },
  { name: 'Crimson Pro', type: '英文衬线', scene: '学术论文' },
  { name: 'EB Garamond', type: '英文衬线', scene: '古典排版' },
  { name: 'PT Serif', type: '英文衬线', scene: '俄语 / 多语' },
  { name: 'Roboto Slab', type: '英文衬线', scene: '现代杂志' },
  { name: 'Bitter', type: '英文衬线', scene: '屏幕阅读' },
  { name: 'DM Serif Display', type: '英文衬线', scene: '标题 / 海报' },
  { name: 'Spectral', type: '英文衬线', scene: '长文阅读' },
  { name: 'Libre Baskerville', type: '英文衬线', scene: '经典书籍' },
  { name: 'Cardo', type: '英文衬线', scene: '古典学术' },

  // ────── 等宽 / 代码字体 ──────
  { name: 'JetBrains Mono', type: '等宽英文', scene: 'IDE / 终端' },
  { name: 'JetBrains Mono NL', type: '等宽英文', scene: '无连字版' },
  { name: 'Fira Code', type: '等宽英文', scene: '代码连字' },
  { name: 'Fira Mono', type: '等宽英文', scene: '终端' },
  { name: 'Source Code Pro', type: '等宽英文', scene: 'Adobe 出品' },
  { name: 'IBM Plex Mono', type: '等宽英文', scene: 'IBM 风格' },
  { name: 'Cascadia Code', type: '等宽英文', scene: 'VS Code 内置' },
  { name: 'Cascadia Mono', type: '等宽英文', scene: '终端优化' },
  { name: 'Hack', type: '等宽英文', scene: '代码阅读' },
  { name: 'Inconsolata', type: '等宽英文', scene: '程序员首选' },
  { name: 'Roboto Mono', type: '等宽英文', scene: 'Google 出品' },
  { name: 'Ubuntu Mono', type: '等宽英文', scene: 'Ubuntu 风格' },
  { name: 'Iosevka', type: '等宽英文', scene: '紧凑等宽' },
  { name: 'Geist Mono', type: '等宽英文', scene: 'Vercel 出品' },
  { name: 'DM Mono', type: '等宽英文', scene: '现代等宽' },
  { name: 'Space Mono', type: '等宽英文', scene: '科技 / 设计' },
  { name: 'Berkeley Mono', type: '等宽英文', scene: 'Berkeley 出品' },
  { name: 'Intel One Mono', type: '等宽英文', scene: 'Intel 出品' },
  { name: 'Maple Mono', type: '等宽英文', scene: '圆润等宽' },
  { name: 'Commit Mono', type: '等宽英文', scene: '现代等宽' },

  // ────── 装饰 / 手写 / 艺术英文 ──────
  { name: 'Caveat', type: '手写英文', scene: '个性签名' },
  { name: 'Pacifico', type: '手写英文', scene: '复古海报' },
  { name: 'Dancing Script', type: '手写英文', scene: '婚礼 / 邀请函' },
  { name: 'Lobster', type: '装饰英文', scene: 'Logo / 海报' },
  { name: 'Bebas Neue', type: '装饰英文', scene: '海报标题' },
  { name: 'Anton', type: '粗体英文', scene: '强视觉标题' },
  { name: 'Oswald', type: '装饰英文', scene: '紧凑标题' },
  { name: 'Abril Fatface', type: '装饰英文', scene: '杂志标题' },
  { name: 'Righteous', type: '装饰英文', scene: '复古风格' },
  { name: 'Fredoka', type: '圆润英文', scene: '友好设计' },

  // ────── 表情 / 彩色 ──────
  { name: 'Noto Color Emoji', type: '彩色表情', scene: '文档插画' },
  { name: 'Twemoji Mozilla', type: '彩色表情', scene: '网页表情' },
  { name: 'OpenMoji', type: '彩色表情', scene: '开源表情' }
]

const importRules = [
  { key: '支持格式', value: '.ttf / .otf / .woff / .woff2' },
  { key: '导入方式', value: '「设置 → 字体 → 导入本地字体」，一键启用' },
  { key: '授权责任', value: '用户需自行确保已获得合法授权；WPX 不提供商业字体' },
  { key: '嵌入导出', value: '导入的字体可子集化嵌入 PDF / DOCX，随文档携带' }
]
</script>

<template>
  <section class="wpx-section pt-32">
    <div class="wpx-container">
      <!-- Hero -->
      <div class="mx-auto max-w-3xl text-center">
        <span class="wpx-chip">字体库</span>
        <h1 class="mt-4 text-2xl font-extrabold sm:text-3xl md:text-4xl lg:text-5xl">
          <span class="wpx-gradient-text">好看的字体，免费、合法、即装即用</span>
        </h1>
        <p class="mt-4 text-dark/60">
          <strong class="text-emerald-700">{{ builtInFonts.length }} 款</strong>免费开源字体随应用打包；
          <strong class="text-emerald-700">{{ onlineFonts.length }}+ 款</strong>免费字体按需下载；
          商业字体由用户<strong class="text-emerald-700">自行采购授权后导入</strong>，平台不收费。
        </p>
      </div>

      <!-- 内置字体区 -->
      <div class="mt-16">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="text-2xl font-extrabold md:text-3xl">
              <span class="wpx-gradient-text">内置字体</span>
            </h2>
            <p class="mt-2 text-sm text-dark/60">
              安装即用，无需联网。中文字体已子集化，安装包体积控制良好。
            </p>
          </div>
          <span class="hidden rounded-full bg-accent-mint/20 px-3 py-1 text-xs font-semibold text-emerald-700 md:inline-block">
            {{ builtInFonts.length }} 款免费
          </span>
        </div>

        <div class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <article
            v-for="f in builtInFonts"
            :key="f.name"
            class="group relative flex flex-col rounded-2xl border border-dark/5 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary-500/30 hover:shadow-wpx"
          >
            <a
              v-if="FONT_HOMES[f.name]"
              :href="FONT_HOMES[f.name]"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute inset-0 z-10 rounded-2xl"
              :title="`查看「${f.name}」官方源`"
            >
              <span class="sr-only">查看 {{ f.name }} 官方源</span>
            </a>
            <div class="pointer-events-none flex items-center gap-3">
              <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-wpx-gradient text-lg font-extrabold text-white shadow-wpx">
                {{ f.emoji }}
              </div>
              <div class="min-w-0">
                <h3 class="truncate text-base font-bold group-hover:text-primary-600">
                  {{ f.name }}
                </h3>
                <p class="truncate text-xs text-dark/50">
                  {{ f.en }}
                </p>
              </div>
            </div>
            <dl class="pointer-events-none mt-4 space-y-1.5 text-xs text-dark/70">
              <div class="flex justify-between">
                <dt class="text-dark/50">类型</dt>
                <dd class="font-semibold">{{ f.type }}</dd>
              </div>
              <div class="flex justify-between">
                <dt class="text-dark/50">字重</dt>
                <dd class="font-semibold">{{ f.weights }} 字重</dd>
              </div>
              <div class="flex justify-between gap-2">
                <dt class="text-dark/50">场景</dt>
                <dd class="text-right font-semibold">{{ f.scene }}</dd>
              </div>
            </dl>
            <span class="pointer-events-none mt-4 inline-flex w-fit items-center rounded-full bg-wpx-gradient-soft px-2.5 py-0.5 text-[11px] font-semibold text-primary-600">
              {{ f.license }}
            </span>
            <span
              v-if="FONT_HOMES[f.name]"
              class="pointer-events-none absolute right-3 top-3 z-20 rounded-full bg-white/80 p-1 text-dark/30 group-hover:text-primary-500"
              aria-hidden="true"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          </article>
        </div>
      </div>

      <!-- 在线免费字体 -->
      <div class="mt-20">
        <div class="flex items-end justify-between">
          <div>
            <h2 class="text-2xl font-extrabold md:text-3xl">
              <span class="wpx-gradient-text">在线免费字体</span>
            </h2>
            <p class="mt-2 text-sm text-dark/60">
              点击任一字体跳转到官方下载页 / GitHub 仓库 / 百度搜索。下载后导入 WPX 即可使用。
            </p>
          </div>
          <span class="hidden rounded-full bg-accent-mint/20 px-3 py-1 text-xs font-semibold text-emerald-700 md:inline-block">
            {{ onlineFonts.length }}+ 款免费
          </span>
        </div>

        <div class="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <a
            v-for="f in onlineFonts"
            :key="f.name"
            :href="FONT_HOMES[f.name] || buildFallbackSearch(f.name)"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex w-full items-center gap-3 rounded-xl border border-dark/5 bg-white px-4 py-3 text-left text-dark no-underline transition-all hover:-translate-y-0.5 hover:border-primary-500/40 hover:bg-wpx-gradient-soft/50 hover:shadow-wpx focus:outline-none focus:ring-2 focus:ring-primary-500/40"
            :title="FONT_HOMES[f.name] ? '点击跳转到官方下载源' : '点击跳转到百度搜索'"
            @click="gotoFontHome($event, f.name)"
          >
            <div class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-wpx-gradient-soft text-sm font-bold text-primary-600">
              {{ f.name.slice(0, 1) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-bold group-hover:text-primary-600">
                {{ f.name }}
              </div>
              <div class="truncate text-xs text-dark/50">
                {{ f.type }} · {{ f.scene }}
              </div>
            </div>
            <span
              class="flex-shrink-0 text-dark/30 transition-colors group-hover:text-primary-500"
              aria-hidden="true"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17 17 7" />
                <path d="M7 7h10v10" />
              </svg>
            </span>
          </a>
        </div>

        <p class="mt-6 text-center text-xs text-dark/50">
          💡 下载字体文件后，在 WPX 桌面端「设置 → 字体 → 导入本地字体」一键启用。
        </p>
      </div>

      <!-- 商业字体：用户自备导入 -->
      <div class="mt-20 rounded-3xl border border-emerald-500/20 bg-emerald-50/40 p-8 md:p-10">
        <div class="grid gap-8 md:grid-cols-2 md:items-center">
          <div>
            <h2 class="text-2xl font-extrabold md:text-3xl">
              <span class="wpx-gradient-text">需要商业字体？</span>
            </h2>
            <p class="mt-3 text-dark/70">
              商业字体需由用户<strong class="text-emerald-700">自行采购授权</strong>后导入本地使用。
              WPX 不提供商业字体、不收取 Token 费用、不介入授权交易。
            </p>
            <div class="mt-6 flex flex-wrap gap-3">
              <a
                href="https://github.com/wpx-team/wpx/discussions"
                target="_blank"
                rel="noopener noreferrer"
                class="wpx-btn-primary"
              >
                交流字体使用心得
              </a>
              <router-link
                to="/changelog"
                class="wpx-btn-ghost"
              >
                查看更新历史
              </router-link>
            </div>
          </div>
          <div class="rounded-2xl bg-white p-6 shadow-sm">
            <h3 class="text-sm font-semibold uppercase tracking-wider text-dark/50">
              本地字体导入规则
            </h3>
            <dl class="mt-4 space-y-3 text-sm">
              <div
                v-for="r in importRules"
                :key="r.key"
                class="flex justify-between gap-3 border-b border-dark/5 pb-3 last:border-0 last:pb-0"
              >
                <dt class="font-semibold text-dark/70">{{ r.key }}</dt>
                <dd class="text-right text-dark/80">{{ r.value }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <!-- Bottom CTA -->
      <div class="mt-16 text-center">
        <p class="text-sm text-dark/60">
          想把字体立即用起来？下载 WPX，所有内置字体一键启用。
        </p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            href="/#download"
            class="wpx-btn-cta-pulse"
            aria-label="免费下载 WPX"
          >
            <span>免费下载 WPX</span>
          </a>
          <router-link
            to="/changelog"
            class="wpx-btn-ghost"
          >
            查看更新历史
          </router-link>
        </div>
      </div>
    </div>
  </section>
</template>
