import {
  ChartBar,
  Code,
  FileText,
  Heading,
  Image,
  Languages,
  ListTree,
  Maximize2,
  MessageCircleQuestion,
  Minimize2,
  PenLine,
  RefreshCw,
  Repeat,
  Sparkles,
  Table,
} from '@lucide/vue'

/** @type {Record<string, import('vue').Component>} */
export const SKILL_ICON_MAP = {
  'pen-line': PenLine,
  'refresh-cw': RefreshCw,
  'maximize-2': Maximize2,
  'minimize-2': Minimize2,
  languages: Languages,
  'file-text': FileText,
  'list-tree': ListTree,
  heading: Heading,
  sparkles: Sparkles,
  repeat: Repeat,
  image: Image,
  table: Table,
  'message-circle-question': MessageCircleQuestion,
  code: Code,
  'chart-bar': ChartBar,
}

/**
 * @param {string} iconName
 * @returns {import('vue').Component | null}
 */
export function resolveSkillIcon(iconName) {
  return SKILL_ICON_MAP[iconName] ?? null
}
