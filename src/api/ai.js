/**
 * AI 助手接口
 * 未配置后端时（VITE_APP_AI_ENABLE != true）直接返回空串，
 * 由 utils/assistant.js 的本地解析兜底，保证离线也能用。
 */
import request from '@/utils/request'

const AI_ENABLED = import.meta.env.VITE_APP_AI_ENABLE === 'true'

/**
 * 发送对话
 * @param {String} text 用户输入
 * @param {Array} history 历史消息
 * @returns {Promise<String>} 回答内容（HTML 片段）
 */
export function chat(text, history = []) {
  if (!AI_ENABLED) return Promise.resolve('')
  return request({
    url: '/ai/chat',
    method: 'post',
    data: {
      text,
      history: history.slice(-10).map((m) => ({ role: m.role, content: m.html }))
    },
    // 对话类请求不做防重复提交校验
    headers: { repeatSubmit: true }
  }).then((res) => res?.answer || res?.data?.answer || '')
}

export default { chat }
