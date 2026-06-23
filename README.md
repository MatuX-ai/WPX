# WPX

AI 智能文档编辑器，基于 Electron + Vue3 的多窗口应用。

## 开发

```bash
npm run electron:dev
```

完整说明见 `docs/` 与 `.cursor/skills/wpx-development/SKILL.md`。

## 内置字体

WPX 内置 8 款免费商用字体，安装包需从官方渠道下载后放入 `resources/fonts/built-in/`。**字体文件体积较大，不纳入 Git 仓库**；克隆项目后请按下方说明自行下载，打包前确保目录内已有字体文件（`electron-builder` 会将 `resources/fonts/` 一并打入安装包）。

### 下载方式

| 字体 | 官方下载 | 建议放置路径 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | https://github.com/adobe-fonts/source-han-sans/releases | `resources/fonts/built-in/source-han-sans/` |
| 思源宋体 (Source Han Serif) | https://github.com/adobe-fonts/source-han-serif/releases | `resources/fonts/built-in/source-han-serif/` |
| 霞鹜文楷 (LXGW WenKai) | https://github.com/lxgw/LxgwWenKai/releases | `resources/fonts/built-in/lxgw-wenkai/` |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | https://github.com/lxgw/LxgwWenKaiMono/releases | `resources/fonts/built-in/lxgw-wenkai-mono/` |
| 阿里巴巴普惠体 | https://www.alibabafonts.com/ | `resources/fonts/built-in/alibaba-puhuiti/` |
| HarmonyOS Sans | https://developer.harmonyos.com/en/design/resource/ | `resources/fonts/built-in/harmonyos-sans/` |
| JetBrains Mono | https://www.jetbrains.com/lp/mono/ | `resources/fonts/built-in/jetbrains-mono/` |
| Noto Color Emoji | https://github.com/googlefonts/noto-emoji | `resources/fonts/built-in/noto-color-emoji/` |

**简要步骤：**

1. 从上表链接下载对应字体包（通常为 `.zip` 或 `.7z`）。
2. 解压后将 `.ttf` / `.otf` / `.woff2` 等字体文件放入建议子目录（可按需子集化，见 `WPX 字体库需求文档.md`）。
3. 运行 `npm run electron:build` 前确认 `resources/fonts/built-in/` 下已有文件；空目录不会报错，但应用内将无法使用内置字体。

## 字体版权声明

以下字体随 WPX 分发（由开发者本地下载并打包），均为免费可商用授权。各字体版权归原作者所有。

| 字体名称 | 作者 / 版权方 | 开源 / 授权协议 |
|:---|:---|:---|
| 思源黑体 (Source Han Sans) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 思源宋体 (Source Han Serif) | Adobe、Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷 (LXGW WenKai) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 霞鹜文楷等宽 (LXGW WenKai Mono) | 落霞孤鹜 (lxgw) | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| 阿里巴巴普惠体 (Alibaba PuHuiTi) | 阿里巴巴 | [阿里巴巴字体免费商用授权](https://www.alibabafonts.com/) |
| HarmonyOS Sans | 华为 (Huawei) | [HarmonyOS Sans 字体许可](https://developer.huawei.com/consumer/cn/doc/design-guides/font-0000001773938985)（免费可商用） |
| JetBrains Mono | JetBrains | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |
| Noto Color Emoji | Google | [SIL Open Font License 1.1](https://scripts.sil.org/OFL) |

使用或再分发上述字体时，请遵守各自许可条款（通常需保留版权声明与许可全文）。WPX 应用内可在「关于」或设置中展示本表摘要。
