# 工作流运行时契约（自包含参考）

> 本文档固化自 MP 框架 PC 端工程的 `src/modules/workflow/**` 与 `workspace/views/workflow/**`，供生成代码时直接参照，**无需**在运行期读取目标项目源码。
> 前提：目标项目与本框架同源，使用同一套工作流运行时。若目标项目框架版本不同、出现行为差异，以该项目实际文件为准。

## 目录

1. [表单发现机制与路径推导](#1-表单发现机制与路径推导)
2. [配置入口三个导出的规格](#2-配置入口三个导出的规格)
3. [三种集成方式对比](#3-三种集成方式对比)
4. [wfOptionExpand 详解](#4-wfoptionexpand-详解)
5. [钩子时序与签名](#5-钩子时序与签名)
6. [提交回调与 actionType](#6-提交回调与-actiontype)
7. [字段权限 controlMap](#7-字段权限-controlmap)
8. [常用范式](#8-常用范式)
9. [跨项目适配注意点](#9-跨项目适配注意点)

---

## 1. 表单发现机制与路径推导

### 后端存的是什么

后端流程节点配置里存的页面路径是一个字符串：

```
/vue-workflow-form/<formKey>?wfid=d73957a37deb478fbb0d08d3759fce1f&ntype=0&pt=0&form=179194e1c4c44cdca4b740081282e803&caller=1&business_no=8741567495032505#####
```

- `/vue-workflow-form/` 是固定标识 `VueWorkFlowFormMark`
- `<formKey>` 是前端表单文件夹名
- `business_no` 为业务主键，发起时由前端生成或后端回填

### 框架怎么找

`getMatchedWorkflowFormConfig(pagePath)`（`src/modules/workflow/utils/index.ts`）：

```js
const VueWorkFlowFormMark = 'vue-workflow-form'

if (pagePath.indexOf(VueWorkFlowFormMark) > -1) {
  if (pagePath.indexOf('?') === -1) pagePath += '?env=designTime'  // 设计时无 query
  const startIndex = VueWorkFlowFormMark.length + 2   // '/vue-workflow-form/' 之后
  const endIndex = pagePath.indexOf('?')
  const formFoldName = pagePath.slice(startIndex, endIndex)

  const modules = import.meta.glob(`../../../../workspace/views/workflow/form/**/index.js`)
  for (const path in modules) {
    const sIndex = path.indexOf('/workflow/form') + 14
    const moduleFoldName = path.slice(sIndex + 1, -9)   // -9 去掉 '/index.js'
    if (moduleFoldName === formFoldName) { /* 命中，动态加载 */ }
  }
}
```

### 由此推出的三条硬约束

| 约束 | 原因 | 违反后果 |
|---|---|---|
| 配置入口必须在 `workspace/views/workflow/form/<formKey>/index.js` | glob 路径写死在框架里 | 永远匹配不到，弹"请检查该流程表单配置是否正确" |
| `<formKey>` 必须**只有一层**目录 | `slice(sIndex + 1, -9)` 取的是 `workflow/form/` 与 `/index.js` 之间的**整段**字符串，嵌套目录会得到 `a/b` 这样的值，与后端给的单一名字对不上 | 同上 |
| `<formKey>` 必须与后端配置完全一致（含大小写） | 字符串精确比较 `===` | 同上 |

### 组件的落位是自由的

`formAsyncComponent` 只是一个 `import()`。项目里同时存在两种落位，都能正常工作：

| 落位 | 写法 | 数量 |
|---|---|---|
| 业务区（主流） | `() => import('@/views/VeCenter/views/workflow/<FormName>/index.vue')` | 39 / 44 |
| 与配置同目录 | `() => import('./index.vue')` | 5 / 44（框架自带的 demo / approval 样例） |

业务区落位把业务代码与框架配置分离，是团队约定，也是本 skill 的默认。

---

## 2. 配置入口三个导出的规格

```js
// 工作流表单配置入口 （必须） 不可删除或重命名
export const formAsyncComponent = () => import('@/views/.../workflow/Xxx/index.vue')

export const formInputList = [
  { key: 'orderNum', value: '订单数量', type: 'int' }
]

export const formCompList = [
  { key: 'orderNum', value: '订单数量', compType: 'input' }
]
```

### `formAsyncComponent`（必需）

返回异步组件的函数。框架取 `matchedWorkflowFormConfig.formAsyncComponent` 后交给 `defineAsyncComponent`。缺失或拼错名字 → 表单注册不上，直接走 `formNotFoundMsg` 提示分支。

### `formInputList`（建议）

表单**输入项**源数据，三个用途：

1. 工作流运行时**条件判断**表单域数据源（网关条件）
2. 工作流**设计时**汇总配置表单数据源
3. 运行时**后端服务做节点分流**时的条件判断

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | String | 唯一识别字段 key，**不能重复** |
| `value` | String | 字段释义（中文名） |
| `type` | String | `int` 整型 / `float` 浮点 / `string` 字符串 / `datetime` 日期时间 / `time` 时间 |

### `formCompList`（建议）

表单**控件**列表，用于字段级权限。后端只做存储和读取，不解析。

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | String | 唯一识别字段 key，**不能重复**，需与 `formInputList` 对齐 |
| `value` | String | 字段释义 |
| `compType` | String | 组件类型。`text` 会被特殊处理（纯文本展示），其余按普通控件 |

> **易错点**：第三个字段名是 `compType`。项目里 `Vehiclelabel/index.js` 的 `formCompList` 误写成 `type`，代码不报错但权限配置静默失效。生成时务必核对。

### 空数组是否可以

可以。`formAsyncComponent` 之外的两个导出即使是空数组，流程也能跑起来——只是设计器里配不出条件分支和字段权限。若用户说"字段后面再补"，就生成空数组并加 `TODO` 注释，**同时**在 `index.vue` 的字段容器处也加 `TODO`，三处同步补齐。

---

## 3. 三种集成方式对比

`workspace/views/workflow/expand/mp-wf-plus.js` 导出三个函数：

| 导出 | API 风格 | 适用 | 项目现状 |
|---|---|---|---|
| `wfOptionExpand` | Options API mixin | 普通 PC 页面 | **src 下 44 个业务页全部使用** |
| `wfCompositionExapnd` | 组合式函数 | `<script setup>` 页面 | PC 端暂无使用；小程序端主流 |
| `wfOptionExpandLowCode` | Options API mixin | 表单由低代码设计器绘制的页面 | 少量 |

`export default wfCompositionExapnd` 是默认导出。

**本 skill 只生成 `wfOptionExpand` 形态**（用户的选定）。三者契约一致——都是包装同样 6 个钩子、暴露同样的对外方法，差别只在语法形态。若目标项目某个表单确实是低代码绘制的，改用 `wfOptionExpandLowCode` 并去掉 `.vue` 模板与 `formAsyncComponent`。

---

## 4. wfOptionExpand 详解

### 调用形态

```js
import { wfOptionExpand } from '@workspace/views/workflow/expand/mp-wf-plus.js'

export default {
  mixins: [fastMixins.pageViewMixins, fastMixins.getThisMixins, wfOptionExpand({})],
  // ...
}
```

### 三个可选参数：detail / save / update

```js
wfOptionExpand({
  detail: '/gateway/xxx/detail',   // 加载明细
  save:   '/gateway/xxx/save',     // 保存
  update: '/gateway/xxx/update'    // 更新（不传则回落到 save）
})
```

也支持位置参数 `wfOptionExpand(detail, save, update)`。三种取值形态：

- 对象 → 整个 `WfRequestMsg[key]` 被替换（可带 `method` / `url` / `request`）
- 字符串 → 只设 `url`
- 函数 → 只设 `request`（自定义请求函数）

传了接口路径，mixin 会在框架流程里**自动帮你请求**，你只需在 `loadData` 里渲染返回值。**不传也完全正常**——自己在 `loadData` 里手动请求即可。不要在生成时为了填参数而编造接口路径。

`update` 为空时自动回落到 `save`。

### 注入的 data 字段

mixins 自动注入以下响应式状态（不要在自己的 `data()` 里重复定义）：

| 字段 | 含义 |
|---|---|
| `formStatus` | 表单状态 `'0'` 新增 / `'1'` 修改 |
| `formDisabled` | 表单是否禁用 |
| `controlMap` | 字段权限 map，`c.key -> c.control` |
| `form_pp` | 工作流扩展属性 |
| `workflowRuntimeSession` | 工作流运行时会话 |
| `wfStatus` | `{ isApproval, readonly, launchAdd, launchEdit, launchAgain }` |
| `staticSeal` | 框架内部密封状态，业务侧一般不用 |

### 方法名同名接管原理（关键）

在 `created()` 里：

```js
if (this.onWorkflowRuntimeContextAware) this.onWorkflowRuntimeContextAwareWf = this.onWorkflowRuntimeContextAware
this.onWorkflowRuntimeContextAware = methods.onWorkflowRuntimeContextAware

if (this.loadData) this.loadDataWf = this.loadData
this.loadData = methods.loadData
// setReadOnly / getData / validData / submitData 同理
```

组件里定义的钩子被**改名备份**成 `xxxWf`，再由 mixin 的包装版覆盖同名方法。包装版负责：按钮状态维护、按 `actionType` 组装提交参数、自动拉详情，然后在合适的时机回调业务侧真正实现的 `xxxWf`。

**推论**：组件里的方法名必须与钩子名**完全同名**。若写成 `handleLoadData`，mixin 的 `this.loadData` 为空、不备份；而 `this.loadData` 被包装版覆盖后只会去调 `this.loadDataWf`（undefined）——你写的业务代码永远不会执行，表现为"数据加载不出来"。

### `this.$options.name` 的用途

若用 `this.getAndSetData(this, {...})` 包裹 `data()`，`getAndSetData` 会用 `self.$options.name` 推导 `viewPageCode` 去查低代码页面配置。因此组件的 `name` 应设置为 `FormName`（去掉可能存在的数字后缀）。

不包裹时（直接 `return {...}`）没有这个依赖，但项目主流写法是包裹，用于把低代码配置里的字段定义合并进来。

---

## 5. 钩子时序与签名

```
加载：onWorkflowRuntimeContextAware → loadData → setReadOnly
提交：validData → getData → submitData
```

> **⚠ 先读这一节再看签名表。** `wfOptionExpand` 场景下的 `onWorkflowRuntimeContextAware` 与 `loadData` 的入参形态，和框架自带样例（`demo` / `approval`）里写的**不一致**，两边各有一半是过时写法。签错不会报错，只会静默拿到 `undefined`，表现为"上下文取不到 / 数据加载不出来"。

| 钩子 | 实际签名 | callback 契约 |
|---|---|---|
| `onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext })` | **单个对象**，不是两个位置参数。`openType`：`'-1'` 发起 / `'0'` 查看 / `'1'` 处理代办。**在 `loadData` 之前执行** | 不需要 |
| `loadData(business_no, data, form_pp_data, formStatus_data, formControls)` | `data` 是**详情接口的 rows（对象或数组），没有业务单号时是 `null`**——不是 JSON 字符串 | 不需要 |

#### `onWorkflowRuntimeContextAware` 为什么是单对象

两条路径传的形状其实一致：

```js
// 非 mixin 路径（StepHandler/index.vue:155）
workflowFormRef.value.onWorkflowRuntimeContextAware({
  openType: openType.value,
  workflowRuntimeContext: objSession
})

// mixin 路径（wfMethodsCommon，mp-wf-plus.js:75）
onWorkflowRuntimeContextAware(workflowRuntimeSession)   // 同一个对象
```

写成 `onWorkflowRuntimeContextAware(openType, workflowRuntimeContext)` 时，`openType` 收到的是整个对象、`workflowRuntimeContext` 是 `undefined`。

> 项目里 `approval/index.vue`、`ChangePayMethod/index.vue` 等历史页面就是这么写的——它们若真的读 `openType` 判断发起/查看，判断会失效。生成新代码时不要照抄这两个文件，要照 `demo/index.vue` 的写法（`({ openType, workflowRuntimeContext })`）。

#### `loadData` 的 `data` 为什么不是 JSON 字符串

mixin 自己请求详情接口，然后把**响应 rows 直接传下来**：

```js
// mp-wf-plus.js wfMethodsCommon.loadData
if (res) {
  const data = getRequestData(res)
  if (data.result === '1') loadData(business_no, data.rows, form_pp, formStatus, formControls)
  else ElMessage.error(data.msg || '请求失败')
} else {
  loadData(business_no, null, form_pp, formStatus, formControls)   // ← null，不是 '[]'
}
```

所以：

- 传了 `wfOptionExpand({ detail })` 且接口返回成功 → `data` 是 `rows`（对象或数组，取决于后端）
- 没传 detail 接口，或没有 `business_no` → `data` 是 **`null`**
- 写默认参数 `data = '[]'` 挡不住 `null`（默认值只在 `undefined` 时生效）

因为 `rows` 可能是对象也可能是数组，稳妥写法是先归一化再回填：

```js
loadData(business_no, data, form_pp_data, formStatus_data, formControls = []) {
  let rows = data
  if (typeof rows === 'string') { try { rows = JSON.parse(rows) } catch { rows = [] } }
  const list = Array.isArray(rows) ? rows : rows ? [rows] : []
  if (list.length) {
    // 数组形态通常是 [{ key, value }]，对象形态直接就是字段对象
    list.forEach((item) => {
      if (item && typeof item === 'object' && 'key' in item) this.formData0Fields[item.key] = item.value
      else Object.assign(this.formData0Fields, item)
    })
  }
}
```

> 框架自带样例 `demo/index.vue` 写的是 `JSON.parse(data)` 并 `data = '[]'` 默认值——那是**非 mixin 路径**的形态（`StepHandler` 从 `wfInfo.businessdata[0].BUSINESSDATA` 取，确实是 JSON 字符串）。生成 mixin 表单时不要照抄。

| 钩子 | 签名 | callback 契约 |
|---|---|---|
| `setReadOnly()` | 框架已把 `formDisabled` / `wfStatus.readonly` 置真，一般只需业务自定义处理 | 不需要 |
| `validData(callback, action)` | `action` 是当前动作信息。**校验不通过也要 callback** | **必须** `callback({ isValid: boolean })` |
| `getData(callback, action)` | 返回要提交的业务数据（key-value 对象） | **必须** `callback(data)` |
| `submitData(data, callback)` | `data` 是框架组装的提交数据，结构见下 | **必须** `callback({ success, hasCalledMpApi, message })` |

> **不调用 callback 的后果**：工作流执行被**永久中断**。页面不报错、不提示、看起来只是"卡住没有任何反应"，排查成本极高。所有分支（含 `catch`、含用户 `confirm` 取消）都要保证 callback 被调用。

### submitData 的入参结构

```js
data = {
  param: {
    actionType: '0',
    wfcLaunchParam: { /* 发起参数，含 businessData */ },
    wfcApproveParam: { /* 审批参数，含 businessData */ },
    wfcRejectParam: { /* 驳回参数，含 businessData */ },
    businessNo, applyId, /* ... */
  }
}
```

`businessData` 通常需要业务侧注入用于流程列表展示的字段（如客户名、订单号），否则待办列表里该条记录信息为空。

---

## 6. 提交回调与 actionType

### 回调语义

```js
callback({
  success: true,        // 业务调用是否成功
  hasCalledMpApi: true, // 业务（或后端业务接口）是否已处理工作流动作
  message: '操作成功'
})
```

`hasCalledMpApi` 是**事务一致性**开关，理解错了会出现两种反向的 bug：

- `false` → 框架**替你**再调一次工作流接口推进流程。适用于：后端业务接口只落业务数据，流程推进交给前端框架。
- `true` → 框架不再调，认为流程动作已由业务方/后端处理完毕。适用于：后端业务接口内部已调用 `handleWFAction`。

返回 `success: false` 时框架按失败处理并提示 `message`。

### actionType 全表

| 值 | 含义 | 值 | 含义 |
|---|---|---|---|
| 0 | 发起 | 9 | 结束 |
| 1 | 审批 | 10 | 重设责任人 |
| 2 | 重新发起 | 12 | 查看 |
| 5 | 会签提交 | 13 | 起草 |
| 6 | 驳回 | 14 | 暂存 |
| 7 | 作废 | 18 | 撤回 |
| 8 | 转办 | 21 | 抄送 |

默认是审批。常见分支处理：

```js
async submitData(data, callback) {
  try {
    const actionType = String(data?.param?.actionType)
    if (actionType === '7') { /* 作废 */ }
    else if (actionType === '0' || actionType === '2') { /* 发起 / 重新发起 */ }
    else if (actionType === '1' || actionType === '6') { /* 审批 / 驳回 */ }
    else { /* 其它，直接放行 */ }

    callback({ success: true, hasCalledMpApi: true, message: '操作成功' })
  } catch (error) {
    // 用户主动取消则不 callback，避免流程继续（与"卡死"是有意为之的区别）
    if (error.message === '用户取消操作') return
    callback({ success: false, hasCalledMpApi: false, message: '操作失败' })
  }
}
```

---

## 7. 字段权限 controlMap

`loadData` 第 5 参 `formControls` 结构：

```js
[{
  formName: string,
  formId: string,
  platform: '0',            // 考虑多表单情况
  controls: [{
    key: string,
    value: string,
    compType: string,
    control: '2' | '1' | '0'  // 可编辑 / 可读 / 不可见
  }]
}]
```

当前表单权限配置只支持**单表单**，所以直接取 `formControls[0]`。

框架会把 `c.key -> c.control` 填进 `controlMap`，但**不会自动作用到控件上**——业务侧要自己应用：

```js
loadData(business_no, data, form_pp_data, formStatus_data, formControls = []) {
  if (formControls && formControls.length > 0) {
    formControls[0].controls.forEach((c) => {
      const formItem = this.formData0.find((f) => f.codeField === c.key)
      if (formItem) formItem.disabled = c.control === '1'
      // 不可见（'0'）需要业务侧自行控制 v-if / 布局过滤
    })
  }
}
```

### 其它只读来源

除了 `formControls`，实践中还有两个判断只读的入口，生成时应在 `TODO` 注释里提示用户：

- `opentype === '0'`（查看）→ 只读
- `form_pp === 'disabled' | 'end'` → 流程已结束/已作废，只读

---

## 8. 常用范式

### 8.1 过滤操作按钮

在 `onWorkflowRuntimeContextAware` 里过滤掉不需要的按钮（如"重新发起"）：

```js
onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext }) {
  const currentButtons = this.getActionButtons?.() || []
  this.updateActionButtons?.(currentButtons.filter((btn) => btn.ACTION_TYPE + '' !== '2'))
}
```

`getActionButtons` / `updateActionButtons` 是页面级能力，仅在需要过滤时使用。

### 8.2 驳回/审批时注入流程主题字段

待办列表展示的业务字段来自 `businessData`，需要在提交前注入：

```js
async submitData(data, callback) {
  const inject = { custName: this.orderDetail?.carCustName, orderNo: this.orderDetail?.saleOrderCode }
  if (data.param.wfcLaunchParam?.businessData)  data.param.wfcLaunchParam.businessData  = inject
  if (data.param.wfcApproveParam?.businessData) data.param.wfcApproveParam.businessData = inject
  if (data.param.wfcRejectParam?.businessData)  data.param.wfcRejectParam.businessData  = inject
  // ...
}
```

### 8.3 从 URL 取 wfid / pid / pmid

`ChangePayMethod` 里手写了一个 `getWfid(param)` 解析 `window.location.search`。可按需照抄。

### 8.4 发起入口（业务列表页侧）

业务列表页点"发起"不是直接跳表单，而是跳工作流中心路由：

```js
this.$router.push({
  path: '/WorkflowCenterStepHandler',
  query: {
    menuName: encodeMenuName('审批类型名'),
    opentype: '-1',        // '-1' 发起 / '0' 查看 / '1' 处理待办
    wfid, forminfo, pmid, pid, oid, nid, appCode, ptype, step_guid,
    callbackUri: `${window.location.pathname}${window.location.search}&reload=1`
  }
})
```

工具函数在 `src/views/VeCenter/utils/utils.ts`（`onApproval` / `onCancelOrLaunch` / `ObtainProcessInformation`）。本 skill 不生成这部分——用户按需自行接入。

---

## 9. 跨项目适配注意点

本 skill 面向**同框架的多个项目**，生成前需在目标项目确认以下几点，不要照搬其它项目的字面值：

| 检查项 | 怎么确认 |
|---|---|
| 路径别名 | 读目标项目 `vite.config.ts` 的 `resolve.alias` 与 `tsconfig.json` 的 `paths`。本框架通常是 `@` → `src`，`@workspace` → `workspace` |
| 配置入口根目录 | 读目标项目 `src/modules/workflow/utils/index.ts` 里 `import.meta.glob(...)` 的实参。框架默认是 `workspace/views/workflow/form/**/index.js`，但不同项目可能裁改 |
| 业务区组件目录 | `find <项目>/workspace/views/workflow/form -maxdepth 1 -type d` 看已有流程怎么放；再打开 1~2 个同类已上线页面照抄 import 与组件风格 |
| `mp-wf-plus.js` 位置 | 通常 `workspace/views/workflow/expand/mp-wf-plus.js`（业务工作区，随业务代码走）。若目标项目放在 `src/modules/workflow/expand/`，按实际路径引用 |
| 是否存在同名 formKey | 生成前 `ls workspace/views/workflow/form/` 检查，重复目录会让 glob 命中结果不确定 |
| 业务组件库 | 项目主流是 `fastMixins` + `fast-form` + `fast-table`（低代码驱动）。若目标项目无此套件，退化为 `el-form` + 手写字段 |

### 框架无关的通用事实

以下内容与具体项目无关，可直接信赖：

- 发现机制依赖 `/vue-workflow-form/<formKey>` 字符串前缀与文件夹名精确匹配
- 三个配置导出名、`formCompList` 的 `compType` 字段名
- 6 个钩子的名称、签名、时序、callback 契约
- `hasCalledMpApi` 的语义
- actionType 数值表
- `wfOptionExpand` 的同名方法接管原理
