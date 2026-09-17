// 工作流表单配置入口 （必须） 不可删除或重命名
//
// 放置路径：workspace/views/workflow/form/<formKey>/index.js
//   - <formKey> 必须与后端流程节点配置里的 `/vue-workflow-form/<formKey>` 完全一致（含大小写）
//   - <formKey> 只能是「一层」目录名，不要嵌套子目录
//
// 框架按「文件夹名」匹配（import.meta.glob + 字符串精确比较），
// 路径写错或名字不一致时，运行期只会弹一句「请检查该流程表单配置是否正确」，不会给出具体原因。

/**
 * 暴露工作流表单组件
 * 组件本身可以放在任意位置，用相对路径或别名引入即可。
 * 团队约定：配置入口留在 workspace/，业务组件放业务区 src/views/<业务区>/workflow/<FormName>/index.vue
 *
 * TODO: 替换为实际组件路径
 * @returns 异步组件
 */
export const formAsyncComponent = () => import('@/views/VeCenter/views/workflow/<FormName>/index.vue')

/**
 * 暴露表单输入项
 * 1、作为工作流运行时条件判断表单域数据源
 * 2、作为工作流设计时汇总配置表单数据源
 * 3、用来运行时后端服务做节点分流时的条件判断
 *
 * key      唯一识别字段key {String} 请注意：这个字段不能重复
 * value    字段释义 {String}
 * type     字段类型 {String} int: 整型 | float: 浮点 | string: 字符串 | datetime: 日期时间 | time: 时间
 *
 * TODO: 按业务字段填充。本节留空流程也能跑起来，只是设计器里配不出条件分支。
 *       同一批字段必须与下方 formCompList 的 key 一一对齐。
 */
export const formInputList = [
  {
    key: 'applyReason',
    value: '申请原因',
    type: 'string'
  },
  {
    key: 'attachment',
    value: '附件',
    type: 'string'
  }
]

/**
 * 表单组件列表, 做权限，后端只做存储和读取
 *
 * key      唯一识别字段key {String} 请注意：这个字段不能重复
 * value    字段释义 {String}
 * compType 组件类型 'text' | 'input' | 'button' ... 此处只做text特殊处理
 *          ⚠ 字段名是 compType，不是 type。写成 type 不会报错，但字段权限会静默失效。
 *
 * TODO: 与 formInputList 的 key 保持一致
 */
export const formCompList = [
  {
    key: 'applyReason',
    value: '申请原因',
    compType: 'input'
  },
  {
    key: 'attachment',
    value: '附件',
    compType: 'input'
  }
]
