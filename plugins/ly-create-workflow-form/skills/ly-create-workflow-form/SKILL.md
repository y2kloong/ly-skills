---
name: ly-create-workflow-form
description: |
  生成新的工作流审批详情页面代码，包括业务页面、工作流适配层和 container 注册。
  仅当用户明确表示要“新建/创建/新增/生成/开发”一个工作流表单、审批详情页、审批页面、流程表单页面时使用。
  典型触发：新建审批页面、创建工作流表单、新增审批详情、添加审批表单、开发工作流页面、新建 workflow form。
  如果用户只是分析、排查、修改、重构、修复已有审批/待办/流程页面，不要自动触发；除非用户明确要求生成新的 workflow form 代码。
---

# 工作流审批详情页面生成器

本 skill 用于在 delivery-miniprogram 项目中生成完整的工作流审批详情页面代码。根据用户提供的需求，自动生成业务页面、适配层组件，并指导注册到 container.vue。

## 架构理解

审批详情页面由 3 层组成：

```
stepHandler/index.vue (审批主页面)
  → container.vue (根据 formName 分发)
    → form/{formName}/index.vue (适配层)
      → 业务页面.vue
```

formName 来源于后端流程节点配置的 FORM_NAME 字段，格式为 `/vue-workflow-form/{formName}?...`，由 `getFormNameFromPagePath()` 提取后传给 container。

## 生成前确认

在生成代码前，向用户确认以下信息（如果用户已提供则跳过）：

1. **formName** — 工作流表单名称（与后端流程节点配置一致）
2. **业务模块** — 表单属于哪个模块（如 ChannelModule / OtdModule / ClueModule）
3. **页面功能简述** — 这个审批页面做什么（如"门店报备申请"、"订单回退"）
4. **API 接口** — 详情/保存/提交接口路径（如果已知）
5. **集成模式** — 选择以下之一：
   - **Wrapper 模式**（推荐）：业务页面已有或需要独立使用，适配层包装桥接工作流。参考 `verificationTask` 的实现。
   - **直集成模式**：简单表单，直接在 form/index.vue 中实现所有逻辑，适合字段少、无需复用的场景。参考 `orderBack` 的实现。

## 代码生成规则

### Wrapper 模式

生成 2 个文件 + 1 处注册修改。

#### 文件 1：业务页面

放在业务模块目录下。业务页面是一个独立的 Vue 3 组件（`<script setup>`），需要：

**props 接收：**
- `wfData` (Object) — 工作流响应式状态
- `getActionButtons` (Function) — 获取操作按钮列表
- `updateActionButtons` (Function) — 更新操作按钮列表

**通过 defineExpose 暴露 6 个方法：**

```vue
<script setup>
import { ref } from 'vue';

const props = defineProps({
  wfData: { type: Object, default: null },
  getActionButtons: { type: Function, default: () => {} },
  updateActionButtons: { type: Function, default: () => {} }
});

// 1. 工作流上下文（最先执行，在 loadData 之前）
// openType: '-1'发起, '0'查看, '1'处理待办
const onWorkflowRuntimeContextAware = (workflowRuntimeSession) => {
  const { openType, workflowRuntimeContext, pageOptions } = workflowRuntimeSession;
  // 根据业务需要：自定义按钮、控制编辑状态等
};

// 2. 加载业务数据
const loadData = (business_no, data, form_pp, formStatus, formControls) => {
  if (business_no) {
    // 调用详情接口加载数据
  }
};

// 3. 设置只读
const setReadOnly = () => {
  // 禁用表单控件
};

// 4. 校验（必须调用 callback）
const validData = (callback, action) => {
  callback({ isValid: true });
};

// 5. 获取数据（必须调用 callback）
const getData = (callback, action) => {
  const formData = {}; // 收集表单数据
  callback(formData);
};

// 6. 提交（必须调用 callback）
const submitData = async ({ param }, callback, request) => {
  try {
    // 根据 actionType 调用不同接口
    // actionType: 0发起, 1审批, 2重新发起, 6驳回, 7作废, 13起草, 18撤回
    callback({ success: true, hasCalledMpApi: true, message: '操作成功' });
  } catch (e) {
    callback({ success: false, hasCalledMpApi: true, message: '操作失败' });
  }
};

defineExpose({
  onWorkflowRuntimeContextAware,
  loadData,
  setReadOnly,
  validData,
  getData,
  submitData
});
</script>
```

在模板中可通过 `wfData` 访问工作流状态：
- `wfData.wfStatus.isApproval` — 是否审批模式
- `wfData.wfStatus.readonly` — 是否只读
- `wfData.wfStatus.launchAdd` — 是否首次发起
- `wfData.wfStatus.launchAgain` — 是否驳回后重新发起
- `wfData.formDisabled` — 表单是否禁用
- `wfData.controlMap` — 字段权限（`'0'`隐藏, `'1'`只读, `'2'`可编辑）

#### 文件 2：适配层 index.vue

放在 `src/modules/workflow/form/{formName}/index.vue`。

```vue
<template>
  <businessPage
    ref="businessRef"
    :wfData="wfData"
    :getActionButtons="getActionButtons"
    :updateActionButtons="updateActionButtons"
  />
</template>

<script setup>
import { ref, defineExpose, defineProps } from 'vue';
import businessPage from '@/modules/{ModuleName}/path/to/businessPage.vue';
import { wfCompositionExapnd } from '@/modules/workflow/expand/mp-wf-plus.js';

const businessRef = ref(null);
const props = defineProps({
  getActionButtons: { type: Function, default: () => {} },
  updateActionButtons: { type: Function, default: () => {} }
});

const getNavTitle = ({ openType, workflowRuntimeContext, pageOptions }) => {
  return '{页面标题}';
};

const wfData = wfCompositionExapnd({
  onWorkflowRuntimeContextAware: (...args) => businessRef.value.onWorkflowRuntimeContextAware(...args),
  setReadOnly: (...args) => businessRef.value.setReadOnly(...args),
  validData: (...args) => businessRef.value.validData(...args),
  getData: (...args) => businessRef.value.getData(...args),
  loadData: (...args) => businessRef.value.loadData(...args),
  submitData: (...args) => businessRef.value.submitData(...args),
});
// 如果需要自动请求详情接口，可传入第二个参数：
// }, { detail: '/gateway/xxx/detail' });

defineExpose({ ...wfData, getNavTitle });
</script>
```

#### 修改：container.vue 注册

在 `src/modules/workflow/form/container.vue` 中做 3 处修改：

1. **import**：`import {formName} from "./{formName}/index.vue";`
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

ref 命名必须是 `formName + "Ref"`，因为 container 的 methods 中通过 `this.$refs[this.formName + "Ref"]` 动态调用。

### 直集成模式

只生成 1 个文件 + 1 处注册修改。form/index.vue 同时包含业务逻辑和工作流钩子。

在这种模式下，直接在 form/index.vue 中：
1. 用 `wfCompositionExapnd` 包装工作流方法
2. 解构出 `workflowRuntimeContext`, `formStatus`, `formDisabled`, `controlMap`, `wfStatus`, `getWfid` 等响应式状态
3. 通过 `defineExpose` 导出 methods

参考 `src/modules/OtdModule/workflow/orderBack/index.vue` 的实现方式。

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

1. formName 是否与后端配置一致
2. 业务页面的 6 个方法是否都通过 defineExpose 暴露
3. 适配层的 ref 是否传递给了业务页面
4. wfCompositionExapnd 的方法桥接是否完整（6 个方法都要转发）
5. container.vue 中 ref 命名是否为 `formName + "Ref"`
6. validData、getData、submitData 中是否都调用了 callback
7. submitData 中是否正确处理了不同 actionType
8. API 接口路径是否正确（网关前缀：`/gateway/mainapp`、`/gateway/channel`、`/gateway/aftersale`、`/gateway/otd`、`/gateway/clue`）

## 现有实现参考

当用户描述的需求与以下已有表单类似时，可参考对应实现：

| formName | 文件路径 | 适用场景 |
|---|---|---|
| verificationTask | workflow/form/verificationTask/ + ChannelModule 门店报备 | Wrapper 模式参考 |
| orderBack | OtdModule/workflow/orderBack/ | 直集成模式参考 |
| confirmApply | OtdModule/workflow/confirmApply/ | 带滚动处理的复杂表单 |
| demo | workflow/form/demo/ | 最简示例 |
