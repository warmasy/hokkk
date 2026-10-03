// O3DV 查看器核心 Composable
// 负责：动态加载 O3DV 资源、启动 3dviewer.net 界面、加载默认模型、
//       系统主题跟随、事件分发、组件卸载清理
import { onMounted, onBeforeUnmount } from 'vue'
import { applyChineseLanguage } from './zhTranslations.js'
import { initLoadingProgress, disposeLoadingProgress } from './useLoadingProgress.js'
import { modelViewer } from '@/viewer/modelController'

// 加载 O3DV 自带的示例模型（复制自 3dviewer.net 首页的示例列表）
export function loadSiteAssets() {
  return new Promise((resolve) => {
    if (!document.querySelector('link[href="/o3dv-site/o3dv.website.prefixed.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/o3dv-site/o3dv.website.prefixed.css'
      document.head.appendChild(link)
    }
    // Pickr 颜色选择器弹窗挂载在 body 下（不在 .o3dv-root 内），
    // prefixed CSS 的 .o3dv-root .pcr-app 规则匹配不到，导致弹窗无样式。
    // 额外加载 pickr 的 monolith 主题原版 CSS（含 .pcr-app 全局规则）。
    if (!document.querySelector('link[href="/o3dv-site/pickr-monolith.min.css"]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = '/o3dv-site/pickr-monolith.min.css'
      document.head.appendChild(link)
    }
    if (window.OV?.StartWebsite && document.querySelector('script[src="/o3dv-site/o3dv.website.min.js"]')) {
      resolve(window.OV)
      return
    }
    // 重新加载（组件卸载时移除了脚本）
    window.OV = null
    const s = document.createElement('script')
    s.src = '/o3dv-site/o3dv.website.min.js'
    s.onload = () => resolve(window.OV || null)
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
  })
}

// 加载 O3DV 自带的示例模型（复制自 3dviewer.net 首页的示例列表）
export function loadExampleModel(fileName, auxFiles = []) {
  const ws = window.o3dvWebsite
  if (!ws || !window.OV) return
  const ImportSettingsCls = window.OV.ImportSettings || window.OV.Engine.ImportSettings
  const settings = new ImportSettingsCls()
  const urls = ['/o3dv-site/assets/models/' + fileName]
  for (const aux of auxFiles) {
    urls.push('/o3dv-site/assets/models/' + aux)
  }
  ws.LoadModelFromUrlList(urls, settings)
}

// 卡片背景跟随 O3DV 主题（--ov_background_color 定义在 .o3dv-root 子元素上，
// CSS 无法向上继承，需要 JS 同步到卡片）
// 注意：O3DV 的 theme_changed 事件在 CSS 变量应用前触发，直接按 label 设置
export function syncCardTheme(label) {
  const card = document.querySelector('.model-card')
  if (!card) return
  if (label === 'dark') {
    card.style.backgroundColor = '#2a2b2e'
  } else {
    card.style.backgroundColor = '#ffffff'
  }
  // 同步对话框色变量到 body：O3DV 的 tooltip/弹窗挂载在 body 下，
  // 而 CSS 变量定义在 .o3dv-root 上，body 元素继承不到，导致暗色下
  // tooltip/弹窗仍是亮色。这里把对话框相关变量复制到 body。
  // 注意：theme_changed 事件在变量应用前触发，延迟一帧再读取。
  setTimeout(() => {
    const root = document.querySelector('.o3dv-root')
    if (!root) return
    const rootCS = getComputedStyle(root)
    const vars = [
      '--ov_dialog_foreground_color',
      '--ov_dialog_background_color',
      '--ov_dialog_control_border_color',
      '--ov_border_color',
      '--ov_button_color',
      '--ov_button_hover_color',
      '--ov_button_text_color',
      '--ov_outline_button_color',
      '--ov_outline_button_hover_color',
      '--ov_outline_button_text_color',
      '--ov_shadow'
    ]
    for (const v of vars) {
      const val = rootCS.getPropertyValue(v).trim()
      if (val) document.body.style.setProperty(v, val)
    }
  }, 0)
}

// 跟随系统主题：RuoYi 的系统亮/暗模式由 html.dark 类控制（useDark 随系统偏好切换），
// 这里监听 html.dark 类变化，同步切换 O3DV 的主题（工具栏暗/亮按钮已禁用）。
// 注意（本项目已不使用）：本项目主题类写在 body（light/dark-theme/tech-theme），
// html 上永远没有 dark → 这个同步会在深色主题下把 O3DV 强切回亮色，
// 与 ModelViewer.vue 的主题联动互相打架。保留仅供原实现参考，不要在页面里调用。
export function useSystemThemeSync(hideTooltip) {
  let themeObserver = null

  function init() {
    const applyFromSystem = () => {
      const ws = window.o3dvWebsite
      if (!ws) return
      const isDark = document.documentElement.classList.contains('dark')
      const Theme = { Light: 1, Dark: 2 }
      const target = isDark ? Theme.Dark : Theme.Light
      if (ws.settings.themeId !== target) {
        // 切换 O3DV 主题并重置默认颜色（与工具栏按钮行为一致）
        ws.SwitchTheme(target, true)
        // 同步卡片背景与 body 对话框色变量
        syncCardTheme(isDark ? 'dark' : 'light')
      }
    }
    // 初始应用一次
    applyFromSystem()
    // 监听 html.dark 类变化（RuoYi 的系统主题切换）
    if (!themeObserver) {
      themeObserver = new MutationObserver(() => {
        applyFromSystem()
        // 主题变化后清除可能残留的禁用提示
        if (typeof hideTooltip === 'function') hideTooltip()
      })
      themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    }
  }

  function dispose() {
    if (themeObserver) {
      themeObserver.disconnect()
      themeObserver = null
    }
    if (typeof hideTooltip === 'function') hideTooltip()
  }

  return { init, dispose }
}

// 初始化并启动 O3DV 查看器
// handlers: { onModelLoaded(), onThemeChanged(label), onToolbarReady() } —— O3DV 事件回调
// 内部自动注册 onMounted / onBeforeUnmount 生命周期
export function useO3dvViewer(handlers = {}) {
  let timers = []
  let started = false

  function setTimeoutSafe(fn, ms) {
    const t = setTimeout(fn, ms)
    timers.push(t)
    return t
  }

  async function mount() {
    if (started) return
    started = true
    // 监听 O3DV 加载进度弹窗（百分比 + 快速加载补足展示）
    initLoadingProgress()
    const OV = await loadSiteAssets()
    if (!OV || !OV.StartWebsite) return
    // 中文化：注入中文翻译表并设置语言码。必须在 StartWebsite 构建界面之前完成
    // （这样 Loc() 查表直接返回中文）；引擎若尚未就绪则轮询等待，最多 5 秒。
    let langAttempts = 0
    const tryApplyLanguage = () => {
      if (applyChineseLanguage()) return
      if (++langAttempts >= 50) return
      const t = setTimeout(tryApplyLanguage, 100)
      timers.push(t)
    }
    tryApplyLanguage()
    // 监听 O3DV 事件（模型加载完成 / 主题切换）
    if (typeof OV.SetWebsiteEventHandler === 'function') {
      OV.SetWebsiteEventHandler((eventName, eventLabel) => {
        // 模型加载完成后回调（边线、视角、乱码修复、计算面板等）
        if (eventName === 'model_loaded' && handlers.onModelLoaded) {
          handlers.onModelLoaded()
        }
        // 主题切换后同步卡片背景（事件在变量应用前触发，直接按 label 处理）
        if ((eventName === 'theme_changed' || eventName === 'theme_on_load') && handlers.onThemeChanged) {
          handlers.onThemeChanged(eventLabel)
        }
      })
    }
    // 启动 3dviewer.net 界面（页面内直接运行，非 iframe）
    OV.StartWebsite()
    // 立即隐藏 intro（避免进入页面时闪现 3dviewer 大 logo；
    // 点小房子回首页时 O3DV 的 SetUIState(Intro) 会重新显示它）
    const introEl = document.getElementById('intro')
    if (introEl) introEl.style.display = 'none'
    // 工具栏就绪后立即定制（不等模型加载，防止提前悬停/点击）
    setTimeoutSafe(() => {
      const waitAndCustomize = () => {
        const toolbar = document.getElementById('toolbar')
        if (toolbar && toolbar.querySelectorAll('.ov_toolbar_button').length > 0) {
          if (handlers.onToolbarReady) handlers.onToolbarReady()
        } else {
          setTimeoutSafe(waitAndCustomize, 200)
        }
      }
      waitAndCustomize()
    }, 100)
    // 等待 O3DV 初始化完成后，直接调用 API 加载默认模型
    setTimeoutSafe(() => {
      const waitAndLoad = () => {
        if (window.o3dvWebsite && typeof window.o3dvWebsite.LoadModelFromUrlList === 'function') {
          // 用户已经自己加载过模型（点了示例 / 打开文件 / 重置）→ 不要再用默认模型覆盖他的选择
          // （否则快速点示例时会被随后自动加载的默认模型顶掉，表现为"点了没反应"）
          if (modelViewer.hasManualLoad()) return
          // 必须传 ImportSettings（内部 getDefaultMaterialColor 会读 settings.defaultColor，
          // 不传会导致 TypeError: Cannot read properties of undefined (reading 'defaultLineColor')）
          const ImportSettingsCls = OV.ImportSettings || OV.Engine.ImportSettings
          const settings = new ImportSettingsCls()
          window.o3dvWebsite.LoadModelFromUrlList(['/初始模型.STEP'], settings)
        } else {
          setTimeoutSafe(waitAndLoad, 200)
        }
      }
      waitAndLoad()
    }, 300)
  }

  function unmount() {
    // 停止加载进度观察（百分比/假进度弹窗）
    disposeLoadingProgress()
    // 清理定时器
    timers.forEach(t => clearTimeout(t))
    timers = []
    // 清理 O3DV 残留的 body 弹层
    document.querySelectorAll('body > div.pcr-app').forEach(el => el.remove())
    document.querySelectorAll('body > div.ov_tooltip').forEach(el => el.remove())
    document.querySelectorAll('body > div.ov_measure_panel').forEach(el => el.remove())
    document.querySelectorAll('body > div.ov_modal, body > div.ov_dialog, body > div.ov_popup, body > div.ov_progress').forEach(el => el.remove())
    // 恢复 O3DV 覆盖的全局 onhashchange（避免干扰路由）
    window.onhashchange = null
    // 移除 O3DV 全局实例，下次进入重新初始化
    window.o3dvWebsite = null
    // 移除动态加载的 O3DV 资源（下次进入重新加载）
    const o3dvScript = document.querySelector('script[src="/o3dv-site/o3dv.website.min.js"]')
    if (o3dvScript) o3dvScript.remove()
    const o3dvCss = document.querySelector('link[href="/o3dv-site/o3dv.website.prefixed.css"]')
    if (o3dvCss) o3dvCss.remove()
    const pickrCss = document.querySelector('link[href="/o3dv-site/pickr-monolith.min.css"]')
    if (pickrCss) pickrCss.remove()
    started = false
  }

  onMounted(() => {
    mount()
  })

  onBeforeUnmount(() => {
    try {
      unmount()
    } catch (e) {
      console.warn('[ModelViewer] cleanup error:', e)
    }
  })

  return { mount, unmount }
}
