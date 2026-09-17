---
name: ly-app-create-workflow-form
description: 快速生成APP审批流程模版骨架.
disable-model-invocation: true
---

# 工作流审批详情页面生成器

本 skill 用于在**采用 `src/modules/workflow` 工作流运行时框架的小程序项目**中生成工作流审批详情页面代码。默认（也是唯一推荐）采用**单文件直集成模式**：业务页面自身直接通过 `wfCompositionExapnd` 集成工作流运行时，**不再生成独立的适配层**。

框架契约与参考示例已**内置在本 skill 目录**，不依赖当前项目里是否有示例页，可在任意同框架项目中使用。首次调用时请先读取：

- `references/workflow-api.md` —— 框架契约（`wfCompositionExapnd` 钩子/状态/actionType/生命周期、container 注册、常用范式）
- `examples/simple-detail.vue` —— 泛化完整成稿示例（直接照抄后替换占位）

## 架构理解

审批详情页面由以下环节组成。业务页面放在业务模块自己的 workflow 目录下，一个表单 = 一个文件：

```
stepHandler/index.vue (审批主页面)
  → container.vue (根据 formName 分发)
    → src/modules/{ModuleName}/workflow/{formName}/index.vue (业务页面，直集成单文件)
```

- `formName` 来源于后端流程节点配置的 FORM_NAME 字段，格式为 `/vue-workflow-form/{formName}?...`，由 `getFormNameFromPagePath()` 提取后传给 container。
- container.vue 通过 `this.$refs[formName + "Ref"]` 调用页面暴露的工作流方法，所以**每个表单只需一个文件**，文件内同时包含：业务展示、6 个工作流钩子、`wfCompositionExapnd` 集成。
- **不要**再往 `src/modules/workflow/form/{formName}/index.vue` 添加适配层（业务页 + 适配层桥接的方式已废弃，冗余）。`form/` 目录下仅保留历史页面；新页面统一放到业务模块的 workflow 目录。

## 生成前确认

在生成代码前，向用户确认以下信息（如果用户已提供则跳过）：

1. **formName** — 工作流表单名称（与后端流程节点配置一致，注意大小写）
2. **业务模块** — 表单属于哪个模块（按目标项目实际模块枚举，如 …Module / GTM 系业务模块）
3. **页面功能简述** — 这个审批页面做什么（如"门店报备申请"、"销售车系新增审批"）
4. **API 接口** — 详情/保存/提交接口路径（如果已知）
5. **页面类型** — 纯只读审批详情，还是需要发起/编辑（影响按钮过滤与只读逻辑的处理）

生成前在目标项目里做两件低成本动作（适配目标项目，非重复探测框架契约）：

- 打开目标项目 `src/modules/workflow/form/container.vue`，确认注册方式与已注册表单列表（每个项目列表不同，必须读实际文件再改）。
- 若目标项目内已有同类已上线的 workflow 页，可打开同模块一个页面，照抄其 import 与组件/样式风格，保持风格统一。

## 代码生成规则

### 单文件直集成模式（唯一推荐）

生成 1 个文件 + 1 处注册修改。

业务页面放在 `src/modules/{ModuleName}/workflow/{formName}/index.vue`，目录名与 formName 保持一致，便于检索。

文件自上而下依次为：

1. **props**：只接收 container 传入的 `getActionButtons` / `updateActionButtons`（页面需要过滤操作按钮时才用）。
2. **6 个工作流钩子**：直接在页面内实现 `onWorkflowRuntimeContextAware`、`loadData`、`setReadOnly`、`validData`、`getData`、`submitData`。
3. **`wfCompositionExapnd` 集成**：把 6 个钩子作为第一个参数传入，解构出需要的工作流响应式状态与 `...methods`。
4. **`defineExpose`**：暴露 `...methods`（含对外工作流方法）与可选的 `getNavTitle`。

完整可照抄的成稿见 `examples/simple-detail.vue`；下面是结构骨架：

```vue
<template>
  <view class="page">
    <!-- 业务展示；解构出的工作流状态为响应式，可直接用于模板：
         formDisabled / formStatus / controlMap / wfStatus 等 -->
  </view>
</template>

<script setup>
import { reactive, computed, ref } from "vue";
import { wfCompositionExapnd } from "@/modules/workflow/expand/mp-wf-plus.js";
import { xxxDetail, xxxSubmit } from "@/modules/{ModuleName}/api/xxx/index.js";

// 仅当页面需要过滤/操作按钮时才保留这两个 props
const props = defineProps({
  getActionButtons: { type: Function, default: () => {} },
  updateActionButtons: { type: Function, default: () => {} },
});

// 业务表单数据 / 字段展示配置 ...

/** 1. 工作流运行时上下文感知（最先执行，在 loadData 之前） */
const onWorkflowRuntimeContextAware = ({
  openType,
  workflowRuntimeContext,
  pageOptions,
}) => {
  // 示例：过滤掉「重新发起」按钮（ACTION_TYPE='2'）
  const currentButtons = props.getActionButtons() || [];
  props.updateActionButtons(
    currentButtons.filter((btn) => btn.ACTION_TYPE + "" !== "2")
  );
};

/** 2. 加载业务数据 */
const loadData = async (
  business_no,
  data = "[]",
  form_pp_data,
  formStatus_data,
  formControls = [],
) => {
  if (!business_no) return;
  const res = await xxxDetail({ param: { businessNo: business_no } });
  // ... 用 res.rows 渲染页面
  // 若涉及字段权限，可先声明本页 controlMap 再保存：
  // formControls[0]?.controls?.forEach((c) => (controlMap[c.key] = c.control));
};

/** 3. 查看/只读态（控件只读由 formDisabled / controlMap 控制，一般无需额外处理） */
const setReadOnly = () => {};

/** 4. 提交前校验（callback 必须执行） */
const validData = (callback, action) => {
  callback({ isValid: true });
};

/** 5. 获取提交数据（callback 必须执行） */
const getData = (callback, action) => {
  callback?.({}); // key-value 表单数据
};

/** 6. 提交（callback 必须执行）
 * actionType: 0发起 1审批 2重新发起 5会签 6驳回 7作废 8转审 13起草 14暂存 18撤回 */
const submitData = async ({ param }, callback, request) => {
  try {
    // 驳回时如需注入流程主题，可先改写 param：
    // if (param?.wfcRejectParam?.businessData) {
    //   param.wfcRejectParam.businessData.carInfo = xxx名称字段;
    // }
    const res = await xxxSubmit({ param: { ...param } });
    const errMsg = res?.msg || res?.message || "操作失败";
    callback({
      success: res.result === "1",
      hasCalledMpApi: true,
      message: res.result === "1" ? "操作成功" : errMsg,
    });
  } catch (error) {
    callback({ success: false, hasCalledMpApi: true, message: "操作失败" });
  }
};
/** ************************ 工作流运行时钩子 end  *************************/

// 自定义导航栏标题
const getNavTitle = () => "{页面标题}";

// 解构出需要的工作流响应式状态 + 对外方法；用不到的项可省略
// 若页面已有同名 controlMap（字段权限），可重命名：controlMap: wfControlMap
const {
  formStatus,
  formDisabled,
  controlMap,
  form_pp,
  workflowRuntimeSession,
  wfStatus,
  staticSeal,
  ...methods
} = wfCompositionExapnd({
  onWorkflowRuntimeContextAware,
  loadData,
  setReadOnly,
  validData,
  getData,
  submitData,
});

defineExpose({ ...methods, getNavTitle });
</script>

<style scoped lang="scss">
.page {
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--bg-primary, #f5f6f8);
}
</style>
```

说明：

- **expose 的是 `...methods`，而不是页面里手写的钩子。** `wfCompositionExapnd` 会把传入的钩子包成对外方法（内部处理按钮状态、按 actionType 组装提交参数、自动拉详情等），所以 `defineExpose` 应展开它返回的 `methods`（含 `onWorkflowRuntimeContextAware / loadData / setReadOnly / validData / getData / submitData / getWfid`）。契约细节见 `references/workflow-api.md`。
- **详情接口二选一**：在自实现的 `loadData` 里手动调用详情接口（推荐），或把接口作为第二参数传 `wfCompositionExapnd({ ...钩子 }, { detail: "/gateway/xxx/detail" })` 自动请求（此时仍需实现 `loadData` 渲染返回的 `data`）。详见 `references/workflow-api.md` §2。
- **页面 UI / import 风格**：优先复用**目标业务模块 components 下**已有的展示组件与同类已上线 workflow 页的写法，保持目标项目风格统一；不要照搬其它项目的组件路径。
- **api 目录**：按目标模块自身 API 约定组织（目录名不一定等于 formName），导入路径以目标项目实际为准。
- **导航标题依赖加载后数据**：可对 wf 的 `loadData` 再包一层，先 `await` 业务加载再更新导航栏标题后 expose。范式见 `references/workflow-api.md` §7.3。

#### 修改：container.vue 注册

在目标项目 `src/modules/workflow/form/container.vue` 中做 3 处修改（import 指向业务模块下的 workflow 文件；先读该文件按当前列表就近插入）：

1. **import**：`import {formName} from "@/modules/{ModuleName}/workflow/{formName}/index.vue";`
2. **components**：添加到 components 对象
3. **模板**：添加条件渲染，ref 命名为 `{formName}Ref`

```vue
<{formName}
  v-else-if="formName === '{formName}'"
  ref="{formName}Ref"
  :getActionButtons="getActionButtons"
  :updateActionButtons="updateActionButtons"
/>
```

ref 命名必须是 `formName + "Ref"`，因为 container 的 methods 中通过 `this.$refs[this.formName + "Ref"]` 动态调用。若页面不使用按钮过滤，可不传 `:getActionButtons` / `:updateActionButtons`。

模板中可通过解构出的工作流状态控制 UI：

- `wfStatus.isApproval` — 是否审批模式
- `wfStatus.readonly` — 是否只读
- `wfStatus.launchAdd` — 是否首次发起
- `wfStatus.launchAgain` — 是否驳回后重新发起
- `formDisabled` — 表单是否禁用
- `controlMap` — 字段权限（`'0'`隐藏, `'1'`只读, `'2'`可编辑）

## 工作流生命周期

```
加载阶段：onWorkflowRuntimeContextAware → loadData → setReadOnly
提交阶段：validData → getData → submitData
```

## actionType 对照表

| 值 | 含义 | 值 | 含义 |
|---|---|---|---|
| 0 | 发起 | 6 | 驳回 |
| 1 | 审批 | 7 | 作废 |
| 2 | 重新发起 | 13 | 起草 |
| 5 | 会签 | 14 | 暂存 |
| 8 | 转审 | 18 | 撤回 |

## 生成后的检查清单

生成代码后，逐项确认：

1. formName 是否与后端配置一致（含大小写）
2. 业务页面的 6 个钩子是否都实现并传入 `wfCompositionExapnd`
3. `defineExpose` 是否暴露了 `...methods` 与 `getNavTitle`
4. container.vue 中 ref 命名是否为 `formName + "Ref"`
5. container.vue 的 import 路径是否指向目标项目的 `@/modules/{ModuleName}/workflow/{formName}/index.vue`
6. validData、getData、submitData 中是否都调用了 callback
7. submitData 中是否正确处理了不同 actionType（驳回注入主题等）
8. API 接口路径/网关前缀是否符合目标项目（`/gateway/mainapp`、`/gateway/channel`、`/gateway/aftersale`、`/gateway/otd`、`/gateway/clue` 等按目标项目）
9. 需要过滤操作按钮的页面，是否在 `onWorkflowRuntimeContextAware` 中调用 `getActionButtons` / `updateActionButtons`

## 自带参考文件

| 文件 | 用途 |
|---|---|
| `references/workflow-api.md` | 框架契约：`wfCompositionExapnd` 钩子签名/可解构状态/actionType/生命周期、container 注册 3 步、常用范式（按钮过滤/字段权限/动态标题/驳回注入主题）与检查清单 |
| `examples/simple-detail.vue` | 泛化完整成稿示例：只读详情 + 字段权限 + 过滤「重新发起」按钮；直接照抄后替换占位（`xxxDetail/xxxSubmit/{ModuleName}/展示组件`） |
