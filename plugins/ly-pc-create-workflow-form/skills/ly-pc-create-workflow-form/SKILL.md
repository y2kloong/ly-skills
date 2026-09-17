---
name: ly-pc-create-workflow-form
description: 快速生成PC审批流程模版骨架.
disable-model-invocation: true
---

# PC 端工作流表单生成器

本 skill 用于在**采用 `src/modules/workflow` 工作流运行时框架的 PC 端 Vue3 工程**中，一次性生成一整套工作流审批表单所需的文件。生成物是**可直接编译运行的骨架**：框架接线（文件路径、导出名、6 个工作流钩子、mixin 集成、回调契约）全部正确，业务字段与接口调用留 `TODO` 由用户填充。

框架契约与参考示例已**内置在本 skill 目录**，不依赖当前项目里是否有示例页，可在任意同框架项目中使用。

## 为什么是这两个文件

工作流表单不是"写个页面挂个路由"就能用的。后端流程节点配置里存的是一个**页面路径字符串**：

```
/vue-workflow-form/<formKey>?wfid=xxx&pt=0&business_no=xxx
```

框架的 `getMatchedWorkflowFormConfig()`（`src/modules/workflow/utils/index.ts`）拿到这个字符串后，做两件事：

1. 用 `import.meta.glob('../../../../workspace/views/workflow/form/**/index.js')` 扫描所有流程表单配置入口；
2. 把路径中 `/vue-workflow-form/` 和 `?` 之间的那段字符串（即 `<formKey>`）与扫描到的**文件夹名**逐一比对，命中则动态加载该 `index.js`，取其中的 `formAsyncComponent` 注册为表单组件。

所以有两个硬约束，违反了流程就跑不起来、且报错是"请检查该流程表单配置是否正确"这种看不出原因的提示：

- **配置入口必须放在 `workspace/views/workflow/form/<formKey>/index.js`**，且 `<formKey>` 只能是**一层**目录名（glob 与 `slice` 的取值方式决定了嵌套目录会匹配失败）。
- **`<formKey>` 必须与后端流程节点里配置的那段字符串完全一致**（含大小写）。这是前后端唯一的绑定键，写错了前端无论怎么改都不会生效。

而表单组件本身（`.vue`）**允许放在任何位置**——`formAsyncComponent` 就是一个普通 `import()`，用相对路径或 `@/` 别名都行。项目里 39/44 个流程的做法是：配置入口留在 `workspace/`，业务组件放进业务区 `src/views/.../workflow/<FormName>/index.vue`，让业务代码与框架配置分离。本 skill 默认采用这个做法。

## 生成前必须确认

以下信息缺一不可。用户已在指令里给全的直接用；缺失的**一次性问清楚**再动手（不要生成完再返工）：

| 信息 | 说明 | 示例 |
|---|---|---|
| **formKey** | 后端流程节点配置里的表单文件夹名。**这是绑定键，必须与后端完全一致**，含大小写 | `vehicleInspectionReport` |
| **FormName** | 组件目录名，用 PascalCase。通常与 formKey 是同一语义的两种写法 | `VehicleInspectionReport` |
| **业务区目录** | 组件放哪。让用户给，或按语义在 `src/views/VeCenter/views/` 下找同类流程所在目录就近放置 | `src/views/VeCenter/views/workflow/` |
| **业务功能简述** | 这个审批表单做什么，用于起标题、写注释、生成字段 | "车辆验收报告审批" |
| **字段清单** | 表单有哪些字段（key / 中文名 / 类型 / 是否必填 / 权限）。**用户没给就先问，不要凭空编业务字段** | 见下 |
| **详情/保存/提交接口** | 只知道路径就填路径，不知道就留 `TODO` | `/ly/busicen/nevdc/.../xxxQuery` |

字段清单至少要能推导出三份数据：`formInputList`、`formCompList`、以及 `index.vue` 里的字段容器。如果用户说"字段我后面自己填"，那就生成**结构正确、字段为空数组/空对象**的骨架，并把三处需要同步补充的位置用 `TODO` 标注出来——用户最怕的是漏改其中一处，导致流程条件判断拿不到字段。

## 生成物

一次生成 **2 个文件**：

```
workspace/views/workflow/form/<formKey>/index.js          ← 框架配置入口（必须）
src/views/<业务区>/workflow/<FormName>/index.vue          ← 表单组件（业务代码主体）
```

路径以目标项目实际目录为准，不要照搬别的项目。生成前先跑一次 `find <项目>/workspace/views/workflow/form -maxdepth 1 -type d` 看同类流程怎么放的。

### 文件 1：配置入口

照抄 `examples/config-entry.js`，替换 `formKey` / `FormName` / 业务区路径 / 字段数组。

必须导出三个具名常量，**名字一个都不能改**（框架按名字取用）：

| 导出名 | 必需性 | 作用 |
|---|---|---|
| `formAsyncComponent` | **必需** | 返回异步组件。框架取不到它就直接弹"请检查该流程表单配置是否正确" |
| `formInputList` | 建议 | 表单**输入项**源数据。用于流程运行时条件判断、设计时汇总配置、后端节点分流判断 |
| `formCompList` | 建议 | 表单**控件**列表。用于字段级权限，后端只存不解析 |

`formInputList` 每项 `{ key, value, type }`，`type` 取值 `int` / `float` / `string` / `datetime` / `time`。
`formCompList` 每项 `{ key, value, compType }`，`compType` 只对 `text` 做特殊处理，其余按普通控件走。

**两个坑**（项目里真实踩过）：

- `formCompList` 的第三个字段名是 **`compType`**，不是 `type`。写成 `type` 不会报错，但权限配置静默失效。
- 同一个 `index.js` 里 `formInputList` 和 `formCompList` 的 `key` **必须一一对齐**（同一批字段两处都要列），只写一处会导致设计器里配不出权限或条件。

### 文件 2：表单组件

照抄 `examples/form-options-api.vue`，替换占位与字段。

组件形态是 **Options API `export default {}`**，不是 `<script setup>`——因为 `wfOptionExpand` 是靠 `this`、`data()`、`created()` 工作的 mixin，`<script setup>` 下拿不到 `this`，钩子不会被包装，流程会卡在加载中。

骨架包含：

- `mixins: [fastMixins.pageViewMixins, fastMixins.getThisMixins, wfOptionExpand({ detail, save, update })]`
- 6 个工作流钩子，其中 3 个**必须调用 `callback`**（不调用流程会被永久中断，页面看起来"卡住没有任何反应"，非常难排查）
- 业务数据容器 `formData0Fields` / `formData0`，按项目 `fast-form` 习惯留空待填

`wfOptionExpand({...})` 的三个参数（detail / save / update）是**可选**的性能优化：传了接口路径，mixin 会自动帮你拉详情、存草稿。不知道接口就传 `{}`，自己在 `loadData` 里手动请求——两种做法都正常，生成时不要为凑参数去编接口路径。

## 框架契约要点

完整契约（钩子签名、时序、状态字段、actionType 全表、常用范式）见 `references/workflow-contract.md`。写代码前读它；下面是必须记住的骨架：

### 钩子调用时序

```
加载阶段：onWorkflowRuntimeContextAware → loadData → setReadOnly
提交阶段：validData → getData → submitData
```

### callback 契约（最容易出问题的地方）

| 钩子 | 签名 | callback |
|---|---|---|
| `onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext })` | 上下文感知，最先执行。**单个对象，不是两个位置参数** | 不需要 |
| `loadData(business_no, data, form_pp_data, formStatus_data, formControls)` | 加载业务数据。`data` 是**详情接口的 rows 或 `null`**，不是 JSON 字符串 | 不需要 |
| `setReadOnly()` | 查看/只读态 | 不需要 |
| `validData(callback, action)` | 提交前校验 | **必须** `callback({ isValid: boolean })` |
| `getData(callback, action)` | 取提交数据 | **必须** `callback(data)` |
| `submitData(data, callback)` | 执行提交 | **必须** `callback({ success, hasCalledMpApi, message })` |

### 这两个签名最容易写错

框架自带样例里两种写法并存，**照抄哪个都可能错**：

- `approval/index.vue`、`ChangePayMethod/index.vue` 等历史页面写 `onWorkflowRuntimeContextAware(openType, workflowRuntimeContext)` —— 这是**错的**。框架实际传的是单个对象（`StepHandler/index.vue:156`、`YWStepHandler/index.vue:159` 都是 `onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext })`），两个位置参数会拿到 `openType` = 整个对象、`workflowRuntimeContext` = `undefined`。项目里已有页面因此静默失效。
- `demo/index.vue` 写 `({ openType, workflowRuntimeContext })` —— 这个是对的，**照它写**。
- `demo/index.vue` 的 `loadData` 里 `data = '[]'` + `JSON.parse(data)` —— 那是**非 mixin 路径**的形态。本 skill 生成的是 mixin 表单，mixin 会把详情接口的 `rows`（对象或数组）直接传下来，没有业务单号时传 **`null`**（默认参数挡不住 `null`）。按 `references/workflow-contract.md` §5 的归一化写法处理。

写错不会抛异常，只会静默拿到 `undefined`，表现为"上下文取不到 / 数据加载不出来"，排查成本很高。

`submitData` 回调里 `hasCalledMpApi` 的含义要理解清楚，否则会出现"提交成功但流程没往下走"或"流程走了两次"：

- `false` → 框架**替你**调工作流接口推进流程，前提是后端业务接口已经处理完且不需要再回调流程
- `true` → 业务方**自己**（或后端业务接口内部）已经把工作流动作处理掉了，框架不再调

### 方法名同名接管原理

`wfOptionExpand` 在 `created()` 里把组件自己的 `loadData` 存成 `loadDataWf`，再用自己的包装版覆盖 `this.loadData`。所以**组件里方法名必须与钩子名完全相同**（`loadData` / `getData` / `validData` / `submitData` / `setReadOnly` / `onWorkflowRuntimeContextAware`），不要改名成 `handleLoadData` 之类——改名后包装层照样接管，但你写的业务代码永远不会被调用，表现为"数据加载不出来"。

### 字段权限

`loadData` 第 5 参 `formControls` 形如 `[{ controls: [{ key, value, compType, control }] }]`，`control` 三态：`'2'` 可编辑 / `'1'` 只读 / `'0'` 不可见。框架会自动填充到 `controlMap`，但**业务侧仍要自己把它应用到具体控件上**（`fast-form` 用 `disabled` 字段，`el-form` 用 `:disabled`）。

## 生成后检查清单

逐项核对后再交给用户，这些错误在运行期都表现为同一句"流程打不开"，排查成本很高：

1. `formKey` 与后端流程节点配置是否完全一致（含大小写）
2. 配置入口是否严格位于 `workspace/views/workflow/form/<formKey>/index.js`（**一层**目录，不要嵌套）
3. 三个导出名是否是 `formAsyncComponent` / `formInputList` / `formCompList`（拼写、大小写）
4. `formCompList` 用的字段名是否是 `compType`（不是 `type`）
5. `formAsyncComponent` 的 `import()` 路径是否指向真实存在的 `.vue`，`@/`、`@workspace/` 别名是否符合目标项目（其它项目别名可能不同）
6. 组件是否用的 Options API `export default {}`（不是 `<script setup>`）
7. `validData` / `getData` / `submitData` 三条路径上是否**都调用了 callback**（含异常分支——`catch` 里也要 callback，否则请求失败时流程同样卡死）
8. `index.vue` 是否设置了 `name`（`getAndSetData` 依赖它推导 viewPageCode 去合并低代码配置；缺失会拿到 `undefined`）。多数页面直接写 `FormName`，也有的用语义名如 `checkTaskAuditDialog`——关键是**设置且稳定唯一**，不必强求等于 `FormName`
9. 目标项目里是否已有同名 `formKey` 目录（重复会导致 glob 命中不确定）

## 自带参考文件

| 文件 | 用途 |
|---|---|
| `references/workflow-contract.md` | 框架契约全文：发现机制与路径推导、三个导出的规格、`wfOptionExpand`/`wfCompositionExapnd`/`wfOptionExpandLowCode` 三种集成方式对比、钩子时序与签名、actionType 全表、常用范式（字段权限 / 只读态 / 驳回注入主题 / 过滤操作按钮）、跨项目适配注意点 |
| `examples/config-entry.js` | 配置入口成稿示例，替换占位即可用 |
| `examples/form-options-api.vue` | 表单组件成稿示例（Options API + wfOptionExpand），替换占位即可用 |
