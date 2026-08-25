# ly-skills

个人 Claude Code 技能集，通过 **Plugin Marketplace** 方式分发（一个仓库同时充当 marketplace 和插件本体）。技能本体采用跨工具通用的 Agent Skills（SKILL.md）格式，也支持 Codex、DeepSeek Harness 等工具手动安装，见[其他工具安装](#其他工具安装codex--deepseek-harness)。

## 包含的插件

| 插件 | 说明 |
|---|---|
| `ly-branch-merge-check` | 分析两个分支间公共组代码差异，生成 cherry-pick 命令，用于同步公共组代码 |
| `ly-tb-commit-summary` | 根据 commit ID 输出修复方案 / 业务影响分析 / 转测试建议 |
| `ly-create-workflow-form` | 生成新的工作流审批详情页面代码：业务页面、工作流适配层和 container 注册 |
| `ly-code-confirm` | 根据组件/文件路径列表查询 git history，生成《代码确认管控》Excel 表格 |

## 安装

### 方式一：远程仓库（推荐给使用者）

在 Claude Code 中执行：

```
/plugin marketplace add https://gitee.com/y2kloong/ly-skills.git
/plugin install ly-branch-merge-check@ly-skills
/plugin install ly-tb-commit-summary@ly-skills
/plugin install ly-create-workflow-form@ly-skills
/plugin install ly-code-confirm@ly-skills
```

更新（作者发布新版本后）：

```
/plugin update
```

### 方式二：本地目录测试（推送到 Gitee 前先自测）

```
/plugin marketplace add D:\path\to\ly-skills
/plugin install ly-branch-merge-check@ly-skills
```

> 本地自测通过后再 push，避免反复改 commit。

## 其他工具安装（Codex / DeepSeek Harness）

Claude Code 之外的工具**不支持 `/plugin marketplace` 命令**，需手动放置技能目录。
仓库内技能文件位于 `plugins/<插件名>/skills/<技能名>/SKILL.md`，对应四个技能：
`ly-branch-merge-check`、`ly-tb-commit-summary`、`ly-create-workflow-form`、`ly-code-confirm`。

### Codex（OpenAI Codex CLI）

将技能目录复制到 `~/.codex/skills/`（个人全局）或项目目录 `.codex/skills/`（仅该项目），重启 Codex 后自动加载。

```powershell
git clone https://gitee.com/y2kloong/ly-skills.git
cd ly-skills
New-Item -ItemType Directory -Force "$HOME\.codex\skills"
Copy-Item -Recurse .\plugins\*\skills\* "$HOME\.codex\skills\"
```

### DeepSeek Harness（DSH）

将技能目录复制到 `~/.dsh/skills/`（DSH_HOME 下的 skills 目录），新会话启动后自动加载。

```powershell
git clone https://gitee.com/y2kloong/ly-skills.git
cd ly-skills
New-Item -ItemType Directory -Force "$HOME\.dsh\skills"
Copy-Item -Recurse .\plugins\*\skills\* "$HOME\.dsh\skills\"
```

> 推荐使用符号链接（Junction）代替复制，仓库更新后无需手动同步：
> `New-Item -ItemType Junction -Path "$HOME\.dsh\skills\<技能名>" -Target <仓库路径>\plugins\<插件名>\skills\<技能名>`

### 更新方式（Codex / DSH）

`git pull` 拉取最新内容后重新执行复制（符号链接方式则自动跟随）。

## 技能使用方式

- `/ly-branch-merge-check <分支名>` — 分析公共组代码差异并生成 cherry-pick 命令
- `/ly-tb-commit-summary <commit-id>` — 分析提交并输出三部分总结（支持多个 commit ID）
- `ly-create-workflow-form` — 生成新的工作流审批详情页面（业务页面 + 适配层 + container 注册）
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
├── README.md
└── .gitignore
```

## License

MIT
