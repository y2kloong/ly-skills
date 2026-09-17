<!--
  * @Description: <业务功能简述> 工作流审批表单（骨架，业务代码待填充）
  *
  * 放置路径：src/views/<业务区>/workflow/<FormName>/index.vue
  *
  * 几个不能动的约定：
  *   1. 必须是 Options API 的 export default {}，不能用 <script setup>。
  *      wfOptionExpand 依赖 this / data() / created()，<script setup> 下它拿不到实例，
  *      6 个钩子不会被包装，流程会一直卡在加载中。
  *   2. 方法名必须与钩子名完全同名（loadData / getData / validData / submitData /
  *      setReadOnly / onWorkflowRuntimeContextAware）。mixin 在 created() 里按同名查找并
  *      备份成 xxxWf，改名成 handleLoadData 之类就永远不会被调用。
  *   3. validData / getData / submitData 三条路径上所有分支都必须调用 callback，
  *      包括 catch 分支。漏调 = 工作流执行被永久中断，页面不报错、看起来只是「卡住」。
-->
<template>
  <pageContainer background="transparent" style="padding-bottom: 0" :showFooter="true">
    <!-- TODO: 最后一段 class 换成业务语义化的 kebab-case 类名，与 <style> 中的根类名一致 -->
    <div class="app-container app-container-table fast-designer-page xxx-apply" v-loading="loading" :element-loading-text="loadingTxt">
      <!-- 只读详情区：展示从工作流回传 / 详情接口拿到的业务数据 -->
      <!-- TODO: 按业务补充 detailConfig 的展示字段 -->
      <CustomDescriptions
        :value="formData0Fields"
        v-for="item in detailConfig"
        :key="item.key"
        :items="item.items"
        :title="item.title"
        column="4"
        style="margin-bottom: 12px"
      />

      <!-- 可编辑区 -->
      <CollapseCard title="申请信息" style="margin-bottom: 12px">
        <!--
          fast-form 是低代码驱动的表单容器，字段配置写在 data.formData0 里，
          字段值写在 data.formData0Fields 里，两者靠 codeField 关联。
          字段权限（controlMap）作用方式是改 formData0 里对应项的 disabled。

          若目标项目没有 fastDesigner 套件，把这块换成 el-form + 手写字段即可，
          工作流钩子部分不受影响。
        -->
        <fast-form
          ref="layoutForm_0000000000001"
          form-ref="layoutForm_0000000000001"
          :is-show-config-btn="false"
          :un-trigger-chage="true"
          :dynamic-fields-data="formData0Fields"
          :dynamic-form-fields="formData0"
          :form-ref-index="0"
          :page-areas="formComGroup[0]"
          :groupTitleCollapse="true"
        />
      </CollapseCard>

      <FullscreenLoading ref="fullscreenLoading" />
      <!-- 工作流模式下由框架提供底部操作按钮，这里只留返回/取消 -->
      <WorkflowExtraBtn :back="true">取消</WorkflowExtraBtn>
    </div>
  </pageContainer>
</template>

<script>
import { defineAsyncComponent } from 'vue'
import { fastMixins } from '@/components/fastDesigner/export'
import { wfOptionExpand } from '@workspace/views/workflow/expand/mp-wf-plus.js'
import WorkflowExtraBtn from '@/views/VeCenter/components/WorkflowExtraBtn/index.vue'
import FullscreenLoading from '@/views/VeCenter/components/FullscreenLoading/index.vue'

// TODO: 引入本表单用到的接口（详情 / 保存 / 提交）
// import { xxxDetail, xxxSubmit } from '@/views/VeCenter/api/xxx/index.ts'

export default {
  // name 必须设置且稳定唯一：若 data() 用 this.getAndSetData 包裹，
  // 它依赖 $options.name 推导 viewPageCode 去合并低代码页面配置，缺失会拿到 undefined。
  // 多数页面直接写 <FormName>，也有的用语义名（如 checkTaskAuditDialog），不必强求一致。
  name: '<FormName>',
  components: {
    pageContainer: defineAsyncComponent(() => import('@/views/VeCenter/components/pageContainter/index.vue')),
    CustomDescriptions: defineAsyncComponent(() => import('@/views/VeCenter/components/descriptions/inex.vue')),
    CollapseCard: defineAsyncComponent(() => import('@/views/VeCenter/components/CollapseCard/index.vue')),
    WorkflowExtraBtn,
    FullscreenLoading
  },
  // wfOptionExpand 必须放在最后：它在 created() 里接管同名钩子。
  // 参数 detail / save / update 是可选的自动请求配置，不知道接口路径就传 {}，
  // 在 loadData 里手动请求即可 —— 不要为了填参数编造接口路径。
  mixins: [fastMixins.pageViewMixins, fastMixins.getThisMixins, wfOptionExpand({})],
  data() {
    return this.getAndSetData(this, {
      loading: false,
      loadingTxt: '加载中...',
      // ========== 工作流框架注入的状态（formStatus / formDisabled / controlMap /
      //            form_pp / wfStatus / staticSeal）由 mixin 提供，此处不要重复定义 ==========

      // ========== 业务状态 ==========
      // TODO: 按业务补充
      business_no: '', // 业务表单号，loadData 时赋值
      form_pp_data: '', // 扩展属性，loadData 时赋值
      workflowRuntimeContext: null, // 运行时上下文，供后续业务判断使用

      // 业务数据容器：字段值。key 需与 formInputList / formCompList 对齐
      // TODO: 按业务补充字段
      formData0Fields: {
        applyReason: '',
        attachment: '',
        fileName: '',
        fileTicket: ''
      },

      // 业务表单控件配置：字段定义。靠 codeField 与 formData0Fields 关联
      // TODO: 按业务补充控件
      formData0: [
        {
          type: 'textarea',
          labelName: '申请原因',
          span: 24,
          compKey: 'inputTxt_applyReason',
          codeField: 'applyReason',
          labelWidth: 100,
          maxlength: 200,
          showWordLimit: 200,
          rows: 3,
          placeholder: '请输入',
          rules: [{ required: true, message: '请填写申请原因', trigger: 'blur' }],
          group: '申请信息'
        },
        {
          labelName: '上传附件',
          span: 24,
          compKey: 'fast-upload_attachment',
          type: 'fast-upload',
          codeField: 'attachment',
          textField: 'fileName',
          fileTicket: 'fileTicket',
          labelWidth: 100,
          limit: 10,
          uploadSize: 20,
          multiple: true,
          moduleCode: 've',
          accept: '.png,.jpg,.jpeg,.pdf',
          uploadTips: '单个文件不能超过20M，最多上传10个。',
          deleteConfirmation: this.$deleteConfirmation,
          rules: [{ required: false, message: '请上传附件', trigger: 'change' }],
          group: '申请信息'
        }
      ],
      formRefs: ['layoutForm_0000000000001'],
      formComGroup: [['申请信息']]
    })
  },
  computed: {
    // 只读详情区配置
    // TODO: 按业务补充展示字段
    detailConfig() {
      return [
        {
          title: '申请信息',
          key: 'applyInfo',
          items: [{ label: '申请原因', prop: 'applyReason' }]
        }
      ]
    }
  },
  mounted() {
    // 工作流模式下，数据由 loadData 驱动加载，这里一般不需要额外初始化。
    // 若有与工作流无关的本地初始化，写在这里。
  },
  methods: {
    /** ************************ 工作流运行时钩子 start  *************************/

    /**
     * 工作流运行时上下文感知
     * 在 loadData 之前执行。适合保存上下文、过滤操作按钮。
     *
     * ⚠ 入参是「单个对象」，不是两个位置参数。
     *   框架实际调用：onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext })
     *   （YWStepHandler 还会多传一个 events）
     *   写成 (openType, workflowRuntimeContext) 不会报错，但 openType 会拿到整个对象、
     *   workflowRuntimeContext 是 undefined —— 项目里已有历史页面这么写而静默失效。
     *
     * @param {string} openType - 打开类型 '-1'发起 '0'查看 '1'处理待办
     * @param {object} workflowRuntimeContext - 工作流运行时上下文
     * @param {object} [events] - YWStepHandler 场景下的框架事件（如 onFormDataLoaded）
     */
    onWorkflowRuntimeContextAware({ openType, workflowRuntimeContext }) {
      this.workflowRuntimeContext = workflowRuntimeContext
      // 需要过滤操作按钮时（例如去掉「重新发起」）：
      // const currentButtons = this.getActionButtons?.() || []
      // this.updateActionButtons?.(currentButtons.filter((btn) => btn.ACTION_TYPE + '' !== '2'))
    },

    /**
     * 工作流运行时加载数据钩子
     *
     * ⚠ data 不是 JSON 字符串。mixin 自己请求详情接口，把响应 rows 直接传下来：
     *   - 传了 wfOptionExpand({ detail }) 且接口成功 → data = rows（对象或数组）
     *   - 没有 business_no，或接口失败             → data = null（默认参数挡不住 null）
     *   框架自带 demo/index.vue 里的 JSON.parse(data) 是「非 mixin 路径」的形态，
     *   本组件是 mixin 路径，不要照抄。
     *
     * @param {string} business_no - 业务表单号
     * @param {object|Array|null} data - 详情接口返回的 rows，或 null
     * @param {string} form_pp_data - 存入工作流的扩展属性
     * @param {string} formStatus_data - 表单状态 '0'=新增 '1'=修改
     * @param {Array} formControls - 表单控制配置，形如
     *   [{ formName, formId, platform: '0',
     *      controls: [{ key, value, compType, control: '2'|'1'|'0' }] }]
     *   control: '2' 可编辑 / '1' 可读 / '0' 不可见
     */
    loadData(business_no, data, form_pp_data, formStatus_data, formControls = []) {
      this.business_no = business_no
      this.form_pp_data = form_pp_data
      this.formStatus = formStatus_data

      // ---- 1) 应用字段权限 ----
      // 框架把权限填进 controlMap，但不会自动作用到控件，需要业务侧自己应用
      if (formControls && formControls.length > 0) {
        // 权限配置目前只支持单表单，直接取第一个
        const matchedForm = formControls[0]
        matchedForm?.controls?.forEach((c) => {
          this.controlMap[c.key] = c.control
          // 应用到 fast-form 控件；不可见（'0'）需业务侧自行控制布局
          const formItem = this.formData0.find((f) => f.codeField === c.key)
          if (formItem) formItem.disabled = c.control === '1'
        })
      }

      // ---- 2) 只读态判断 ----
      // 除 formControls 外，实践中还有两个只读来源
      const opentype = this.$route?.query?.opentype
      if (opentype === '0' || form_pp_data === 'disabled' || form_pp_data === 'end') {
        this.formData0.forEach((item) => {
          item.disabled = true
        })
      }

      // ---- 3) 回填数据 ----
      // data 的形态取决于后端：可能是 [{ key, value }] 数组，也可能是字段对象，也可能是 null。
      // 这里统一归一化，避免因为后端返回形态不同而白屏。
      // TODO: 业务代码 —— 字段名映射按实际后端返回调整
      let rows = data
      if (typeof rows === 'string') {
        try {
          rows = JSON.parse(rows)
        } catch (ex) {
          rows = []
        }
      }
      const list = Array.isArray(rows) ? rows : rows ? [rows] : []

      if (list.length > 0) {
        list.forEach((item) => {
          if (item && typeof item === 'object' && 'key' in item) {
            // 形态一：[{ key, value }]
            this.formData0Fields[item.key] = item.value
          } else if (item && typeof item === 'object') {
            // 形态二：直接是字段对象
            Object.keys(this.formData0Fields).forEach((k) => {
              if (k in item) this.formData0Fields[k] = item[k]
            })
          }
        })
      } else if (business_no) {
        // 形态三：没有数据（首次发起 / 未传 detail 接口）→ 用 business_no 自己拉详情
        // this.fetchDetail(business_no)
      }

      // 若 fast-form 需要在数据变化后重建，可刷新 key：
      // this.fastFormKey = Math.floor(Math.random() * 1000)
    },

    /**
     * 工作流运行时查看数据模式钩子
     * 框架已把 formDisabled / wfStatus.readonly 置真，一般只需业务自定义处理
     */
    setReadOnly() {
      this.formDisabled = true
    },

    /**
     * 工作流运行时数据校验钩子
     * @param {Function} callback - 回调函数，必须执行，否则工作流执行会被中断
     * @param {object} action - 当前动作信息
     */
    validData(callback, action) {
      const formRef = this.$refs[this.formRefs[0]]
      if (!formRef) {
        // 无表单实例时直接放行，避免流程卡死
        callback({ isValid: true })
        return
      }
      formRef.validateForm(async (valid) => {
        if (!valid) {
          this.$message.warning('请补全表单信息')
          callback({ isValid: false })
        } else {
          callback({ isValid: true })
        }
      })
    },

    /**
     * 工作流运行时获取业务表单数据钩子
     * @param {Function} callback - 回调函数，必须执行，否则工作流执行会被中断
     * @param {object} action - 当前动作信息
     */
    getData(callback, action) {
      // TODO: 业务代码 —— 按需裁剪要交给工作流的数据
      const params = { ...this.formData0Fields }
      callback(params)
    },

    /**
     * 工作流运行时提交数据钩子
     * @param {object} data - 框架组装的提交数据，结构：
     *   { param: { actionType, wfcLaunchParam, wfcApproveParam, wfcRejectParam, businessNo, applyId, ... } }
     * @param {Function} callback - 回调函数，必须执行，否则工作流执行会被中断
     *   回调语义：
     *     success       业务调用是否成功
     *     hasCalledMpApi 业务（或后端业务接口）是否已处理工作流动作
     *                    false → 框架再替你调一次工作流接口推进流程
     *                    true  → 框架不再调，认为流程动作已由业务方/后端处理完毕
     *     message       提示信息
     * @param {object} request - 请求对象（暂未开放）
     *
     * actionType：0发起 1审批 2重新发起 5会签提交 6驳回 7作废 8转办 9结束
     *             10重设责任人 12查看 13起草 14暂存 18撤回 21抄送
     */
    async submitData(data, callback) {
      try {
        // 待办列表展示的业务字段来自 businessData，必要时在此注入
        // const inject = { custName: this.formData0Fields.custName, orderNo: this.formData0Fields.orderNo }
        // if (data.param.wfcLaunchParam?.businessData)  data.param.wfcLaunchParam.businessData  = inject
        // if (data.param.wfcApproveParam?.businessData) data.param.wfcApproveParam.businessData = inject
        // if (data.param.wfcRejectParam?.businessData)  data.param.wfcRejectParam.businessData  = inject

        const actionType = String(data?.param?.actionType)

        // TODO: 业务代码 —— 按 actionType 分派到不同接口
        if (actionType === '7') {
          // 作废
          // await this.onCancel(data)
        } else if (actionType === '0' || actionType === '2') {
          // 发起 / 重新发起
          // await this.launchApproval(data)
        } else if (actionType === '1' || actionType === '6') {
          // 审批通过 / 驳回
          // await this.onApprove(data)
        }
        // 后端业务接口内部若已调用 handleWFAction 推进流程，这里传 true；
        // 若后端只落业务数据、流程推进交给前端框架，这里传 false。
        callback({
          success: true,
          hasCalledMpApi: true,
          message: '操作成功'
        })
      } catch (error) {
        // 用户主动取消时可以不 callback，避免流程继续执行（这是有意为之，与漏调的「卡死」不同）
        if (error?.message === '用户取消操作') return
        this.$message.error(error?.message || '操作失败')
        callback({
          success: false,
          hasCalledMpApi: false,
          message: error?.message || '操作失败'
        })
      }
    }
    /** ************************ 工作流运行时钩子 end  *************************/
  }
}
</script>

<style scoped lang="scss">
// TODO: 按业务补充样式
</style>
