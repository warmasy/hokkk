<template>
  <!-- 模型查看：模型卡片 = 页面内完全模仿 3dviewer.net（Online3DViewer 开源项目）的完整界面 -->
  <div class="app-container model-card-page">
    <div class="model-card">
      <!-- O3DV 根容器（prefixed CSS 作用域） -->
      <div class="o3dv-root">
        <!-- 文件选择（隐藏） -->
        <input type="file" id="open_file" style="display:none;" multiple />

        <!-- 顶部：工具栏（title 行会在启动后被移除；logo 已删除，
             避免 Vite 把 <use href="xxx.svg#logo"> 静态路径内联成 data URI 导致跨源错误） -->
        <div class="header" id="header">
          <div class="title">
            <div class="title_right" id="header_buttons"></div>
            <div class="main_file_name only_full_width" id="main_file_name"></div>
          </div>
          <div class="toolbar" id="toolbar"></div>
        </div>

        <!-- 主体：左侧导航器 + 中间查看器 + 右侧设置栏 -->
        <div class="main" id="main">
          <div class="main_left_container only_full_width" id="main_left_container">
            <div class="main_navigator ov_panel_set_container" id="main_navigator"></div>
            <div class="main_splitter" id="main_navigator_splitter"></div>
          </div>
          <div class="main_viewer" id="main_viewer"></div>
          <div class="main_right_container only_full_width" id="main_right_container">
            <div class="main_splitter" id="main_sidebar_splitter"></div>
            <div class="main_sidebar ov_panel_set_right_container" id="main_sidebar"></div>
          </div>
        </div>

        <!-- 初始页（拖放导入 + 示例模型）：初始隐藏，避免 O3DV 加载期间闪现大 logo；
             点小房子回首页时由 restartWithIntro 重新显示 -->
        <div class="intro ov_thin_scrollbar" id="intro" style="display:none;">
          <div class="intro_content" id="intro_content">
            <div class="intro_logo">
              <!-- 3dviewer.net 文字 logo（内联 SVG：不用 <use> 引用外部文件，
                   避免 Vite 把静态 href 内联成 data URI 触发跨源错误；
                   文字/边框颜色用 --ov_logo_* 变量跟随主题） -->
              <svg class="intro_logo" version="1.1" viewBox="0 0 286 60" xml:space="preserve" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><path id="lg-a" d="M-5-1h62v62H-5z"/><clipPath id="lg-d-5"><use width="100%" height="100%" overflow="visible" xlink:href="#lg-c"/></clipPath><path id="lg-a-85" d="m-5-1h62v62h-62z"/><path id="lg-c" d="m-5-1h62v62h-62z"/></defs><clipPath id="lg-b"><use width="100%" height="100%" overflow="visible" xlink:href="#lg-a"/></clipPath><g transform="translate(.10025)" fill="#15334a"><path style="fill:var(--ov_logo_text_color);" transform="matrix(.78095 0 0 .78095 14.238 8.152)" d="m75.237 18.5c-6.008 0-10.237 4.52-10.237 10.528 0 5.98 4.229 10.47 10.237 10.47 5.979 0 10.207-4.49 10.207-10.47 0-6.007-4.228-10.528-10.207-10.528zm6.97 10.528c0 4.375-2.741 7.612-6.97 7.612-4.23 0-7-3.237-7-7.612 0-4.403 2.77-7.699 7-7.699 4.229 0 6.97 3.296 6.97 7.7zm21.839-10.236v16.332l-10.906-16.332h-3.88v20.415h3.091v-16.39l10.879 16.39h3.908v-20.415zm10.978 17.615v-17.615h-3.15v20.415h13.649v-2.8zm14.597-17.615v20.415h3.15v-20.415zm22.843 0v16.332l-10.907-16.332h-3.88v20.415h3.092v-16.39l10.879 16.39h3.908v-20.415zm22.031 2.741v-2.741h-14.203v20.415h14.203v-2.742h-11.112v-6.59h10.733v-2.655h-10.733v-5.687zm18.205 6.067 5.599-8.663v-0.145h-13.24v2.712h8.486l-5.425 8.195v0.146h2.625c2.77 0 4.696 1.458 4.696 3.47 0 1.984-1.663 3.442-4.083 3.442-1.692 0-3.908-0.67-6.33-2.07v3.382c2.334 1.05 4.434 1.459 6.242 1.43 4.258-0.03 7.291-2.538 7.291-6.154 0-3.092-2.537-5.25-5.862-5.746zm17.266-8.808h-7.408v20.415h7.408c6.183 0 10.849-4.2 10.849-10.208 0-5.92-4.666-10.207-10.85-10.207zm0.029 17.586h-4.287v-14.758h4.287c4.345 0 7.583 3.062 7.583 7.378 0 4.346-3.15 7.379-7.583 7.379zm34.925-17.586-5.833 17.47-5.862-17.47h-3.587l7.262 20.415h4.316l7.291-20.415zm7.056 0v20.415h3.15v-20.415zm22.26 2.741v-2.741h-14.203v20.415h14.203v-2.742h-11.112v-6.59h10.733v-2.655h-10.733v-5.687zm29.18-2.741-3.996 17.09-5.308-17.09h-3.733l-5.045 17.061-4.229-17.061h-3.733l5.687 20.415h4.404l4.754-17.411 5.045 17.41h4.404l5.454-20.414zm21.231 2.741v-2.741h-14.203v20.415h14.203v-2.742h-11.111v-6.59h10.732v-2.655h-10.732v-5.687zm17.253 17.674h4.024l-6.27-8.341c3.353-0.525 5.6-2.946 5.6-6.037 0-3.413-2.888-6.037-7-6.037h-9.012v20.415h3.15v-8.225h3.995zm-9.508-17.703h5.745c2.391 0 4.025 1.458 4.025 3.354 0 1.954-1.634 3.5-4.025 3.5h-5.745z" fill="#15334a" stroke-width="2.2231" aria-label="ONLINE 3D VIEWER"/></g><g transform="translate(-.7 .077394)"><clipPath id="lg-b-3"><use width="100%" height="100%" overflow="visible" xlink:href="#lg-a-85"/></clipPath><g clip-path="url(#lg-b-3)"><clipPath id="lg-d"><use width="100%" height="100%" overflow="visible" xlink:href="#lg-c"/></clipPath><g style="stroke:var(--ov_logo_border_color);" stroke-linecap="round" stroke-linejoin="round" stroke-miterlimit="10"><path transform="translate(.039092 .02257)" d="m38.361 22.877-12.4-7.3 9.2e-5 -14.177 24.8 14.2v28.8l-12.4-7.3226z" clip-path="url(#lg-d)" fill="#4688b4"/><path transform="rotate(120,26,30.082)" d="m38.4 22.923-12.522-7.0887 0.14178-14.4 24.78 14.166v28.8l-12.522-7.0883z" clip-path="url(#lg-d-5)" fill="#64c0ff"/><path d="m26 30v14.4l12.4-7.3v-14.2z" clip-path="url(#lg-d)" fill="#294e67"/><path d="m13.6 37.1v-14.2l12.4-7.3v-14.177l-24.8 14.177v28.8z" clip-path="url(#lg-d)" fill="#294e67"/><path d="m26 15.6-12.4 7.3 12.4 7.1 12.4-7.1z" clip-path="url(#lg-d)" fill="#64c0ff"/><path d="m13.6 22.9 12.4 7.1v14.4l-12.4-7.3z" clip-path="url(#lg-d)" fill="#4688b4"/></g></g></g></svg>
              <div class="intro_dragdrop_text" id="intro_dragdrop_text"></div>
            </div>
            <div class="intro_formats">
              <div class="intro_formats_title" id="intro_formats_title"></div>
              <div class="intro_file_formats" id="intro_file_formats">
                <a href="#" @click.prevent="loadExample('RhinoLogo.3dm')">3dm</a>
                <a href="#" @click.prevent="loadExample('cubes.3ds', ['texture.png'])">3ds</a>
                <a href="#" @click.prevent="loadExample('rhombicuboctahedron.3mf')">3mf</a>
                <a href="#" @click.prevent="loadExample('rook.amf')">amf</a>
                <a href="#" @click.prevent="loadExample('MultipleMeshes.bim')">bim</a>
                <a href="#" @click.prevent="loadExample('as1_pe_203.brep')">brep</a>
                <a href="#" @click.prevent="loadExample('X_Bot.dae')">dae</a>
                <a href="#" @click.prevent="loadExample('Y_Bot.fbx')">fbx</a>
                <a href="#" @click.prevent="loadExample('ArchDetail.FCStd')">fcstd</a>
                <a href="#" @click.prevent="loadExample('DamagedHelmet.glb')">gltf</a>
                <a href="#" @click.prevent="loadExample('haus.ifc')">ifc</a>
                <a href="#" @click.prevent="loadExample('as1_pe_203.igs')">iges</a>
                <a href="#" @click.prevent="loadExample('as1_pe_203.stp')">step</a>
                <a href="#" @click.prevent="loadExample('utah_teapot.stl')">stl</a>
                <a href="#" @click.prevent="loadExample('solids.obj', ['solids.mtl'])">obj</a>
                <a href="#" @click.prevent="loadExample('cube.off')">off</a>
                <a href="#" @click.prevent="loadExample('cow.ply')">ply</a>
                <a href="#" @click.prevent="loadExample('extrusion3.wrl')">wrl</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup name="ModelViewerPage">
import { onBeforeUnmount } from 'vue'

import './styles/o3dv-fixes.css'
import { useO3dvViewer, syncCardTheme, loadExampleModel } from './composables/useO3dvViewer.js'
import { applyClearEdges, fixGarbledModelNames, restartWithIntro, setSolidWorksDefaultView, setDefaultOrthographic, setDefaultFreeOrbit, customizeUpAxisButtons, hasValidBoundingSphere } from './composables/useModelDisplay.js'
import { initAxisIndicator, updateAxisIndicatorTheme, disposeAxisIndicator } from './composables/useAxisIndicator.js'
import { initMeshColor, disposeMeshColor, recordInitialColors, restoreMeshColors } from './composables/useMeshColor.js'

// 加载示例模型（模板 intro 链接直接调用）
const loadExample = loadExampleModel

// 主题联动统一由外层 ModelViewer.vue 负责（跟随本项目的 白 / 黑 / 科技蓝）。
// 原实现另有一个监听 html.dark 的“系统主题同步”，但本项目主题类写在 body 上、
// html 上永远没有 dark → 它会在黑/科技蓝主题下把 O3DV 强切回亮色（两边打架、
// 每次 SwitchTheme 都会重刷 O3DV 界面），因此已删除。

// 初始背景色/环境贴图快照（"Reset to Default" 恢复用）。
// 只在首次模型加载时记录：换模型后不再覆盖，保证 Reset 始终恢复到页面初始的项目默认，
// 而不是"换模型那一刻已被修改过的颜色"（否则会出现点了 Reset 却"重置不了"的现象）。
let initialBgColor = null
let initialEnvMap = null
let bgSnapshotTaken = false

// 触发 O3DV 重新布局：工具栏换行/卡片高度变化后，O3DV 内部元素
// （main_viewer/侧边栏）高度需按最新 main 高度重算，否则底部溢出被裁剪
function triggerO3dvResize(delay = 120) {
  setTimeout(() => {
    const ws = window.o3dvWebsite
    if (ws && ws.layouter && typeof ws.layouter.Resize === 'function') {
      try { ws.layouter.Resize() } catch (e) { /* ignore */ }
    }
  }, delay)
}

// 画布位图尺寸就绪后再定位相机。
// 原因：O3DV 在加载/可视化阶段会把 viewer 画布的位图尺寸重置为 0，下一帧才恢复。
// 如果这一刻去算"包围球适配距离"，宽高比会算出 0 → sin(0)=0 → 距离 = 半径/0 = Infinity，
// 相机被甩到无穷远，模型就"闪一下就没了、有时又不显示"。
function whenCanvasReady(callback, tries = 40) {
  const canvas = document.querySelector('.main_viewer canvas') || document.getElementById('viewer')
  if ((canvas && canvas.width > 0 && canvas.height > 0) || tries <= 0) {
    callback()
    return
  }
  setTimeout(() => whenCanvasReady(callback, tries - 1), 50)
}

/**
 * 加载模型后摆默认视角（等轴测）。
 *
 * 必须"重试 + 复核"，否则会出现"有时很大、有时很小、有时没反应"：
 *  - O3DV 的 model_loaded 事件发出时，网格实例可能还没进场景 → GetBoundingSphere()
 *    拿到的是上一个模型的包围球（或半径 0），照它适配就会把新模型摆成过大/过小/看不见；
 *  - 画布位图尺寸也可能还是 0（引擎加载阶段会清零）。
 * 所以：画布就绪 + 包围球有效才适配；适配成功后再复核对不对（场景随后才更新的话再补一次）。
 */
let fitToken = 0
function applyDefaultViewWhenReady() {
  const token = ++fitToken
  let tries = 0
  let fittedRadius = 0
  const attempt = () => {
    if (token !== fitToken) return // 又加载了新模型，这次作废
    const ws = window.o3dvWebsite
    const viewer = ws && ws.viewer
    if (!viewer) return
    const canvas = document.querySelector('.main_viewer canvas') || document.getElementById('viewer')
    const canvasReady = !!canvas && canvas.width > 0 && canvas.height > 0
    let radius = 0
    if (hasValidBoundingSphere(viewer)) {
      try {
        radius = viewer.GetBoundingSphere(() => true).radius
      } catch (e) {
        radius = 0
      }
    }
    if (canvasReady && radius > 0) {
      const ok = setSolidWorksDefaultView(false) // 初始加载直接到位，不播放过渡动画
      if (ok) {
        fittedRadius = radius
        // 场景可能在我们适配之后才真正更新（半径变化）→ 复核一次并补做
        setTimeout(() => {
          if (token !== fitToken) return
          if (!hasValidBoundingSphere(viewer)) return
          try {
            const now = viewer.GetBoundingSphere(() => true).radius
            if (Math.abs(now - fittedRadius) / Math.max(now, 1e-6) > 0.02) {
              setSolidWorksDefaultView(false)
            }
          } catch (e) { /* ignore */ }
        }, 300)
        return
      }
    }
    if (++tries > 25) return // 最多等 2.5s
    setTimeout(attempt, 100)
  }
  attempt()
}

// 模型加载完成后的统一处理（仅处理模型数据相关；界面定制在工具栏就绪时完成）
function handleModelLoaded() {
  applyClearEdges()
  setDefaultOrthographic()
  setDefaultFreeOrbit() // 默认自动选中自由旋转
  triggerO3dvResize()
  applyDefaultViewWhenReady()
  fixGarbledModelNames()

  // 记录初始背景色/环境贴图（Reset to Default 恢复用；仅首次模型加载时记录）
  const ws0 = window.o3dvWebsite
  if (ws0 && ws0.settings && !bgSnapshotTaken) {
    const bg = ws0.settings.backgroundColor
    initialBgColor = bg ? { r: bg.r, g: bg.g, b: bg.b, a: bg.a } : null
    initialEnvMap = ws0.settings.environmentMapName || null
    bgSnapshotTaken = true
  }
  recordInitialColors() // 记录初始实体颜色快照（Reset 恢复用）
  triggerO3dvResize()
  setTimeout(() => {
    initAxisIndicator() // 左下角 XYZ 坐标轴指示器（延迟一帧等模型就绪）
  }, 50)
}

// 恢复模型和坐标系的默认显示样式（正交投影 + SolidWorks 初始等轴测视角）
function restoreDefaultView() {
  setDefaultOrthographic()
  setSolidWorksDefaultView()
}

// 侧边栏 "Reset to default" 点击后：恢复本项目的默认设置
// （清晰边线、正交投影、默认视角、背景色/环境贴图）；未修改时点击无变化
function restorePanelDefaults() {
  applyClearEdges()
  setDefaultOrthographic()
  setSolidWorksDefaultView()
  const ws = window.o3dvWebsite
  if (!ws || !ws.settings) return
  try {
    const Engine = window.OV.Engine || window.OV
    // 恢复背景色
    if (initialBgColor && Engine && typeof Engine.RGBAColor === 'function') {
      ws.settings.backgroundColor = new Engine.RGBAColor(initialBgColor.r, initialBgColor.g, initialBgColor.b, initialBgColor.a)
      if (ws.viewer && typeof ws.viewer.SetBackgroundColor === 'function') {
        ws.viewer.SetBackgroundColor(ws.settings.backgroundColor)
      }
    }
    // 恢复环境贴图
    if (initialEnvMap) {
      ws.settings.environmentMapName = initialEnvMap
    }
    restoreMeshColors() // 恢复实体颜色到初始状态
    if (typeof ws.settings.SaveToCookies === 'function') ws.settings.SaveToCookies()
    if (ws.sidebar && typeof ws.sidebar.UpdateControlsStatus === 'function') {
      ws.sidebar.UpdateControlsStatus()
    }
  } catch (e) { /* ignore */ }
}

// 工具栏就绪后的统一处理（界面定制只做一次）
function handleToolbarReady() {

  customizeUpAxisButtons() // "设置 Y/Z 轴为向上向量"：方向+包围球适配距离
  initMeshColor() // 实体颜色修改（点击实体后显示颜色选项）
  triggerO3dvResize()
}

// 主题切换：同步卡片背景 + 坐标轴文字颜色
function handleThemeChanged(label) {
  syncCardTheme(label)
  updateAxisIndicatorTheme()
}

// O3DV 查看器（事件回调 + 生命周期，内部自动注册 onMounted/onBeforeUnmount）
useO3dvViewer({
  onModelLoaded: handleModelLoaded,
  onThemeChanged: handleThemeChanged,
  onToolbarReady: handleToolbarReady
})

onBeforeUnmount(() => {
  disposeAxisIndicator()
  disposeMeshColor()
})
</script>

<style scoped>
.model-card-page {
  width: 100%;
  /* 页面容器填满内容区；背景跟随 O3DV 主题 */
  height: 100%;
  padding: 8px !important;
  overflow: hidden;
  position: relative;
  box-sizing: border-box;
  background: var(--ov_background_color, #fff);
}
html.dark .model-card-page {
  background: #2a2b2e;
}
/* 模型卡片：小圆角边框容器，内部承载完整 3dviewer.net 界面（与其他页面卡片一致的圆角与黑边框） */
.model-card {
  width: 100%;
  height: 100%;
  border: 1px solid #000;
  border-radius: 4px;
  overflow: hidden;
  /* 跟随 O3DV 主题（--ov_background_color 由 O3DV 主题切换写入 .o3dv-root） */
  background: var(--ov_background_color, #fff);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  position: relative;
}

/* 暗色主题下卡片背景跟随 */
html.dark .model-card {
  background: #2a2b2e;
  border-color: #4a4a4f;
}

/* O3DV 界面需要占满卡片 */
.model-card :deep(.o3dv-root) {
  width: 100%;
  height: 100%;
}
</style>
