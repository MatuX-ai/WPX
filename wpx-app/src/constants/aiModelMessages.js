export const MISSING_CUSTOM_API = 'MISSING_CUSTOM_API'

// V1.1 起平台不再提供任何「公共 / 免费」大模型：
// 所有用户（访客 / 注册）一律需要在「我的模型」中自行接入大模型 API。
// 当某条请求确实需要 AI 理解和思考（且本地指令未命中）时，才提示用户去配置。
//
// 文案走「对话引导」而非「报错」：提供【设置】【自己写】双出口，
// 避免「AI 帮我写」在未接入模型时出现生硬错误感。
export const MISSING_CUSTOM_API_MESSAGE =
  '未配置大模型，我无法思考，请你【配置大模型】【自己动手】'
