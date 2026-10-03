import { defineStore } from 'pinia'

/** 仅保留三种主题：白 / 黑 / 科技蓝 */
export const THEME_SEQUENCE = ['light', 'dark', 'tech']

export const THEME_META = {
  light: { label: '白', icon: 'fa-solid fa-moon' },
  dark: { label: '黑', icon: 'fa-solid fa-circle-half-stroke' },
  tech: { label: '科技蓝', icon: 'fa-solid fa-satellite-dish' }
}

const STORAGE_KEY = 'mc-theme'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    theme: 'light'
  }),
  getters: {
    meta: (state) => THEME_META[state.theme] || THEME_META.light,
    icon: (state) => (THEME_META[state.theme] || THEME_META.light).icon,
    label: (state) => (THEME_META[state.theme] || THEME_META.light).label
  },
  actions: {
    /** 应用主题（写 body class + 本地缓存） */
    applyTheme(theme) {
      const target = THEME_SEQUENCE.includes(theme) ? theme : 'light'
      this.theme = target
      const body = document.body
      // 切换过程关闭过渡动画，避免大面积闪烁
      body.classList.add('no-transition')
      THEME_SEQUENCE.forEach((t) => {
        if (t !== 'light') body.classList.remove(`${t}-theme`)
      })
      // 老版本可能残留的绿色主题类一并清理
      body.classList.remove('green-theme')
      if (target !== 'light') body.classList.add(`${target}-theme`)
      try {
        localStorage.setItem(STORAGE_KEY, target)
      } catch (e) {
        /* 忽略隐私模式下的写入异常 */
      }
      setTimeout(() => body.classList.remove('no-transition'), 220)
    },
    /** 依次切换到下一个主题 */
    toggleTheme() {
      const idx = THEME_SEQUENCE.indexOf(this.theme)
      const next = THEME_SEQUENCE[(idx + 1) % THEME_SEQUENCE.length]
      this.applyTheme(next)
    },
    /** 初始化：优先读取本地缓存 */
    initTheme() {
      let saved = ''
      try {
        saved = localStorage.getItem(STORAGE_KEY) || ''
      } catch (e) {
        saved = ''
      }
      this.applyTheme(THEME_SEQUENCE.includes(saved) ? saved : 'light')
    }
  }
})
