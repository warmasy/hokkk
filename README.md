# 清玄侍（干净版）

一个 **开箱即用** 的桌面式工作台：顶部菜单 + 功能区（Ribbon）+ 左中右三栏 + 状态栏，
布局与配色按设计稿还原，支持 4 套主题切换、本地公式求解、关系曲线绘制与 AI 助手（离线解析）。

- **无登录 / 无权限 / 无动态菜单**：纯桌面工具，打开即用
- **不依赖 Element Plus**：组件为原生 DOM + CSS 变量实现（`src/plugins/modal.js`）
- 技术栈：Vue 3.5 + Vite 7 + Pinia 3 + Vue Router 4 + Chart.js 4 + axios

---

## 一、快速开始

```bash
npm install
npm run dev      # 开发：http://localhost:81
npm run build    # 构建：dist/
npm run preview  # 预览构建产物
```

> 端口固定 **81**，避免与旧项目（80）冲突，见 `vite.config.js`。

---

## 二、目录结构

```
mmc-clean
├─ index.html                 入口 HTML
├─ vite.config.js             别名 @ -> src、端口、接口代理
├─ .env.development           开发环境变量（接口前缀 / 代理目标 / AI 开关）
├─ .env.production            生产环境变量
├─ public/favicon.svg
└─ src
   ├─ main.js                 应用入口（注册 pinia/router、引入全局样式）
   ├─ App.vue                 根组件（仅路由出口）
   ├─ api/                    接口层（所有 HTTP 请求都放这里）
   │  ├─ index.js             统一出口：import { executeCalc } from '@/api'
   │  ├─ calc.js              计算执行 executeCalc + 方案增删改查 / 导出
   │  └─ ai.js                AI 对话接口（未配置时自动走本地解析）
   ├─ calc/                   ★ 计算内核（纯 JS，与界面、请求完全解耦）
   │  ├─ index.js             注册表：本地公式 / 数学函数的统一入口
   │  ├─ plot.js              采样与曲线数据：buildSeries / buildFunctionPoints / functionStats
   │  ├─ inertia.js           惯量公式（直杆、圆弧、矩形、椭圆、圆环、复合）
   │  ├─ mechanics.js         力学公式（牛顿第二定律、动量、碰撞、摩擦、功）
   │  ├─ kinematics.js        运动学公式（匀速、匀加速、圆周、变加速、求解）
   │  └─ math.js              数学函数本体（sin/cos/…/高斯，供绘图用）
   ├─ assets/styles/
   │  ├─ theme.css            3 套主题 CSS 变量（白 / 黑 / 科技蓝）
   │  ├─ base.css             重置 + 滚动条 + 工具类
   │  ├─ layout.css           顶栏 / Ribbon / 三栏 / 状态栏 / 计算框布局
   │  └─ ui.css               消息提示、弹窗、加载遮罩、表单与结果样式
   ├─ components/             布局组件（一个区域一个组件）
   │  ├─ AppHeader.vue        顶栏：logo、一级菜单、文档、主题切换
   │  ├─ RibbonToolbar.vue    功能区：分组按钮，超出 3 行×4 列自动收进「更多」；按钮可拖动
   │  ├─ LeftPanel.vue        左栏：浏览树（拖放容器、右键菜单、双击改名）+ 空属性面板
   │  ├─ CalcWindow.vue       ★ 中间的计算框：可拖动、可缩放、最小化/最大化、内含参数与曲线
   │  ├─ CenterCanvas.vue     中栏：计算框容器
   │  ├─ RightPanel.vue       右栏：AI 计算助手（对话 + 自动开框回填）
   │  └─ StatusBar.vue        状态栏
   ├─ config/                 仅描述“界面上有什么”（不含计算逻辑）
   │  ├─ ribbon/
   │  │  ├─ index.js          ★ 菜单 -> 功能区映射、findItem、按 key 查找
   │  │  ├─ unitConvert.js    单位换算按钮（mode: builtin）
   │  │  ├─ inertia.js        惯量按钮（mode: local -> calc/inertia.js）
   │  │  ├─ mechanics.js      力学按钮（mode: local，可改 api）
   │  │  ├─ kinematics.js     运动学按钮（mode: local，可改 api）
   │  │  ├─ math.js           数学函数按钮（mode: local -> calc/math.js）
   │  │  └─ other.js          动作类按钮（AI 助手）
   │  └─ tree.js              左侧浏览树的文件夹与初始示例节点
   ├─ plugins/
   │  ├─ modal.js             轻量消息提示 / 确认框 / 加载遮罩
   │  └─ cache.js             localStorage / sessionStorage 封装
   ├─ router/index.js         路由表
   ├─ store/
   │  ├─ index.js             pinia 实例
   │  └─ modules/
   │     ├─ theme.js          主题状态与切换
   │     └─ workbench.js      工作台状态：计算框、参数、结果、树、持久化
   ├─ utils/
   │  ├─ request.js           ★ axios 封装（token / 防重复提交 / 统一报错 / 下载）
   │  ├─ auth.js              token 读写（js-cookie）
   │  ├─ errorCode.js         错误码文案
   │  ├─ ruoyi.js             tansParams、handleTree、blobValidate 等通用函数
   │  ├─ units.js             单位换算表 + 数值格式化
   │  ├─ windowRegistry.js    计算框与其曲线的操作注册表（供画布工具条调用）
   │  └─ assistant.js         离线 AI 解析（自然语言 -> 参数）
   └─ views/workspace/index.vue   工作台页面（组装以上组件）
```

---

## 三、交互方式

| 操作 | 效果 |
| --- | --- |
| 点击功能区任意功能 | **自动把该功能加入「浏览」树的当前文件夹**（生成一个方案节点），同时在中间弹出它的计算框 |
| 重复点击同一功能 | 树上再加一个节点（同名自动编号 2、3…），中间**再开一个新框**，各框参数完全独立 |
| 公式计算框 | 左栏「参数输入 + 计算结果」，右栏「关系曲线」；打开时按内容自动适配尺寸 |
| 单位换算框 | 设置区压成**一行**（数值 + 源单位 + 交换按钮 + 目标单位，两侧留白对称、文字真正居中），下面一条 28px 高的主结果行，再下面是**单列换算表**——**第一行固定是原单位、第二行固定是目标单位**（这两行用蓝色高亮底色标出），其余按单位表顺序；单位只显示**英文简写**（N、kN·m、kgf/cm²…），鼠标悬停会显示中文全称 |
| 函数绘图框 | 左栏「函数表达式 / 参数 / 横轴范围 / 函数特性」，右栏「函数图像」；改任一参数或横轴范围，图像**实时重绘** |
| 画布工具条 | 仅在**当前激活的计算框带关系曲线**时出现 |
| 中栏空状态 | 没有任何计算框时，中栏**靠上居中**显示：工程图纸网格底纹（20px 副格 + 100px 主格，颜色随主题）
  + 「常用计算」8 张卡片（牛顿第二定律 / 滑动摩擦 / 匀加速 / 圆周运动 / 直杆惯量 / 圆环惯量 / 力换算 / sin）
  + 下面「计算记录（最近三次）」，点记录卡片即可调出当时的标签与参数 |
| 计算框打开 | **按所在文件夹决定默认尺寸**：`计算浏览`（做复杂计算）打开即**最大化**铺满中栏；
  `计算稿`（做辅助/实时计算）打开是**内容自适应的小窗口**。两种情况都从被点击的功能区按钮 /
  引导卡片 / 树节点位置放大出现（190ms）；手动改过尺寸后按你的设置记着（下次打开沿用） |
| 固定在最上层 | 标题栏的**图钉按钮**：固定后这个窗口永远显示在其它计算框之上、可正常拖动/缩放/改参数。
  `计算稿` 里的标签**打开时默认就是固定的**（辅助计算窗一直浮在上面），`计算浏览` 里默认不固定；
  **把标签在文件夹之间拖动时，会按目标文件夹的默认形态自动切换**：
  拖到 **计算浏览** → 取消固定 **并自动最大化**；拖到 **计算稿** → 还原成小窗口 **并自动固定**（状态栏会提示）；
  这些状态也会记进"上次位置"，关掉再打开保持一致；手动点图钉切换过的状态同样会被记住 |
| 控件尺寸 | 全站统一用 `--field-h: 24px` / `--field-radius: 3px` / `--field-font: 12px`，新增控件请沿用这三个变量 |
| 计算框标题栏按钮 | `📌` **固定在最上层**：一直显示、可实时操作（再点取消）；`—` **最小化**：窗口收起，标签保留在浏览树里（点节点可再打开）；`□` **最大化/还原**：铺满中栏并可还原回原位置；`×` **关闭**：窗口与左侧标签一起删除（底部「关闭」按钮同效） |
| 拖动计算框标题栏 | 左/上/右不会拖出中栏，但**往下可以拖出显示区**（只留 40px 标题栏供继续操作）；
  **没有吸附**（不会莫名其妙被边线吸住）；3px 阈值、指针捕获、全程 `cursor:move` 且不选中文字、
  拖动中只更新临时位置松手才提交；**最大化时直接拖标题栏会先还原成小窗口再跟着鼠标走**；
  位置**每帧只落一次**（同一帧内的多个 pointermove 合并） |
| 调整计算框大小 | **四边 + 四角共 8 个把手**（和 Windows 一样随便拉），光标随方向变化（`ns/ew/nwse/nesw-resize`），
  最小 340×220，放大不会越过中栏边界；拖动中尺寸每帧落位一次，图表重绘限制在 ~150ms 一次 |
| 窗口 ↔ 目录树双向高亮 | 点左侧目录树的标签 → 对应窗口前置并**闪一下边框**（标题栏也变成高亮色），方便在多个窗口里一眼找到；
  点/操作某个窗口 → 左侧目录树里对应的标签同步高亮 |
| 拖动计算框右下角 | 调整窗口大小；窗口在**打开时按内容自动定一次尺寸**，之后改参数**不会再变大小** |
| 框内按钮 | 「重新计算」按当前参数重算；「复位」把参数、横轴范围（单位换算还会复位源/目标单位与数值）**恢复成默认值**；「关闭」同标题栏 × |
| 拖动功能区按钮 → 指定的文件夹 | 按住按钮拖出去即可（拖动中出现跟随光标的标签、落点高亮）：放到文件夹=追加，放到节点上/下半区=插入到该位置 |
| 点击可靠性 | 功能区按钮与树节点都**不用 HTML5 draggable**，改用指针事件 + 6px 阈值判定：手抖几个像素不会触发拖拽，**点击永远有效**；只有真正拖出 6px 才进入拖拽 |
| 点击文件夹**图标** | 折叠 / 展开（默认全部展开）；只有点前面的文件夹图标才会切换，点名字/行内空白不会 |
| 点击文件夹**名字** | 把它设为**新功能的默认落点**（名字显示为主题色 + 状态栏提示；鼠标悬停有说明）。
打开某个标签时也会自动把它的文件夹设为默认落点，所以蓝色名字始终跟你当前操作的文件夹一致 |
| 点击树节点 | 打开它对应的计算框；已打开则前置 |
| 拖动树节点 | **按住直接拖**（指针拖动，带插入蓝线提示）：上下拖可调整顺序，拖到别的文件夹可跨文件夹移动 |
| 双击树节点 | **就地改名**（回车确认、Esc 取消），计算框标题同步更新 |
| 右键树节点 | 菜单：**重命名 / 复制节点（独立参数副本）/ 打开计算框 / 删除** |
| 右键文件夹 | 菜单：**折叠·展开 / 关闭所有标签 / 删除所有标签**（删除前有确认框；关闭只收窗口，标签保留。
原「打开所有标签」已按要求删除：窗口现在默认最大化，一次开一堆只会互相叠住，没什么用） |
| 节点右侧 × | 删除节点及其计算框 |
| 标签数量上限 | 每个文件夹（**计算浏览 / 计算稿**）最多 **15 个标签**。要开第 16 个时会弹出
  「标签数量已达上限」对话框：**可多选**要删掉的标签（两列排布，支持全选 / 取消全选），确认后先删除所选
  （连同它们的计算框），再自动继续刚才被拦下的添加 / 复制 / 移动 / 拖入操作；点「取消」则放弃这次添加。
  **弹窗不拦截鼠标**（`pointer-events:none` + `z-index:12000`）：弹窗打开时左侧目录树照样能操作、
  计算框也照常开（只会排在弹窗下面），在树里删掉的标签会**同步从弹窗列表消失**，
  腾出位置后弹窗主按钮会变成「继续添加」，不勾选也能直接继续。
  **勾选某个标签时，它的计算框会自动提到最前**（弹窗始终在最上层，所以窗口就排在弹窗下面；
  该标签还没开窗会先打开它作为预览，高亮边框表示当前项）；接着勾选别的标签，那个标签的窗口继续排上去；
  点「取消」会把"只为预览打开"的窗口全部关掉，恢复原状。
  **弹窗与左侧目录树双向同步**（共用 `tagLimit.selectedNodeIds` 一份数据）：弹窗里勾选的标签，
  目录树里同步高亮 + 打勾（划线显示）；反过来在目录树里点标签也会勾上弹窗对应的复选框，
  再点一次两边一起取消，一一对应 |
| 刷新页面 | **整棵浏览树 + 每个节点的参数 + 所有计算框的位置尺寸自动恢复**（详见第九节） |
| 计算框内的图表工具条 | 放大 / 缩小 / 适应屏幕 / 重置视图 / 截图，放在**曲线区标题行右侧**（不在图内，不遮挡曲线），无曲线时不显示 |
| 鼠标在图上移动 | 轻微**吸附到曲线**（8px 内），画出辅助虚线，交点处打一个**橙色环形标记**（细环 + 中心点，曲线正好从环中心穿过，不会显得偏出去）；移出图外自动消失 |
| 关键点 | 程序会识别**极大值点 / 极小值点 / 与 x 轴交点 / 与 y 轴交点**（极值用三分法精修到 1e-6，所以显示的是 π/2 这类精确值）；**平时不显示标记**，只有鼠标靠近 12px 内才吸附，并在点的正上方弹出居中的说明框（带指引线），例如 `极大值点 (-3π/2, 1.6)` |
| 窗口最大化 / 拉伸 | 画布尺寸变化后会自动重算关键点像素位置，吸附依然有效 |
| 参数异常时 | 图表区**不会消失**：没有可绘制的点（例如高斯 σ=0、横轴起止相同）时图内给出提示；纵轴范围过大（例如衰减系数取负导致指数爆炸）时在上方给出"曲线会被压平"的提醒 |
| 数值显示 | 输入框最多 6 位有效数字（`2π` 显示为 6.28319）；读数与结果把 1e-7 量级的浮点残差显示为 0（例如 `与 x 轴交点 (-π/2, 0)`）；只有真正的极大/极小值才用科学计数法 |
| 坐标读数 | 显示在曲线区标题行（图外，不遮挡图像）；π 轴模式下 x 也用 π 表示 |

> 属性面板按要求保持为空（只保留标题栏），所有输入与结果都在中间的计算框里。

---

## 四、顶部菜单与数学计算

顶栏一级菜单：**数学计算 / 基本计算 / 基本选型 / 模型查看 / 数据中心 / 帮助**。
每个菜单对应功能区的一整套按钮，配置在 `src/config/ribbon.js` 的 `MENU_RIBBON_GROUPS`：

```js
export const MENU_RIBBON_GROUPS = {
  'basic-calc': CALC_GROUPS,   // 单位换算 / 惯量计算 / 力学计算 / 运动学 / 其他
  math: MATH_GROUPS            // 三角函数 / 双曲函数 / 指数与对数 / 工程曲线
}
```

点「数学计算」后功能区会换成数学函数按钮，点任一函数即可弹出**函数图像计算框**：

| 分组 | 函数 |
| --- | --- |
| 三角函数 | sin、cos、tan、asin、acos、atan |
| 双曲函数 | sinh、cosh、tanh |
| 指数与对数 | eˣ、ln x、lg x、xⁿ、√x、\|x\| |
| 工程曲线 | 阻尼振荡、高斯脉冲 |

函数框里的**参数（一般只有系数 A、角频率 ω 等 1~3 个）**和**横轴范围（起始 x、结束 x）**改一下，
右侧图像立刻重绘；坐标区按数学作图习惯绘制：**浅色网格 + 带箭头的 x / y 轴 + 轴上的刻度线与数字 + 原点 O**，
刻度间隔由绘图区尺寸自适应计算（y 轴大约 8 档、x 轴大约 10 档），y 轴围绕 0 对称，
**三角函数 / 阻尼振荡这类周期函数的横轴用 π 表示**（π/2、π、3π/2、2π…，刻度按 π/2 或 π 取整），
"函数特性"只给最关键的值（最大值、最小值，周期函数再加周期 T）。

启动默认进入数学计算菜单，**但不打开任何计算框**（中栏留空）；顶栏菜单与功能区按钮**默认不高亮，仅鼠标悬停时高亮**。

新增数学函数：在 `src/config/math.js` 里加一个 item（写 `expr`、`params`、`domain`、`fn` 即可，
`fn` 返回 `NaN` 表示该点不绘制）。

---

## 五、计算执行方式（本地 JS / 后端接口）

代码分了三层，**界面、计算、请求互不干扰**，所以后期把某个公式改成后端计算只需要改一行配置：

```
config/ribbon/*.js   只描述"界面上有什么按钮、输入项是什么"      （UI 层）
calc/*.js            只描述"怎么算"（纯函数，无请求、无 DOM）     （计算层）
api/*.js             只负责发请求（统一走 utils/request.js）      （请求层）
```

每个按钮用 `mode` 声明算法在哪：

| mode | 含义 | 现有按钮 |
| --- | --- | --- |
| `'local'` | 前端 JS 计算，取 `config` 里绑定的 `calc`，或按 key 到 `calc/index.js` 查 | 数学函数、惯量、力学、运动学 |
| `'builtin'` | 由 store 用单位表处理 | 单位换算 12 个按钮 |
| `'api'` | 请求后端（`api/calc.js` 的 `executeCalc`） | 目前无（示例见下） |
| `'none'` | 动作类按钮 | AI 助手 |

### 把某个公式切到后端（示例）

以「牛顿第二定律」为例，`src/config/ribbon/mechanics.js` 里已经预置了接口信息，只要把 `mode` 换掉：

```js
{
  key: 'mech-newton2',
  label: '牛顿第二定律',
  kind: 'formula',
  mode: 'api',                                              // ← 由 'local' 改成 'api'
  api: { url: '/calc/mechanics/newton2', method: 'post' },  // ← 后端地址
  fields: [ ... ],                                          // 输入项不变
  sweep: { ... }                                            // 关系曲线仍在（用返回值扫参数）
}
```

改完即生效：计算框会自动调 `executeCalc({ itemKey, values })`，期间显示"正在请求后端计算…"，
失败显示红色错误行，并且**带竞态保护**（连续改参数时只采用最后一次请求的结果）。界面代码零改动。

### 后端返回格式

`store` 会自动兼容下面任意一种（见 `workbench.js` 的 `normalizeRows`）：

```json
{ "code": 200, "data": [{ "label": "加速度 a", "value": 10, "unit": "m/s²" }] }
{ "code": 200, "rows": [{ "name": "加速度 a", "value": 10, "unit": "m/s²" }] }
[{ "label": "加速度 a", "value": 10, "unit": "m/s²" }]
```

### 请求示例（api/calc.js）

```js
import request, { download } from '@/utils/request'

/** 通用计算执行：按钮配置 mode: 'api' 时会自动调它 */
export function executeCalc(payload, api = {}) {
  const url = api.url || '/calc/execute'
  const method = (api.method || 'post').toLowerCase()
  return method === 'get'
    ? request({ url, method: 'get', params: payload })
    : request({ url, method: 'post', data: payload })
}

export function listScheme(query) { return request({ url: '/calc/scheme/list', method: 'get', params: query }) }
export function addScheme(data)   { return request({ url: '/calc/scheme', method: 'post', data }) }
export function exportCalc(params){ return download('/calc/export', params, '计算结果.xlsx') }
```

> 接口地址写在按钮配置里（而不是散落在组件中），因此**同一个公式可以按需切本地或切后端**，
> 也可以只把少数复杂工况（例如需要迭代求解的）放到后端，其余仍在前端算。

---

## 六、新增一个计算模块

编辑 `src/config/ribbon/` 下对应的文件，往分组里加一个按钮即可，计算框里的输入项 / 结果 / 曲线会自动生成：

```js
{
  key: 'inertia-rod-center',       // 唯一 key
  label: '直杆1',                  // 按钮文字
  icon: 'fa-solid fa-slash',       // Font Awesome 图标
  kind: 'formula',
  desc: 'J = m·L² / 12',           // 计算框顶部的公式说明
  fields: [                        // 输入项（单位需与 assistant.js 的单位表一致才能被 AI 识别）
    { key: 'm', label: '质量 m', unit: 'kg', def: 10 },
    { key: 'L', label: '杆长 L', unit: 'mm', def: 500 }
  ],
  calc(v) {                        // v 为输入值（已转 Number）
    const L = v.L / 1000
    const J = (v.m * L * L) / 12
    return [{ label: '转动惯量 J', value: J, unit: 'kg·m²' }]
  },
  sweep: { field: 'L', from: 50, to: 1000, label: '杆长 L (mm)', output: 0 } // 曲线：横轴字段 / 范围 / 取第几条结果
}
```

单位换算类按钮更简单（mode 为 builtin）：

```js
{ key: 'unit-force', label: '力', icon: 'fa-solid fa-arrow-down', kind: 'unit', unitType: 'force' }
```

> 单位表在 `src/utils/units.js` 的 `UNIT_TYPES` 中维护。

---

## 七、模型查看（3D）

中栏是内嵌的 **3dviewer.net（Online3DViewer）开源引擎**，界面由本项目的布局承载，功能区按钮驱动。

```
public/o3dv/                   引擎 + OCCT 导入器（STEP / IGES / BREP，wasm）
public/o3dv-site/              O3DV 网站包（画布、导入流程、材质、环境贴图）
public/初始模型.STEP            默认模型（打开即加载）
src/views/model-viewer/        ★ 查看器实现（沿用原项目已验证版本：加载、中文化、边线、
                                导航器、材质配色、坐标轴指示、计算面板）
src/components/ModelViewer.vue 中栏挂载 + 状态同步（零件/统计 -> 左侧树与状态栏）
src/viewer/                    功能区命令层（与查看器实现解耦，新增功能只动这里）
  modelController.js           引擎能力封装：加载 / 相机视角 / 投影 / 背景 / 零件 / 截图
  commands.js                  命令表：功能区按钮 -> 动作
  o3dvControls.js              O3DV 自带控件定位（官方未开放 API 的能力兜底，按中文文案/alt 定位）
  o3dvPanels.js                O3DV 面板的独立浮层（模型详情 / 导入设置 各自一个框，可拖动）
  o3dvDialogs.js               O3DV 弹窗的位置与拖动（默认中栏左上角、夹在中栏内）
src/config/ribbon/modelView.js 功能区按钮（菜单「模型查看」，6 组 33 个按钮）
```

**功能区（模型查看菜单）**：模型（打开模型·导入设置·模型详情 / 示例 STEP·示例 STL·示例 GLTF / 导出模型·重置）、
视角（等轴测·正视·俯视·左视·右视·后视·适应屏幕·自动旋转）、
相机（透视·正交·翻转上下·自由旋转）、
显示（边线·透明背景·测量·显示全部）、环境（浅色/灰色/深色/科技蓝背景·环境贴图）、
输出（创建快照·下载原文件·截图·全屏）。

按钮数组顺序 = **按列优先**（功能区是 `flex-direction: column` + wrap，每列 3 个）：
数组前 3 个是第 1 列，接着 3 个是第 2 列，依此类推。

其中**重置**= 恢复默认设置（引擎 Reset to Default：背景 / 环境贴图 / 显示项 / 导入参数）
+ 重新加载默认模型（`/初始模型.STEP`），视角与材质颜色由"模型加载完成"回调统一复位。

**按钮选中态（功能区高亮）的规则**（`src/viewer/viewerState.js` + `RibbonToolbar.vue`）：
- **开关类 / 面板类**按钮的 `state` 字段声明了它的真实状态来源，高亮 = 当前真实状态，状态没了高亮就没了：
  模型详情 / 导入设置（浮层是否打开）、显示边线（`edgeSettings.showEdges`）、
  透视·正交（`viewer.GetProjectionMode()`）、Z·Y 轴向上（`viewer.upVector.direction`）、
  锁定上方向·自由旋转（`upVector.isFixed`）、测量（`measureTool.IsActive()`）、自动旋转（内部状态）。
- **一次性动作**（视角预设、适应屏幕、重置、截图、快照、导出、下载、打开模型、背景色、环境贴图…）
  只做 420ms 的"按下"高亮，**不会一直亮着**（转动模型后也不会残留选中样式）。
- 状态刷新时机：命令执行完、面板浮层开关后立即刷新（自定义事件 `mc:viewer-state-changed`），
  另有 700ms 轮询兜底（引擎内部引起的变化，例如测量结束）。

**O3DV 自带界面的功能去向**（原来只有它自己的顶栏/侧栏里有，现在都在功能区）：

| 原位置 | 功能区按钮 | 实现方式 |
| --- | --- | --- |
| 顶栏「详情」面板 | 模型详情 | `o3dvPanels.js` 浮层 + `panelSet.ShowPanel`（顶点/三角面/单位/尺寸/体积） |
| 顶栏「设置」面板 | 导入设置 | 同上（模型显示项、背景色、实体颜色、棱线） |
| 顶栏「导出 / 下载 / 创建快照」 | 导出模型 / 下载原文件 / 创建快照 | 触发 O3DV 官方对话框（多格式导出、原始文件下载、快照可选尺寸） |
| 顶栏「翻转 / 自由旋转」 | 翻转上下 / 自由旋转 | 切换相机向上向量与旋转模式（「锁定上方向」「Z/Y 轴向上」按要求已移除） |
| 顶栏「从 URL 打开 / 分享 / 深色·浅色模式」 | —（不做按钮） | URL 打开与分享只对"按 URL 加载的模型"有效，本项目是本地文件；主题已由系统主题跟随 |

**约定**：O3DV 自带的顶栏 / 左侧导航 / 右侧设置栏在 CSS 中隐藏（`.model-canvas` 下的规则），
功能由本项目的功能区与左右面板承担；需要用到它的面板时，用「模型详情」「导入设置」把它们
各打开成**独立浮层**（互不干扰、可同时打开，关闭时按原样搬回 `.ov_panel_set_content`），
见 `src/viewer/o3dvPanels.js`。未使用时挂到 body 的 Pickr 颜色选择器也会被隐藏，避免页面底部漏出面板。

**按需加载**：查看器只在**第一次进入「模型查看」**时挂载（`CenterCanvas.vue` 里 `v-if` + `v-show` 组合），
刷新页面停在别的菜单时不会加载 3D 引擎与模型，也不会冒出"正在导入模型"的加载框；
之后再切菜单用 `v-show` 保留实例（模型/视角/设置不丢）。

**弹窗（对话框 / 弹出层 / 面板浮层 / 加载进度）**：
- **位置**：默认停在**模型展示区（中栏）左上角**（内缩 12px），多个浮层同时打开会自动错开 24px；
- **拖动**：按住标题栏即可拖动，**可以一直拖到中栏的最边上**（不做内缩），只保证不超出中栏；
- **样式**：外观与计算弹窗（`.calc-window`）完全对齐 —— 标题栏 32px（图标 + 标题 + 22×22 窗口按钮）、
  正文内边距 10/12、底栏 41px（主按钮 `--accent-fill`、次按钮描边）、数据行「标签左 / 数值右」
  （数值用主题色加粗、等宽数字），与计算弹窗的结果行同款。
  注意 `.o3dv-root` 内是 content-box，所以浮层骨架单独声明了 `box-sizing: border-box`，尺寸才能对上。

**切换菜单不丢状态**：中栏用 `v-show` 而不是 `v-if`（`CenterCanvas.vue`），
切到其它菜单再回到「模型查看」时**不销毁查看器**，模型、视角、背景/边线/环境等设置全部保留；
中栏重新可见时由 `ModelViewer.vue` 里的 ResizeObserver 补一次布局重算与浮层摆位
（隐藏期间画布尺寸是 0，引擎算不出来）。

### 3D 模块的踩坑记录（改动前务必看）

1. **绝不要给 `.main_left_container / .main_right_container` 任何可见宽度**（包括 CSS `width`、
   `display:block`）。O3DV 的 `layouter.Resize()` 用
   `画布宽 = main 宽 - 左容器宽 - 右容器宽` 计算，容器一有宽度画布就变窄，
   而且**不会自动恢复**（表现为"界面有时候会变小"，只有改变窗口尺寸才复原）。
2. **绝不要调用 `viewer.Resize()`（不带参数）**，必须走 `layouter.Resize()`。
   `viewer.Resize(width, height)` 内部会做 `width - margin`：不传参数就是 `undefined - 数字 = NaN`
   → three.js `setSize(NaN, NaN)` → `canvas.width` 被置为 **0** → 画布位图 0×0、画面全空。
   表现就是"模型加载出来一闪就消失、有时又不显示"，而画布的 CSS 尺寸看起来还是正常的。
   （`src/viewer/modelController.js` 的 `syncLayout()/resize()` 已改为调 layouter）
3. **初始视角的适配距离要用引擎自己的算法**：`viewer.navigation.GetFitToSphereCamera(center, radius)`
   （与「适应屏幕」按钮同一套），手写的半角正弦公式只做兜底。原因是 O3DV 的 `model_loaded`
   事件发出时网格可能还没进场景，`GetBoundingSphere()` 拿到的是上一个模型/空包围球，
   照它适配就会"有时很大、有时很小"。`index.vue` 的 `applyDefaultViewWhenReady()` 会
   **重试（最多 2.5s）** 等画布位图尺寸 > 0 且包围球有效，适配成功后再复核一次半径是否变化。
4. **同一时间只能加载一个模型**：引擎加载中再发一次 `LoadModelFromUrlList` 会被直接丢掉。
   所以「打开模型 / 示例 / 重置」都走 `whenViewerReady()` 排队（等就绪且空闲再发），
   并且用户自己加载过模型后（`modelViewer.hasManualLoad()`），启动时的默认模型不再覆盖他的选择。
5. **相机适配距离不能按可能为 0 的画布尺寸算**：`半径 / sin(半角)` 在画布宽高为 0 时
   会得到 0 → 距离 = ∞ → 模型飞出视野。`useModelDisplay.js` 的 `getFitDistance()` 已做兜底
   （位图尺寸无效时回退 CSS 尺寸；算不出有限正数就不动相机）。
4. `ModelViewer.vue` 里有 800ms 的**自愈**轮询：画布没铺满中栏、画布位图被清零、
   相机距离非有限时自动重算布局 / 回到默认视角（连续纠正 10 次后停手，恢复正常即归零）。
5. 主题联动只保留一处（`ModelViewer.vue`，跟随本项目的白/黑/科技蓝）。
   原 `useO3dvViewer.js` 里监听 `html.dark` 的"系统主题同步"已废弃：本项目主题类写在
   body 上，html 上永远没有 dark，它会深色主题下把 O3DV 强切回亮色。

（顶栏相关的死代码已清掉：按钮换行、禁用斜杠、方框视图图标、文件名移到快照后、Powered by 链接
这些 CSS 都随着自定义工具栏一起删除；O3DV 必需的 DOM 骨架 `#header/#toolbar/#main_file_name`
保留，因为引擎自身会往里写内容。）

**新增一个 3D 功能**：在 `src/viewer/commands.js` 加一条命令 -> 在 `src/config/ribbon/modelView.js`
加一个按钮即可，界面与布局都不用改。若该功能只在 O3DV 自己界面里，则在
`src/viewer/o3dvControls.js` 登记一条文案即可按文案触发。

1. **改代理目标**：`.env.development` 中 `VITE_APP_PROXY_TARGET` 改成你的后端地址
   （生产环境改 `.env.production` 的 `VITE_APP_BASE_API`）。
2. **写接口**：在 `src/api/` 下新建文件，统一使用 `@/utils/request`：

```js
import request, { download } from '@/utils/request'

export function listScheme(query) {
  return request({ url: '/calc/scheme/list', method: 'get', params: query })
}

export function addScheme(data) {
  return request({ url: '/calc/scheme', method: 'post', data })
}

export function exportCalc(params) {
  return download('/calc/export', params, '计算结果.xlsx')
}
```

3. **在页面中调用**：

```js
import { listScheme } from '@/api'
const res = await listScheme({ pageNum: 1, pageSize: 10 })
```

### request.js 保留的能力（与旧项目一致）

| 能力 | 说明 |
| --- | --- |
| Token 自动携带 | 从 cookie 取 `Admin-Token`，加 `Authorization: Bearer xxx`；请求头设置 `isToken: false` 可跳过 |
| 防重复提交 | POST/PUT 默认开启（间隔 `interval`，默认 1000ms）；请求头 `repeatSubmit: true` 可跳过 |
| GET 参数拼接 | 自动 `tansParams` 转成 URL 参数（兼容对象/数组嵌套） |
| 统一响应处理 | `code === 200` 返回 `res.data`；401 提示重新登录；500/601 分别报错/告警 |
| 统一异常提示 | 网络异常、超时、HTTP 状态码自动转中文提示 |
| 文件下载 | `download(url, params, filename)`：带 loading、blob 校验、异常兜底 |
| 大请求保护 | 请求体超 5MB 时跳过防重校验 |

### AI 接口

默认 `VITE_APP_AI_ENABLE = false`，使用 `src/utils/assistant.js` 的离线解析（识别关键词 + 数值单位，自动在中间打开计算框并回填参数）。
置为 `true` 后 `src/api/ai.js` 会请求 `/ai/chat`，接口异常时自动回退到离线解析。

---

## 八、主题

只保留三种：**白（亮色）/ 黑（暗色）/ 科技蓝**。

`src/store/modules/theme.js` 中用 `THEME_SEQUENCE = ['light', 'dark', 'tech']` 控制循环顺序，
点击顶栏右上角图标循环切换，结果写入 `localStorage`（键 `mc-theme`），刷新后保持。

科技蓝（`.tech-theme`）取自数据大屏风格，但刻意**克制用色**：深蓝底 + 极淡网格底纹，
青色 `#38bdf8` 只出现在面板标题的左竖条、激活按钮、结果数值和曲线上，**全站没有发光/阴影特效**，
靠面板标题竖条、分区标题和边框线来体现结构。

新增主题：在 `theme.css` 里加一组 CSS 变量（`.xxx-theme { ... }`），并登记到 `THEME_SEQUENCE` / `THEME_META`。

---

## 九、刷新行为与「计算记录」

**刷新页面 = 干净的新页面**：左侧浏览树、计算框、参数全部从空白开始，不做工作区恢复
（默认也不放任何预设标签，`INITIAL_NODES` 是空数组）。想预置标签就往
`src/config/tree.js` 的 `INITIAL_NODES` 里加 `{ folderKey, itemKey, label }`。

唯一跨刷新保留的是 **最近三次「计算记录」**（`localStorage` 键 `mc-calc-history`）：

| 项 | 说明 |
| --- | --- |
| 记什么 | 当时打开的计算框（标签名 + 所属文件夹 + 功能）与它们的**全部参数**（公式参数、单位换算的数值/源单位/目标单位） |
| 什么时候记 | 状态变化后防抖 1.5s、页面隐藏 / 离开时立即。判定规则：与最新一条**是同一批计算**（标签集合/所属文件夹/名称都一样）时只**原地刷新参数**；**换了一批计算**（新开了别的功能、或关掉又开别的）就**新增一条记录**；内容完全没变则不写。所以改参数不会刷出一堆重复记录，而做第 2、3 次计算时都会各留一条 |
| 怎么用 | 中栏空状态「常用计算」下方显示「计算记录（最近三次）」，点卡片即按原来的文件夹/功能重建标签、还原参数并打开计算框；旁边有「清空」 |

模型查看界面不受影响：它的资源与设置由 O3DV 自己管理（`SwitchTheme` / cookies），
刷新后在进入该菜单时按需重新加载。

想彻底清空：浏览器控制台执行 `localStorage.removeItem('mc-calc-history')`，
或在代码里调用 `useWorkbenchStore().clearHistory()`。
