/**
 * 自定义 axios 封装（沿用原项目思路，已去除传输加密与 RuoYi 强绑定）
 *
 * 特性：
 *  1. 自动携带 Token（Authorization: Bearer xxx）
 *  2. 防重复提交（POST/PUT 默认开启，可通过 headers.repeatSubmit = false 关闭）
 *  3. GET 参数自动拼接到 URL
 *  4. 统一响应处理（code/msg + 401 过期处理）
 *  5. 统一错误提示（网络异常 / 超时 / 状态码）
 *  6. 通用文件下载 download()
 *
 * 用法：
 *   import request from '@/utils/request'
 *   request({ url: '/api/xxx', method: 'get', params: {...} })
 *   download('/api/export', params, '文件名.xlsx')
 */
import axios from 'axios'
import { saveAs } from 'file-saver'
import { getToken, removeToken } from '@/utils/auth'
import errorCode from '@/utils/errorCode'
import { tansParams, blobValidate } from '@/utils/ruoyi'
import cache from '@/plugins/cache'
import modal from '@/plugins/modal'

// 是否正在显示"重新登录"确认框
export const isRelogin = { show: false }

axios.defaults.headers['Content-Type'] = 'application/json;charset=utf-8'

// 创建 axios 实例
const service = axios.create({
  // 请求公共前缀（见 .env.development / .env.production）
  baseURL: import.meta.env.VITE_APP_BASE_API,
  timeout: 15000
})

// ------------------------- 请求拦截器 -------------------------
service.interceptors.request.use(
  async (config) => {
    // 是否需要 token（显式设置 headers.isToken = false 可跳过）
    const isToken = (config.headers || {}).isToken === false
    // 是否需要防重复提交（显式设置 headers.repeatSubmit = false 可跳过）
    const isRepeatSubmit = (config.headers || {}).repeatSubmit === false
    // 间隔时间(ms)，小于此时间视为重复提交
    const interval = (config.headers || {}).interval || 1000

    if (getToken() && !isToken) {
      config.headers['Authorization'] = 'Bearer ' + getToken()
    }

    if (!isRepeatSubmit && (config.method === 'post' || config.method === 'put')) {
      const requestObj = {
        url: config.url,
        data: typeof config.data === 'object' ? JSON.stringify(config.data) : config.data,
        time: new Date().getTime()
      }
      const requestSize = Object.keys(JSON.stringify(requestObj)).length
      const limitSize = 5 * 1024 * 1024 // 超过 5M 不做防重校验
      if (requestSize >= limitSize) {
        console.warn(`[${config.url}]: 请求数据大小超出允许的 5M 限制，跳过防重复提交校验。`)
        return config
      }
      const sessionObj = cache.session.getJSON('sessionObj')
      if (sessionObj === undefined || sessionObj === null || sessionObj === '') {
        cache.session.setJSON('sessionObj', requestObj)
      } else {
        const sUrl = sessionObj.url
        const sData = sessionObj.data
        const sTime = sessionObj.time
        if (sData === requestObj.data && requestObj.time - sTime < interval && sUrl === requestObj.url) {
          const message = '数据正在处理，请勿重复提交'
          console.warn(`[${sUrl}]: ${message}`)
          return Promise.reject(new Error(message))
        } else {
          cache.session.setJSON('sessionObj', requestObj)
        }
      }
    }

    // GET 请求参数映射到 URL
    if (config.method === 'get' && config.params) {
      let url = config.url + '?' + tansParams(config.params)
      url = url.slice(0, -1)
      config.params = {}
      config.url = url
    }
    return config
  },
  (error) => {
    console.log(error)
    return Promise.reject(error)
  }
)

// ------------------------- 响应拦截器 -------------------------
service.interceptors.response.use(
  (res) => {
    // 未设置状态码则默认成功
    const code = res.data.code || 200
    const msg = errorCode[code] || res.data.msg || errorCode['default']

    // 二进制数据（文件流）直接返回
    const responseType = res.request?.responseType
    if (responseType === 'blob' || responseType === 'arraybuffer') {
      return res.data
    }

    if (code === 401) {
      if (!isRelogin.show) {
        isRelogin.show = true
        modal
          .confirm('登录状态已过期，请重新登录', '系统提示', { confirmButtonText: '重新登录', cancelButtonText: '取消' })
          .then(() => {
            isRelogin.show = false
            removeToken()
            location.href = '/'
          })
          .catch(() => {
            isRelogin.show = false
          })
      }
      return Promise.reject('无效的会话，或者会话已过期，请重新登录。')
    } else if (code === 500) {
      modal.msgError(msg)
      return Promise.reject(new Error(msg))
    } else if (code === 601) {
      modal.msgWarning(msg)
      return Promise.reject(new Error(msg))
    } else if (code !== 200) {
      modal.notifyError({ title: msg })
      return Promise.reject(new Error(msg))
    }
    return Promise.resolve(res.data)
  },
  (error) => {
    console.log('err' + error)
    const response = error.response
    const responseStatus = response?.status
    const responseCode = response?.data?.code
    const responseMsg = response?.data?.msg

    if (responseMsg) {
      const messageType = responseStatus === 429 || responseCode === 429 ? 'warning' : 'error'
      modal.msg({ message: responseMsg, type: messageType, duration: 5000 })
      return Promise.reject(new Error(responseMsg))
    }

    let { message } = error
    if (message === 'Network Error') {
      message = '后端接口连接异常'
    } else if (message.includes('timeout')) {
      message = '系统接口请求超时'
    } else if (message.includes('Request failed with status code')) {
      message = '系统接口' + message.slice(-3) + '异常'
    }
    modal.msg({ message, type: 'error', duration: 5000 })
    return Promise.reject(error)
  }
)

/**
 * 通用文件下载
 * @param {String} url 下载地址
 * @param {Object} params 请求参数
 * @param {String} filename 保存文件名
 * @param {Object} config 额外配置
 */
export function download(url, params, filename, config) {
  const loadingInstance = modal.loading('正在下载数据，请稍候')
  return service
    .post(url, params, {
      transformRequest: [(p) => tansParams(p)],
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      responseType: 'blob',
      ...config
    })
    .then(async (data) => {
      const isBlob = blobValidate(data)
      if (isBlob) {
        saveAs(new Blob([data]), filename)
      } else {
        const resText = await data.text()
        const rspObj = JSON.parse(resText)
        const errMsg = errorCode[rspObj.code] || rspObj.msg || errorCode['default']
        modal.msgError(errMsg)
      }
      loadingInstance.close()
    })
    .catch((r) => {
      console.error(r)
      modal.msgError('下载文件出现错误，请联系管理员！')
      loadingInstance.close()
    })
}

export default service
