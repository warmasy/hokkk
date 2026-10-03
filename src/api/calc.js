/**
 * 计算相关接口
 *
 * 使用方式（切换某个按钮到后端计算）：
 *   在 src/config/ribbon/*.js 里把按钮改成
 *     { ... , mode: 'api', api: { url: '/calc/inertia/rod-center', method: 'post' } }
 *   计算框会自动请求该接口，界面、曲线、结果渲染都不用改。
 *
 * 约定后端返回（任一形式均可，store 会自动兼容）：
 *   { code: 200, data: [{ label: '转动惯量 J', value: 0.2083, unit: 'kg·m²' }] }
 *   { code: 200, rows: [ ... ] }
 *   [{ label, value, unit }]
 */
import request, { download } from '@/utils/request'

/**
 * 通用计算执行接口
 * @param {Object} payload { itemKey, values }
 * @param {Object} api     { url, method } 按钮上配置的接口信息
 */
export function executeCalc(payload, api = {}) {
  const url = api.url || '/calc/execute'
  const method = (api.method || 'post').toLowerCase()
  return method === 'get'
    ? request({ url, method: 'get', params: payload })
    : request({ url, method: 'post', data: payload })
}

/** 查询方案列表 */
export function listScheme(query) {
  return request({
    url: '/calc/scheme/list',
    method: 'get',
    params: query
  })
}

/** 查询方案详细 */
export function getScheme(id) {
  return request({
    url: '/calc/scheme/' + id,
    method: 'get'
  })
}

/** 新增方案 */
export function addScheme(data) {
  return request({
    url: '/calc/scheme',
    method: 'post',
    data
  })
}

/** 修改方案 */
export function updateScheme(data) {
  return request({
    url: '/calc/scheme',
    method: 'put',
    data
  })
}

/** 删除方案 */
export function delScheme(ids) {
  return request({
    url: '/calc/scheme/' + ids,
    method: 'delete'
  })
}

/** 兼容旧调用：后端执行计算 */
export function runCalc(data) {
  return executeCalc(data)
}

/** 导出计算结果 */
export function exportCalc(params) {
  return download('/calc/export', params, `计算结果_${new Date().getTime()}.xlsx`)
}
