/**
 * O3DV（3dviewer.net / Online3DViewer 开源引擎）资源加载器
 *
 * 资源放在 public 下，运行时按需注入，避免打进 bundle：
 *   /o3dv/          引擎 + OCCT 导入器（STEP / IGES / BREP）
 *   /o3dv-site/     3dviewer.net 网站包（画布、导入流程、材质与环境贴图）
 *
 * 只想换版本时，替换 public 下这两个目录即可，代码无需改动。
 */

export const O3DV_PATHS = {
  siteCss: '/o3dv-site/o3dv.website.prefixed.css',
  siteJs: '/o3dv-site/o3dv.website.min.js',
  pickrCss: '/o3dv-site/pickr-monolith.min.css',
  modelsBase: '/o3dv-site/assets/models/'
}

/** 动态加载样式表（幂等） */
function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  document.head.appendChild(link)
}

/** 动态加载脚本（幂等） */
function loadScript(src) {
  return new Promise((resolve) => {
    const exist = document.querySelector(`script[src="${src}"]`)
    if (exist && window.OV) {
      resolve(window.OV)
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve(window.OV || null)
    script.onerror = () => resolve(null)
    document.head.appendChild(script)
  })
}

let loading = null

/**
 * 确保 O3DV 资源就绪
 * @returns {Promise<Object|null>} window.OV 命名空间
 */
export function ensureO3dvAssets() {
  if (window.OV?.StartWebsite) return Promise.resolve(window.OV)
  if (loading) return loading
  loading = (async () => {
    loadCss(O3DV_PATHS.siteCss)
    // Pickr 颜色选择器弹窗挂在 body 下，需要原版主题样式
    loadCss(O3DV_PATHS.pickrCss)
    const OV = await loadScript(O3DV_PATHS.siteJs)
    loading = null
    return OV
  })()
  return loading
}

/** 卸载（离开模型查看时清理，下次进入重新加载） */
export function releaseO3dvAssets() {
  const js = document.querySelector(`script[src="${O3DV_PATHS.siteJs}"]`)
  if (js) js.remove()
  const css = document.querySelector(`link[href="${O3DV_PATHS.siteCss}"]`)
  if (css) css.remove()
  const pickr = document.querySelector(`link[href="${O3DV_PATHS.pickrCss}"]`)
  if (pickr) pickr.remove()
  window.o3dvWebsite = null
}

/** 示例模型列表（来自 3dviewer.net 首页示例） */
export const EXAMPLE_MODELS = [
  { label: 'step 引擎件', file: 'as1_pe_203.stp' },
  { label: 'iges 引擎件', file: 'as1_pe_203.igs' },
  { label: 'brep 曲面', file: 'as1_pe_203.brep' },
  { label: 'gltf 头盔', file: 'DamagedHelmet.glb' },
  { label: 'obj 组合体', file: 'solids.obj', aux: ['solids.mtl'] },
  { label: 'stl 茶壶', file: 'utah_teapot.stl' },
  { label: 'ply 奶牛', file: 'cow.ply' },
  { label: '3ds 方块', file: 'cubes.3ds', aux: ['texture.png'] },
  { label: 'ifc 建筑', file: 'haus.ifc' },
  { label: 'fcstd 模型', file: 'ArchDetail.FCStd' }
]
