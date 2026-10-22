# ly-skills

个人技能集，**私有项目：仅限作者本人及获得授权的人使用，未经授权不得使用、复制或分发**（见 [LICENSE](LICENSE)）。通过 **Plugin Marketplace** 方式分发（一个仓库同时充当 marketplace 和插件本体）。技能本体采用跨工具通用的 Agent Skills（SKILL.md）格式，可在 Claude Code、Codex、Cursor 等支持 Agent Skills 的工具中使用，见[安装](#安装)。

## 包含的插件


| 插件                            | 说明                                                     |
| ----------------------------- | ------------------------------------------------------ |
| `ly-branch-merge-check`       | 分析两个分支间公共组代码差异，生成 cherry-pick 命令，用于同步公共组代码             |
| `ly-tb-commit-summary`        | 根据 commit ID 输出修复方案 / 业务影响分析 / 转测试建议                   |
| `ly-app-create-workflow-form` | 生成新的工作流审批详情页面代码（单文件直集成模式）：业务 workflow 页面和 container 注册 |
| `ly-pc-create-workflow-form`  | 生成 PC 端工作流审批表单骨架：配置入口 index.js 与 Options API 表单组件      |
| `ly-code-confirm`             | 根据组件/文件路径列表查询 git history，生成《代码确认管控》Excel 表格           |


## 安装

> **每个 Agent 只选一种方式。** 插件方式（Claude Code / Codex）自动更新；`npx skills` 方式安装的是可编辑副本，需要手动更新。两种方式同时装会让每个技能出现两次。


| 工具                                        | 安装方式                       | 更新    |
| ----------------------------------------- | -------------------------- | ----- |
| Claude Code                               | `/plugin marketplace`      | 自动    |
| Codex                                     | `codex plugin marketplace` | 启动时自动 |
| Cursor / Windsurf / OpenCode / Amp / Pi 等 | `npx skills`               | 手动    |
| DeepSeek Harness（DSH）                     | 手工复制 / Junction            | 手动    |

> 仓库托管在两个位置：GitHub [`y2kloong/ly-skills`](https://github.com/y2kloong/ly-skills)（支持 `owner/repo` 简写）和 Gitee [`https://gitee.com/y2kloong/ly-skills.git`](https://gitee.com/y2kloong/ly-skills)（必须写完整 URL）。两个仓库均为私有仓库，仅授权成员可访问。**Gitee 为主仓，GitHub 为镜像**，内容一致；GitHub 侧需等镜像同步完成后才会有最新提交，访问不了 GitHub 时统一换成 Gitee 完整 URL 即可。


### Claude Code

在 Claude Code 会话中执行：

```
/plugin marketplace add y2kloong/ly-skills
/plugin install ly-branch-merge-check@ly-skills
/plugin install ly-tb-commit-summary@ly-skills
/plugin install ly-app-create-workflow-form@ly-skills
/plugin install ly-pc-create-workflow-form@ly-skills
/plugin install ly-code-confirm@ly-skills
```

> 无法访问 GitHub 时，把第一行换成 `/plugin marketplace add https://gitee.com/y2kloong/ly-skills.git`。

更新（作者发布新版本后）：

```
/plugin update
```

### Codex

Codex 同样支持 Plugin Marketplace，并能识别本仓库的 `.claude-plugin/` 清单：

```bash
codex plugin marketplace add y2kloong/ly-skills
codex plugin add ly-branch-merge-check@ly-skills
codex plugin add ly-tb-commit-summary@ly-skills
codex plugin add ly-app-create-workflow-form@ly-skills
codex plugin add ly-pc-create-workflow-form@ly-skills
codex plugin add ly-code-confirm@ly-skills
```

> 无法访问 GitHub 时，把第一行换成 `codex plugin marketplace add https://gitee.com/y2kloong/ly-skills.git`。

Codex 启动时自动更新插件。装完确认五个技能出现在 Codex 的技能列表中；若本机 Codex 版本不支持上述命令，改用下面的 npx 方式或手工复制。

### 其他 Agent（Cursor / Windsurf / OpenCode / Amp / Pi 等）

借助社区 CLI [skills](https://github.com/vercel-labs/skills)（npm 包名 `skills`）安装，无需先克隆仓库：

```bash
# 装到个人全局（推荐）
npx -y skills@latest add y2kloong/ly-skills -g -a cursor --skill '*' --copy

# 只装到当前项目
npx -y skills@latest add y2kloong/ly-skills -a cursor --skill '*' --copy

# 无法访问 GitHub 时，用 Gitee 完整 URL 替代 y2kloong/ly-skills
npx -y skills@latest add https://gitee.com/y2kloong/ly-skills.git -g -a cursor --skill '*' --copy
```

- `-a <agent>`：目标 Agent，如 `cursor`、`windsurf`、`opencode`、`amp`、`pi`；省略则交互选择。`--all` 可一次装到本机所有已检测到的 Agent。
- `--skill '*'`：安装全部五个技能；也可写 `--skill ly-code-confirm` 只装一个。
- `--copy`：复制文件而非建符号链接，便于按需修改技能内容；不加则链接到 CLI 的缓存目录。
- 运行要求：Node.js ≥ 22.20，且本机可用 `git`。
- 源地址支持 GitHub 简写 `owner/repo`；Gitee 地址必须写完整 URL，简写会被解析成 GitHub。

查看和更新：

```bash
npx skills@latest list
npx skills@latest update
```

> 该 CLI 中 `codex` 目标映射到 `~/.agents/skills`（通用目录），与本仓库早期的 `~/.codex/skills` 口径不同。装完可 `ls ~/.codex/skills` 确认，若 Codex 没有加载，改用上方 Codex 插件方式或手工复制。

### DeepSeek Harness（DSH）

DSH 暂不在 `skills` CLI 的内置 Agent 列表中，需手工放置技能目录：复制到 `~/.dsh/skills/`（DSH_HOME 下的 skills 目录），新会话启动后自动加载。

```powershell
git clone https://gitee.com/y2kloong/ly-skills.git
cd ly-skills
New-Item -ItemType Directory -Force "$HOME\.dsh\skills"
Copy-Item -Recurse .\plugins\*\skills\* "$HOME\.dsh\skills\"
```

> 推荐使用符号链接（Junction）代替复制，仓库更新后无需手动同步：
> `New-Item -ItemType Junction -Path "$HOME\.dsh\skills\<技能名>" -Target <仓库路径>\plugins\<插件名>\skills\<技能名>`

更新：`git pull` 拉取最新内容后重新执行复制（符号链接方式则自动跟随）。

### 手工复制（任意 Agent / 离线环境）

仓库内技能文件位于 `plugins/<插件名>/skills/<技能名>/`。以 Codex 为例，复制到 `~/.codex/skills/`（个人全局）或项目目录 `.codex/skills/`（仅该项目），重启后自动加载：

```powershell
git clone https://gitee.com/y2kloong/ly-skills.git
cd ly-skills
New-Item -ItemType Directory -Force "$HOME\.codex\skills"
Copy-Item -Recurse .\plugins\*\skills\* "$HOME\.codex\skills\"
```

其他 Agent 把目标目录换成各自的 skills 目录即可（如 Cursor 的 `~/.cursor/skills/`）。

### 跨工具兼容性说明

五个技能均以 `disable-model-invocation: true` 声明为「仅手动调用」，该字段是
**Claude Code 专属**的 frontmatter 配置。Codex / DSH / Cursor 等工具不识别它，技能描述中
也不含「禁止自动触发」的文字提示，因此在这些工具下技能可能被模型自动触发。
若需要严格的手动控制，建议只安装当前确实要用的技能，而不是一次全量安装。

## 技能使用方式

五个技能均为**仅手动调用**（Claude Code 下通过 `disable-model-invocation: true` 关闭自动触发），需显式输入 `/技能名`：

- `/ly-branch-merge-check <分支名>` — 分析公共组代码差异并生成 cherry-pick 命令
- `/ly-tb-commit-summary <commit-id>` — 分析提交并输出三部分总结（支持多个 commit ID）
- `/ly-app-create-workflow-form <需求描述>` — 生成新的工作流审批详情页面（业务 workflow 页面 + container 注册）
- `/ly-pc-create-workflow-form <formKey 等>` — 生成 PC 端工作流审批表单骨架（配置入口 + Options API 组件）
- `/ly-code-confirm <路径列表>` — 查询 git history 生成《代码确认管控》Excel 表格

## 仓库结构

```
ly-skills/
├── .claude-plugin/
│   └── marketplace.json          # 市场清单（插件 source 指向本仓库）
├── plugins/                      # 插件本体
│   ├── <plugin-name>/
│   │   ├── .claude-plugin/
│   │   │   └── plugin.json       # 插件声明（main.skills 指向技能目录）
│   │   └── skills/
│   │       └── <skill-name>/
│   │           └── SKILL.md      # 技能本体（Agent Skills 标准格式）
├── LICENSE                       # 专有许可（保留所有权利）
├── README.md
└── .gitignore
```

## License

Proprietary — All rights reserved. 完整条款见 [LICENSE](LICENSE)。

本仓库为私有项目。未经作者事先书面授权，不得使用、复制、修改、合并、发布、分发、再许可或销售本仓库的任何部分，也不得基于其创建衍生作品；获得授权的使用者仅可在自己的内部工作中使用，不得转交给任何未获授权的第三方。需要授权请联系作者。