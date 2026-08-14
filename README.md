# ly-skills

个人 Claude Code 技能集，通过 **Plugin Marketplace** 方式分发。一个仓库同时充当 marketplace 和插件本体，安装/更新一条命令搞定。

## 包含的插件

| 插件 | 说明 |
|---|---|
| `branch-merge-check` | 分析两个分支间公共组代码差异，生成 cherry-pick 命令，用于同步公共组代码 |
| `tb-commit-summary` | 根据 commit ID 输出修复方案 / 业务影响分析 / 转测试建议 |
| `create-workflow-form` | 生成新的工作流审批详情页面代码：业务页面、工作流适配层和 container 注册 |

## 安装

### 方式一：远程仓库（推荐给使用者）

在 Claude Code 中执行：

```
/plugin marketplace add https://gitee.com/y2kloong/ly-skills.git
/plugin install branch-merge-check@ly-skills
/plugin install tb-commit-summary@ly-skills
/plugin install create-workflow-form@ly-skills
```

更新（作者发布新版本后）：

```
/plugin update
```

### 方式二：本地目录测试（推送到 Gitee 前先自测）

```
/plugin marketplace add D:\path\to\ly-skills
/plugin install branch-merge-check@ly-skills
```

> 本地自测通过后再 push，避免反复改 commit。

## 技能使用方式

- `/branch-merge-check <分支名>` — 分析公共组代码差异并生成 cherry-pick 命令
- `/tb-commit-summary <commit-id>` — 分析提交并输出三部分总结（支持多个 commit ID）
- `create-workflow-form` — 生成新的工作流审批详情页面（业务页面 + 适配层 + container 注册）

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
