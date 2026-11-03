# pstack 的 Codex 适配

本仓库是 [`cursor/plugins`](https://github.com/cursor/plugins) 的真实 GitHub fork。Codex 首版插件名为 **pstack-codex**，版本 **0.1.0**，基于 pstack **0.15.36**、上游提交 [`ae5650f`](https://github.com/cursor/plugins/commit/ae5650febf4320793844c12c4adaa937f417f8da)。原作者为 Lauren Tan，许可为 MIT。

## 已实现的适配

首版包含 11 个技能：`poteto-mode`、`setup-pstack`、`how`、`architect`、`tdd`、`benchmark-checklist`、`create-verification-skill`、`maintain-verification-skill`、`create-formal-verification-skill`、`maintain-formal-verification-skill`、`statechart`。

- 使用可移植根目录 `plugin.json` 和 `skills/`，提供 Codex repository marketplace。
- 将上游显式调用策略转换为 `agents/openai.yaml` 的 `policy.allow_implicit_invocation`，清除 Cursor 专属 frontmatter。
- 按当前会话的真实工具 schema 调度；不会传入 Cursor `Task` 的专属参数，也不会用新建用户任务代替子代理。
- 模型和思考深度默认继承会话；用户指定时使用实际支持的 ID，不静默替换模型。支持 Astra 负责核心设计、Sol 负责执行的分工，但该角色名本身不会切换模型。
- 改写核心流程，按用户实际授权进行只读调研、设计、实现或交付。技能不会自行产生推送、部署、发信或持续自动化权限。
- 生成的项目技能使用 `.agents/skills/`。statechart 使用显式准备的 `JAVA` 和 `TLA2TOOLS`，移除隐式安装；默认可交付 Mermaid 文本。

暂未适配上游 Cursor 自动化、云代理、会话历史召回和自动合并流程，也没有注册全部上游技能。原始 `pstack/` 与既有 `harness/pstack/` 继续保留；Codex 输出独立且自包含。

## 安装和调用

安装属于独立操作。下面的命令供需要启用时执行；构建与测试不会修改个人 Codex 配置或启用插件。

```sh
codex plugin marketplace add JackLee992/pstack-codex --ref codex/pstack-adaptation
codex plugin list --marketplace pstack-codex --available --json
```

随后在支持本地 marketplace 的 Codex 客户端插件目录中选择 **pstack for Codex** 并安装。不同客户端的入口和能力可能不同；以实际技能目录显示的名称为准。无需将整个上游 monorepo 复制进个人技能目录。

运行 `setup-pstack` 可检查当前工具和角色选择。普通技能不要求先写全局规则文件。除 `setup-pstack` 外，首版遵从上游的显式调用策略；按需调用，避免把整套工程流程加入每个简单任务。

详细能力与授权规则见[运行合同](adapters/codex/plugin/docs/codex.md)，打包规范依据 [OpenAI 官方文档](https://developers.openai.com/plugins/build/plugins)。

## 开发与验证

```text
pstack/                       固定上游源码
adapters/codex/config.json     包信息、技能 allowlist、上游 pin
adapters/codex/upstream-files.json  原始输入 SHA-256 锁
adapters/codex/plugin/         Codex 覆盖文件
scripts/generate-pstack-codex.mjs   确定性生成器
harness/pstack-codex/          自包含分发包
.agents/plugins/marketplace.json  仓库 marketplace
tests/pstack-codex/            隔离生成与漂移验证
```

在仓库根目录运行：

```sh
node scripts/generate-pstack-codex.mjs
node scripts/generate-pstack-codex.mjs --check
node --test tests/pstack-codex/*.test.mjs
```

本地验证结果及边界见[首版验证记录](docs/pstack-codex/validation-20261103.md)。通用异步 owner 样例和可复现的状态机冒烟命令见[样例说明](examples/pstack-codex/async-owner/README.md)。

源文件和生成结果均记录摘要；输入 pin 或资源变化需要显式核对。检查会发现缺失、额外、内容或可执行位漂移。任何改动都应在生成后检查，不能只手改 `harness/pstack-codex/`。

状态机工具的实际运行另需已准备的 Java/TLC，命令及精确版本见[分发包说明](harness/pstack-codex/README.md)。工具缺失测试、真实模型运行和客户端插件发现属于不同证据；不会将其中一项当成全部验收。

## 上游同步

`upstream` remote 指向 `https://github.com/cursor/plugins.git`。更新前先 fetch 并阅读 pstack 的变更；确认 MIT、元数据、脚本依赖和 Codex 覆盖仍然适用后，再更新 pin、输入摘要锁及必要生成器守卫，重新生成和验证。不要运行上游更新时附带的脚本来代替代码审阅。

升级时保留上游来源、原作者版权和 MIT 原文。不要将业务项目源码、授权配置、token、录音录像或私人调试日志放进此公开 fork。
