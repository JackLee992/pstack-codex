# pstack for Codex

这是 pstack 的 Codex 适配包，版本 **0.1.0**。上游为 Lauren Tan 的 `cursor/plugins/pstack` **0.15.36**，固定提交 `ae5650febf4320793844c12c4adaa937f417f8da`，沿用 MIT 许可。

本目录由 `scripts/generate-pstack-codex.mjs` 生成。修改源位于仓库的 `adapters/codex/`，请勿直接修改分发目录。原始 Cursor 插件与既有 Claude 分发目录保留。

## 使用

通过仓库 marketplace 将 `pstack-codex` 加入支持本地插件的 Codex 客户端。安装与启用步骤见[仓库中文说明](https://github.com/JackLee992/pstack-codex/blob/codex/pstack-adaptation/README-CODEX.zh-CN.md)。包中没有 MCP 服务或生命周期 hooks；生成与验证不会替用户安装或启用插件。

安装后，按客户端技能目录实际显示的名称调用。适合的任务示例：

- 用 `how` 解释一个子系统的入口、资源所有权和失败处理。
- 用 `architect` 比较一个接口或异步生命周期的设计。
- 用 `create-verification-skill` 固化真实应用的验证流程。
- 用 `create-formal-verification-skill` 和 `statechart` 检查 ACK、取消、清理与旧回调的交错。
- 用 `benchmark-checklist` 核对测量口径、失败率及实际完成的工作。

## 技能范围

| 工作 | 技能 |
| --- | --- |
| 工程流程与配置 | `poteto-mode`、`setup-pstack` |
| 源码理解与设计 | `how`、`architect` |
| 回归与测量 | `tdd`、`benchmark-checklist` |
| 应用验证与维护 | `create-verification-skill`、`maintain-verification-skill` |
| 形式验证与维护 | `create-formal-verification-skill`、`maintain-formal-verification-skill`、`statechart` |

请先阅读[Codex 运行合同](docs/codex.md)。除上游原本允许正常发现的 `setup-pstack` 外，其余技能保留显式调用策略。模型和思考深度遵从当前会话配置或用户指定；不会把 Cursor 的模型名称直接传给 Codex。

## 状态机工具

生产脚本随包提供。需要能运行 TypeScript 的 Node **22.18–22.x 或 23.6+**、Bun **1.1.5+** 或 Deno **2+**，以及已准备的 Java **11+**、TLC **1.7.4**。

```sh
JAVA=/absolute/path/to/java TLA2TOOLS=/absolute/path/to/tla2tools.jar \
  /absolute/path/to/pstack-codex/skills/statechart/scripts/statechart \
  /absolute/path/to/Model.tla --config /absolute/path/to/Model.cfg \
  --out /absolute/path/to/new-output-directory
```

脚本不会自动执行 `mise install`。TLC JAR 的 SHA-256 应为 `936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88`。依赖缺失时明确报错；Mermaid 文本可直接交付，图片渲染为可选项。

模型检查的结论只覆盖模型、边界和假设。它不能替代真实应用回归、手机采集时序、音画同步、音质或生产服务验收。每条涉及代码的反例需要回放为真实代码测试或复现。
