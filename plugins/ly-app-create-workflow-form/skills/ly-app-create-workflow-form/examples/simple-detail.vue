<!--
  泛化示例：只读审批详情 + 字段权限 + 过滤「重新发起」按钮。
  由 GTMModule CarSeriesAddApproval 泛化而来，已去掉仓库专属依赖，可整体照抄到任意
  采用 src/modules/workflow 框架的目标项目，仅需替换下列占位：
    - xxxDetail / xxxSubmit  → 目标模块真实 API
    - {ModuleName}          → 目标业务模块
    - 模板里的 <view class="info">… 展示结构 → 换成目标模块自有的展示组件/Card
-->
<template>
  <view class="page">
    <!-- 实际页面建议复用目标模块 components 下已有的卡片/展示组件；此处用原生 view/text 便于移植 -->
    <view class="card" v-for="opt in filteredOptions" :key="opt.valueKey">
      <text class="label">{{ opt.label }}</text>
      <text class="value">{{ format(opt, formData[opt.valueKey]) }}</text>
    </view>
  </view>
</template>

<script setup>
import { reactive, computed } from "vue";
import { wfCompositionExapnd } from "@/modules/workflow/expand/mp-wf-plus.js";
// TODO 换成目标模块真实 API，api 目录名按目标模块约定（不一定等于 formName）
import { xxxDetail, xxxSubmit } from "@/modules/{ModuleName}/api/xxx/index.js";

// 仅当页面需要过滤/操作按钮时保留；不需要时连 props 一起去掉
const props = defineProps({
  getActionButtons: { type: Function, default: () => {} },
  updateActionButtons: { type: Function, default: () => {} },
});

// 业务表单数据
const formData = reactive({});
// 字段权限 map：c.key -> c.control（'0' 隐藏 '1' 只读 '2' 可编辑）
const controlMap = reactive({});

// 字段展示配置（formatter 可选：做枚举/格式化）
const fieldOptions = [
  { label: "字段 A", valueKey: "fieldA" },
  { label: "字段 B", valueKey: "fieldB", formatter: (v) => (v === 1 || v === "1" ? "是" : "否") },
];

// 字段可见性过滤：controlMap[key] === '0' 不展示
const filteredOptions = computed(() =>
  fieldOptions.filter((opt) => controlMap[opt.valueKey] !== "0")
);
const format = (opt, v) => (opt.formatter ? opt.formatter(v) : v);

/** ************************ 工作流运行时钩子 start  *************************/
/** 1. 上下文感知（最先执行）。示例：过滤「重新发起」按钮 ACTION_TYPE='2' */
const onWorkflowRuntimeContextAware = ({
  openType,
  workflowRuntimeContext,
  pageOptions,
}) => {
  const currentButtons = props.getActionButtons() || [];
  props.updateActionButtons(
    currentButtons.filter((btn) => btn.ACTION_TYPE + "" !== "2")
  );
};

/** 2. 加载业务数据（手动调详情接口；也可传 wfCompositionExapnd 第二参数自动请求） */
const loadData = async (
  business_no,
  data = "[]",
  form_pp_data,
  formStatus_data,
  formControls = [],
) => {
  if (!business_no) return;
  try {
    const res = await xxxDetail({ param: { businessNo: business_no } });
    if (res?.rows?.[0]) {
      const row = res.rows[0];
      Object.keys(formData).forEach((k) => {
        if (row[k] !== undefined) formData[k] = row[k];
      });
    }
    // 字段权限框架已写入 controlMap；若需要本地再加工可在此读 formControls
  } catch (ex) {
    uni.showToast({ title: "加载数据错误！", icon: "none" });
  }
};

/** 3. 查看/只读态 */
const setReadOnly = () => {
  // 控件只读由 formDisabled / controlMap 控制，一般无需额外处理
};

/** 4. 校验（callback 必须执行） */
const validData = (callback, action) => {
  callback({ isValid: true });
};

/** 5. 获取提交数据（callback 必须执行） */
const getData = (callback, action) => {
  callback?.({});
};

/** 6. 提交（callback 必须执行）。驳回时可在此注入流程主题 businessData.carInfo */
const submitData = async ({ param }, callback, request) => {
  try {
    const res = await xxxSubmit({ param: { ...param } });
    const errMsg = res?.msg || res?.message || "操作失败";
    const ok = res.result === "1";
    if (!ok) uni.showToast({ title: errMsg, icon: "none" });
    callback({
      success: ok,
      hasCalledMpApi: true,
      message: ok ? "操作成功" : errMsg,
    });
  } catch (error) {
    uni.showToast({ title: error?.msg || "提交数据失败", icon: "none" });
    callback({ success: false, hasCalledMpApi: true, message: "操作失败" });
  }
};
/** ************************ 工作流运行时钩子 end  *************************/

// 导航栏标题
const getNavTitle = () => "示例审批详情";

// 解构工作流状态 + 对外方法（用不到的项可省略；若页面已有同名 controlMap 需重命名）
const {
  formStatus,
  formDisabled,
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
.card {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 20rpx;
}
.label {
  width: 200rpx;
  color: var(--text-secondary, #666);
}
.value {
  flex: 1;
}
</style>
