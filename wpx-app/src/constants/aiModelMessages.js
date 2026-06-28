export const MISSING_CUSTOM_API = 'MISSING_CUSTOM_API'

// V1 完全免费模式：平台不再提供公共模型额度，所有用户（访客 / 注册）一视同仁。
// 提示统一为「去设置 → 我的模型 自行接入大模型 API」。
export const GUEST_MISSING_CUSTOM_API_MESSAGE =
  '请先在「我的模型」中接入大模型 API 后再使用 AI 能力。'

export const LOGGED_IN_MISSING_CUSTOM_API_MESSAGE =
  '自定义模型未配置 API Key，请在「我的模型」中保存后再试。'

// V1 模式下「公共模型额度耗尽」概念已不存在，但为保持错误码兼容，保留同义文案。
export const LOGGED_IN_QUOTA_EXHAUSTED_CONFIGURE_MESSAGE =
  '平台不再提供公共模型额度，请在「我的模型」中接入大模型 API（完全免费）继续使用 AI 能力。'

export const LOGGED_IN_QUOTA_EXHAUSTED_RECHARGE_MESSAGE =
  '平台不再提供公共模型额度，请前往「我的模型」接入大模型 API。'
