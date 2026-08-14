---
name: branch-merge-check
description: >
  仅通过 /branch-merge-check 指令手动调用。
  分析两个分支之间的公共组代码差异，生成 cherry-pick 命令。
  用于从其他版本分支（如 dev_gtm_0715、dev_gtm_0725）同步公共组代码到当前分支的场景。
  DO NOT auto-trigger on any user message content — only invoke when user explicitly types /branch-merge-check.
---

# 分支合并检查 - 公共组代码同步

## 背景

本项目是低代码平台开发的项目。低代码平台上的代码存储在平台数据库中，不同版本分支的
feat/fix 代码需要手动在平台上同步。因此不能直接使用 `git merge` 来合并分支代码——
merge 会产生大量冲突，且低代码平台上的改动不在 git 中体现。

此外，项目代码中存在**公共组**（框架/平台组）维护的代码和**业务组**自行开发的代码。
业务组成员（胡柳浩、钟伟亮、刘湖水）的代码由各自手动同步，不需要通过此工具处理。
此技能专注于找出**公共组提供的代码 commit**，这些是需要从目标分支同步过来的。

## 排除的作者（业务组成员）

以下作者的 commit 会被自动过滤，**不**包含在输出中：

| 作者名 | 邮箱 |
|--------|------|
| 胡柳浩 | `lyhuliuhao@szlanyou.com`, `lyhuliuhao@szlianyou.com` |
| 钟伟亮 | `lyzhongweiliang@szlanyou.com` |
| 刘湖水 | `liuhshui@szlanyou.com` |

> 过滤基于邮箱进行匹配，覆盖上述作者的所有名称变体（如"胡柳浩(联友科技)"等）。

## 工作流程

### 第一步：确定参数

从用户输入中提取目标分支名称。支持以下格式：
- 完整分支名：`dev_gtm_0715`
- 远程分支名：`origin/dev_gtm_0715`
- 简短描述：如"715分支"→ 映射到 `dev_gtm_0715`

如果用户没有明确指定目标分支，**必须询问用户**要对比哪个分支。

自动获取当前分支作为基准分支。

### 第二步：获取最新状态

执行 `git fetch origin` 确保远程分支信息是最新的。

### 第三步：确定时间范围（分支分叉点）

当前分支是从目标分支某个时间点创建出来的（如 725 基于 715 创建），分叉点之前的
commit 当前分支必然已经包含，不需要再检查。只需检查分叉点**之后**目标分支上新增的 commit。

使用 `git merge-base` 找到两个分支的共同祖先（即分叉点）：

```bash
git merge-base <当前分支> origin/<目标分支>
```

获取分叉点的提交日期：
```bash
git log -1 --format='%ai' <merge-base-hash>
```

### 第四步：查找差异 commit

使用以下命令找出目标分支在**分叉点之后**新增的、当前分支没有的 commit（排除 merge commit）：

```bash
git log <当前分支>..origin/<目标分支> --format='%H|%an|%ae|%s' --no-merges --after="<分叉点日期>"
```

`<当前分支>..origin/<目标分支>` 确保只查目标分支有而当前分支没有的 commit，
`--after` 进一步限定在分叉点之后，排除分支创建前的老 commit。

如果目标分支在本地已存在且是最新的，也可以使用本地分支名：
```bash
git log <当前分支>..<目标分支> --format='%H|%an|%ae|%s' --no-merges --after="<分叉点日期>"
```

### 第五步：检测已 cherry-pick 的 commit（去重）

由于低代码平台的工作流中经常手动 cherry-pick，同一个改动可能在两个分支上有不同的 hash。
使用 `git cherry` 检测目标分支上的 commit 是否已经被 cherry-pick 到当前分支：

```bash
git cherry <当前分支> origin/<目标分支>
```

输出格式：
- `+ <hash> <message>` → 该 commit 的改动**尚未**应用到当前分支，需要同步
- `- <hash> <message>` → 该 commit 的改动**已经**存在于当前分支（hash 不同但内容相同），无需同步

> `git cherry` 通过比较 patch-id（diff 内容）来判断，而不依赖 commit hash，因此能正确识别
> 手动 cherry-pick 后的等价 commit。

### 第六步：过滤并分组

1. 排除业务组成员（胡柳浩、钟伟亮、刘湖水）的 commit（按邮箱过滤）
2. 结合 `git cherry` 结果，排除标记为 `-`（已应用）的 commit
3. 将剩余**真正需要同步**的公共组 commit 按作者分组
4. 统计每个作者的 commit 数量

### 第七步：输出结果

按以下格式输出分析结果：

```
## 分支差异分析

**当前分支：** dev_gtm_0813
**目标分支：** dev_gtm_0725
**分叉点：** abc1234 (2025-07-01 10:30:00)
**仅检查分叉点之后的 commit**

### Ｘ 已应用的 commit（跳过）

这些 commit 的改动已存在于当前分支（通过 git cherry 检测），无需重复同步：

- `def5678` 刘泽明: feat: #NIPTV-140505#增加人员编码 (已 cherry-pick)
- ...

### 需同步的公共组 commit（N 个）

#### 邓佩云 (2 commits)
- `jkl3456` 2025-07-08 【框架升级】【715】fastForm下拉框选项支持使用插槽自定义
- `mno7890` 2025-07-10 fix: [715][NIPTV-140475] 杀毒云文件选择确认后检验通过

...

---

## Cherry-pick 命令

以下命令可将上述需同步的 commit 逐个应用到当前分支：

```bash
git cherry-pick jkl3456  # 邓佩云: 【框架升级】【715】fastForm下拉框选项支持使用插槽自定义
git cherry-pick mno7890  # 邓佩云: fix: [715][NIPTV-140475] 杀毒云文件选择确认后检验通过
...
```

> ⚠️ 请确认以上 commit 列表是否正确。确认后我将逐个执行 cherry-pick。
```

### 第八步：等待用户确认并选择操作方式

**绝对不要**在用户确认之前执行 cherry-pick。用户可能需要：
- 排除某些不需要的 commit
- 调整 cherry-pick 的顺序
- 先处理其他事情

用户确认后，**必须询问**用户选择执行方式：

> 请选择执行方式：
> 1. **仅 cherry-pick** — 只将 commit 应用到本地，不推送
> 2. **cherry-pick + push** — 应用 commit 后立即推送到远程

使用 `AskUserQuestion` 工具让用户选择。提供两个选项：
- "仅 cherry-pick（不推送）" — 只执行 cherry-pick，不 push
- "cherry-pick + push" — cherry-pick 后执行 `git push`

用户选择后，按 commit 在目标分支上的时间顺序（从旧到新）逐个执行 cherry-pick。

### 第九步：执行 cherry-pick

对每个确认的 commit 执行：
```bash
git cherry-pick <commit-hash>
```

如果遇到冲突：
1. 立即停止
2. 告知用户哪个 commit 产生了冲突
3. 列出冲突文件
4. 提示用户手动解决冲突后执行 `git cherry-pick --continue`
5. 剩余未执行的 cherry-pick 命令保留，等用户解决冲突后继续

### 第十步：推送（如果用户选择了 push）

所有 cherry-pick 成功完成后，如果用户选择了 push：
```bash
git push origin <当前分支>
```

如果推送失败（如远程有更新），告知用户手动处理。

执行完成后，输出 cherry-pick 结果摘要，并注明是否已推送。

## 重要约束

1. **必须等待用户确认**后才能执行 cherry-pick，绝不自动执行
2. **确认后必须询问**用户选择仅 cherry-pick 还是 cherry-pick + push
3. 使用 `--no-merges` 排除 merge commit，它们不适合 cherry-pick
4. 过滤基于邮箱而非作者名，因为同一作者可能有多个名称变体
5. 如果目标分支不存在于远程，先提示用户并询问是否使用本地分支
6. cherry-pick 按时间顺序（旧→新）执行，减少冲突概率
