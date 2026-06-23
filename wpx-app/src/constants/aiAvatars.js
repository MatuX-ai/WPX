/** 预设 AI 助手头像（SVG data URL） */
export const AI_AVATAR_PRESETS = [
  {
    id: 'robot',
    label: '机器人',
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#8b5cf6"/><stop offset="100%" stop-color="#6d28d9"/></linearGradient></defs><circle cx="28" cy="28" r="28" fill="url(#g)"/><rect x="16" y="22" width="24" height="18" rx="5" fill="#fff" opacity="0.95"/><circle cx="22" cy="30" r="2.5" fill="#6d28d9"/><circle cx="34" cy="30" r="2.5" fill="#6d28d9"/><path d="M24 38h8" stroke="#6d28d9" stroke-width="2" stroke-linecap="round"/><path d="M28 14v4M20 18h16" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="20" cy="18" r="2" fill="#fff"/><circle cx="36" cy="18" r="2" fill="#fff"/></svg>`)}`,
  },
  {
    id: 'cat',
    label: '猫',
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#fb923c"/><stop offset="100%" stop-color="#ea580c"/></linearGradient></defs><circle cx="28" cy="28" r="28" fill="url(#g)"/><path d="M18 24l-4-8 6 3 8-6 8 6 6-3-4 8" fill="#fff" opacity="0.95"/><ellipse cx="28" cy="32" rx="10" ry="8" fill="#fff" opacity="0.95"/><circle cx="24" cy="31" r="2" fill="#ea580c"/><circle cx="32" cy="31" r="2" fill="#ea580c"/><path d="M26 35h4" stroke="#ea580c" stroke-width="1.5" stroke-linecap="round"/></svg>`)}`,
  },
  {
    id: 'owl',
    label: '猫头鹰',
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#5b21b6"/></linearGradient></defs><circle cx="28" cy="28" r="28" fill="url(#g)"/><ellipse cx="28" cy="30" rx="14" ry="12" fill="#fff" opacity="0.95"/><circle cx="22" cy="28" r="5" fill="#5b21b6"/><circle cx="34" cy="28" r="5" fill="#5b21b6"/><circle cx="22" cy="28" r="2" fill="#fff"/><circle cx="34" cy="28" r="2" fill="#fff"/><path d="M28 18l3 6h-6l3-6z" fill="#fff"/></svg>`)}`,
  },
  {
    id: 'book',
    label: '魔法书',
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#34d399"/><stop offset="100%" stop-color="#059669"/></linearGradient></defs><circle cx="28" cy="28" r="28" fill="url(#g)"/><path d="M18 18h9a4 4 0 014 4v20a3 3 0 00-3-2H18V18z" fill="#fff" opacity="0.95"/><path d="M38 18h-9a4 4 0 00-4 4v20a3 3 0 013-2h10V18z" fill="#fff" opacity="0.85"/><path d="M28 22l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5L28 22z" fill="#059669"/></svg>`)}`,
  },
  {
    id: 'pen',
    label: '笔尖',
    url: `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60a5fa"/><stop offset="100%" stop-color="#2563eb"/></linearGradient></defs><circle cx="28" cy="28" r="28" fill="url(#g)"/><path d="M34 16l6 6-16 16-8 2 2-8 16-16z" fill="#fff" opacity="0.95"/><path d="M30 20l6 6" stroke="#2563eb" stroke-width="1.5" stroke-linecap="round"/><path d="M18 38l4 1" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>`)}`,
  },
]

export const AI_AVATAR_PRESET_IDS = AI_AVATAR_PRESETS.map((item) => item.id)

export const DEFAULT_AVATAR_ID = 'robot'

export function getAvatarPreset(id) {
  return AI_AVATAR_PRESETS.find((item) => item.id === id) ?? AI_AVATAR_PRESETS[0]
}

export function getAvatarUrlById(id) {
  return getAvatarPreset(id).url
}
