/**
 * 通用工具函数（沿用原项目思路，去除 RuoYi 专属依赖）
 */

/**
 * 添加日期范围参数
 * @param {Object} params 查询参数
 * @param {String} dateRange 日期范围数组名
 * @param {String} propName 属性名
 */
export function addDateRange(params, dateRange, propName) {
  const search = params
  search.params = typeof search.params === 'object' && search.params !== null && !Array.isArray(search.params) ? search.params : {}
  dateRange = Array.isArray(dateRange) ? dateRange : []
  if (typeof propName === 'undefined') {
    search.params['beginTime'] = dateRange[0]
    search.params['endTime'] = dateRange[1]
  } else {
    search.params['begin' + propName] = dateRange[0]
    search.params['end' + propName] = dateRange[1]
  }
  return search
}

/**
 * 回显数据字典
 */
export function selectDictLabel(datas, value) {
  if (value === undefined) return ''
  const actions = []
  Object.keys(value).forEach((key) => {
    datas.some((dict) => {
      if (dict.value == value[key]) {
        actions.push(dict.label + '')
        return true
      }
      return false
    })
  })
  return actions.join('')
}

/**
 * 构造树型结构数据
 */
export function handleTree(data, id, parentId, children) {
  const config = {
    id: id || 'id',
    parentId: parentId || 'parentId',
    childrenList: children || 'children'
  }
  const childrenListMap = {}
  const nodeIds = {}
  const tree = []
  for (const d of data) {
    const pid = d[config.parentId]
    if (childrenListMap[pid] == null) {
      childrenListMap[pid] = []
    }
    nodeIds[d[config.id]] = d
    childrenListMap[pid].push(d)
  }
  for (const d of data) {
    const pid = d[config.parentId]
    if (nodeIds[pid] == null) {
      tree.push(d)
    }
  }
  const adaptToChildrenList = (o) => {
    if (childrenListMap[o[config.id]] !== null) {
      o[config.childrenList] = childrenListMap[o[config.id]]
    }
    if (o[config.childrenList]) {
      for (const c of o[config.childrenList]) {
        adaptToChildrenList(c)
      }
    }
  }
  for (const t of tree) {
    adaptToChildrenList(t)
  }
  return tree
}

/**
 * 参数处理（GET 参数拼接）
 */
export function tansParams(params) {
  let result = ''
  for (const propName of Object.keys(params)) {
    const value = params[propName]
    const part = encodeURIComponent(propName) + '='
    if (value !== null && value !== '' && typeof value !== 'undefined') {
      if (typeof value === 'object') {
        for (const key of Object.keys(value)) {
          if (value[key] !== null && value[key] !== '' && typeof value[key] !== 'undefined') {
            const paramKey = propName + '[' + key + ']'
            const subPart = encodeURIComponent(paramKey) + '='
            result += subPart + encodeURIComponent(value[key]) + '&'
          }
        }
      } else {
        result += part + encodeURIComponent(value) + '&'
      }
    }
  }
  return result
}

/**
 * 验证是否为 blob
 */
export function blobValidate(data) {
  return data.type !== 'application/json'
}
