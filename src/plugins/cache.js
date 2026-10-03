/**
 * 本地缓存（localStorage / sessionStorage）封装
 * 沿用原项目 plugins/cache 的使用方式
 */

const sessionCache = {
  set(key, value) {
    if (!sessionStorage) return
    if (key != null && value != null) {
      sessionStorage.setItem(key, value)
    }
  },
  get(key) {
    if (!sessionStorage) return null
    if (arguments.length === 1) {
      return sessionStorage.getItem(key)
    }
    return null
  },
  setJSON(key, jsonValue) {
    if (jsonValue != null) {
      this.set(key, JSON.stringify(jsonValue))
    }
  },
  getJSON(key) {
    const value = this.get(key)
    if (value != null) {
      return JSON.parse(value)
    }
    return null
  },
  remove(key) {
    sessionStorage.removeItem(key)
  }
}

const localCache = {
  set(key, value) {
    if (!localStorage) return
    if (key != null && value != null) {
      localStorage.setItem(key, value)
    }
  },
  get(key) {
    if (!localStorage) return null
    if (arguments.length === 1) {
      return localStorage.getItem(key)
    }
    return null
  },
  setJSON(key, jsonValue) {
    if (jsonValue != null) {
      this.set(key, JSON.stringify(jsonValue))
    }
  },
  getJSON(key) {
    const value = this.get(key)
    if (value != null) {
      return JSON.parse(value)
    }
    return null
  },
  remove(key) {
    localStorage.removeItem(key)
  }
}

export default {
  session: sessionCache,
  local: localCache
}
