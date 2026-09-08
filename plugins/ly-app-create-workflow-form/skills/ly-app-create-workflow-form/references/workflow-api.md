# 工作流运行时契约（自包含参考）

> 本文档固化自 delivery-miniprogram 的 `src/modules/workflow/expand/mp-wf-plus.js` 与 `src/modules/workflow/form/container.vue`，供生成代码时直接参照，**无需**在运行期读取目标项目源码。
> 前提：目标项目与本文档同源，使用同一套工作流运行时（契约一致）。若未来某项目框架升级出现差异，以该项目实际文件为准。

## 1. 核心函数 `wfCompositionExapnd`

路径：`@/modules/workflow/expand/mp-wf-plus.js`

```js
const { formStatus, formDisabled, controlMap, form_pp,
        workflowRuntimeSession, workflowRuntimeContext, pageOptions,
        wfStatus, staticSeal, ...methods } = wfCompositionExapnd(
  {
    onWorkflowRuntimeContextAware,
    loadData,
    setReadOnly,
    validData,
    getData,
    submitData,
  },
  // 可选第二参数：自动请求接口（detail/save/update 三选一或多）
  { detail: '/gateway/xxx/detail', save: '/gateway/xxx/save', update: '/gateway/xxx/update' }
);
```

### 传入的 6 个业务钩子（methodList）

| 钩子 | 作用 | 必调 callback |
|---|---|---|
| `onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext, pageOptions })` | 运行时上下文感知，最先执行，在 loadData 之前。可在此过滤操作按钮 | 否 |
| `loadData(business_no, data, form_pp_data, formStatus_data, formControls)` | 加载业务数据。`formControls[0].controls` 提供字段权限 | 否 |
| `setReadOnly()` | 查看/只读态。框架已把 `formDisabled`/`wfStatus.readonly` 置为真，一般无需处理 | 否 |
| `validData(callback, action)` | 提交前校验 | **是** `callback({ isValid: boolean })` |
| `getData(callback, action)` | 获取要提交的业务数据 | **是** `callback(data)` |
| `submitData({ param }, callback, request)` | 执行提交（审批/驳回/作废等） | **是** `callback({ success, hasCalledMpApi, message })` |

### 解构出的响应式状态（模板中自动解包）

| 状态 | 含义 |
|---|---|
| `formStatus` | 表单状态 `'0'`=新增 `'1'`=修改 |
| `formDisabled` | 是否禁用表单 |
| `controlMap` | 字段权限 map：`c.key -> c.control`，`'0'`=隐藏 `'1'`=只读 `'2'`=可编辑（框架 loadData 时自动填充） |
| `form_pp` | 工作流扩展属性 |
| `workflowRuntimeSession` | 工作流运行时会话 |
| `workflowRuntimeContext` | 工作流运行时上下文（含 `wfInfo`、`wfInfo.processstatus` 等） |
| `pageOptions` | 页面 URL 参数 |
| `wfStatus` | `{ isApproval, readonly, launchAdd, launchEdit, launchAgain }` |
| `staticSeal` | 框架内部密封状态（一般无需直接用） |
| `methods` | 框架对外方法（见下），**defineExpose 展开它，不是业务钩子** |

### `...methods`（对外暴露的方法）

`onWorkflowRuntimeContextAware(workflowRuntimeSession)`、`loadData(business_no, businessData={}, form_pp, formStatus, formControls=[])`、`setReadOnly()`、`getData(callback)`、`validData(callback, action)`、`submitData(sub_Json, callback, request)`、`getWfid(param)`。

container 通过 `this.$refs[formName + "Ref"]` 调用这些方法，因此页面 `defineExpose` 至少暴露 `...methods`。

## 2. 自动请求与手动请求

- **不传第二参数**：框架 `loadData` 不会自动调详情，会把 `data` 置为 `null` 回调业务 `loadData`；页面在自己的 `loadData` 里手动调详情接口（推荐，GTM 系页面即如此）。
- **传第二参数 `{ detail }`**：框架在 `business_no` 存在且配置了 detail 时先自动请求，返回 `result === '1'` 再回调业务 `loadData(business_no, data.rows, ...)`；页面仍需实现 `loadData` 渲染 `data`。
- save/update 同理，供**不自定义 submitData** 的极简表单使用；`update` 未配时回落到 `save`。

## 3. 生命周期

```
加载：onWorkflowRuntimeContextAware → loadData → setReadOnly
提交：validData → getData → submitData
```

- `onWorkflowRuntimeContextAware` 内部按流程状态置 `wfStatus.launchAdd / launchEdit / launchAgain`，并发起态把 `isApproval` 置 false。
- 框架 `validData` 对 `ACTION_TYPE == 7`（作废）跳过业务校验直接 `{ isValid: true }`。

## 4. actionType 对照表

| 值 | 含义 | 值 | 含义 |
|---|---|---|---|
| 0 | 发起 | 6 | 驳回 |
| 1 | 审批 | 7 | 作废 |
| 2 | 重新发起 | 13 | 起草 |
| 5 | 会签 | 14 | 暂存 |
| 8 | 转审 | 18 | 撤回 |

## 5. submitData 的 param 组装（了解即可）

框架按 `sub_Json.actiontype` 组装 `param` 再回调业务 `submitData({ param }, callback, request)`：

- `0/13/14`：`param.businessNo=''`，组装 `wfcLaunchParam`
- `1/5/2/7/18`：组装 `wfcApproveParam`
- `8`（转审）：组装 `wfcApproveParam`，`nextSteps: [{ auditor: sub_Json.revolution }]`
- `6`（驳回）：组装 `wfcRejectParam`，含 `businessNo`、`businessData`、`nextSteps`（由 `back_auditorsId` 拆分）
- 附件由 `sub_Json.attch` 转成 `attachParam` 挂到 approve/reject 参数

**驳回时注入流程主题**是常见需求：`submitData` 里在调用接口前改写

```js
if (param?.wfcRejectParam?.businessData) {
  param.wfcRejectParam.businessData.carInfo = 流程主题文案;
}
```

## 6. container.vue 注册（3 处）

目标文件：`src/modules/workflow/form/container.vue`（运行期需读取目标项目该文件，因每个项目已注册表单列表不同）。

1. **import**：`import {formName} from "@/modules/{ModuleName}/workflow/{formName}/index.vue";`
2. **components**：加入 components 对象。
3. **模板**：加条件渲染（放在兜底 `<view v-else>` 之前）：

```vue
<{formName}
  v-else-if="formName === '{formName}'"
  ref="{formName}Ref"
  :getActionButtons="getActionButtons"
  :updateActionButtons="updateActionButtons"
/>
```

- `ref` 必须为 `formName + "Ref"`（container 动态解析 `this.$refs[this.formName + "Ref"]`）。
- `:getActionButtons` / `:updateActionButtons` 仅当页面需要过滤按钮时传。
- 页面如额外需要 container 透传事件（如 `@scrollTop`），按目标项目既有同类注册照抄。

## 7. 常用范式

### 7.1 过滤操作按钮（onWorkflowRuntimeContextAware）

```js
const props = defineProps({
  getActionButtons: { type: Function, default: () => {} },
  updateActionButtons: { type: Function, default: () => {} },
});
const onWorkflowRuntimeContextAware = ({ openType, workflowRuntimeContext, pageOptions }) => {
  const currentButtons = props.getActionButtons() || [];
  const filtered = currentButtons.filter((btn) => {
    if (btn.ACTION_TYPE + "" === "2") return false;          // 过滤「重新发起」
    if (btn.LAN_KEY === "btn_action_reset") return false;     // 兼容 LAN_KEY 过滤
    return true;
  });
  props.updateActionButtons(filtered);
};
```

### 7.2 字段权限（controlMap）

`formControls[0].controls` 已由框架写入 `controlMap`（状态），UI 上通常再做一层过滤：

```js
const fieldOptions = [{ label: "xxx", valueKey: "fieldA" }, ...];
const filteredOptions = computed(() =>
  fieldOptions.filter((opt) => controlMap[opt.valueKey] !== "0")
); // '0' 隐藏
```

注意：若页面自建了同名 `controlMap`（业务字段权限），解构框架 `controlMap` 时重命名，如 `controlMap: wfControlMap`。

### 7.3 覆盖 loadData 动态设置导航标题

标题依赖加载后数据时，对 wf 的 `loadData` 再包一层再 expose：

```js
const loadDataWithTitle = async (...args) => {
  await loadData(...args);
  const title = getNavTitle() || "默认标题";
  const pages = getCurrentPages();
  const page = pages[pages.length - 1];
  const internal = page?.$vm?.$;
  if (internal?.setupState) internal.setupState.navFormTitle = title;
};
defineExpose({ ...methods, getNavTitle, loadData: loadDataWithTitle });
```

## 8. 检查清单

1. formName 与后端一致（含大小写）
2. 6 个钩子实现并传入 `wfCompositionExapnd`
3. `defineExpose({ ...methods, getNavTitle })`（expose 的是 methods）
4. container `ref === formName + "Ref"`
5. container import 指向 `@/modules/{ModuleName}/workflow/{formName}/index.vue`
6. `validData / getData / submitData` 都调用 callback
7. submitData 覆盖需要的 actionType 分支与驳回主题注入
8. API 网关前缀正确（`/gateway/mainapp`、`/gateway/channel`、`/gateway/aftersale`、`/gateway/otd`、`/gateway/clue` 等按目标项目）
9. 需要按钮过滤的页面在 `onWorkflowRuntimeContextAware` 调用了 `getActionButtons/updateActionButtons`
