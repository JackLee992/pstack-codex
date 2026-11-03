# pstack-codex 0.1.0 验证记录

日期：2026-11-03。上游固定为 `cursor/plugins@ae5650febf4320793844c12c4adaa937f417f8da`，pstack 0.15.36。

## 实际运行结果

| 验证项 | 结果与范围 |
| --- | --- |
| 生成包 | 11 个技能，64 个文件；输入、输出和可执行位检查通过 |
| 生成器测试 | 24/24 通过；包括内容/新增/删除/权限漂移、输入锁、固定版本、符号链接与输出保护、资源闭包和显式调用策略 |
| 技能结构校验 | skill-creator 的 `quick_validate.py` 对 11 个分发技能全部通过；校验依赖仅放入临时目录 |
| 分发范围 | 只发布精确 allowlist；原 Cursor 自动发布/合并/清理脚本和 statechart 开发测试语料未进入包 |
| 原始兼容目录 | `pstack/`、`harness/pstack/` 相对固定上游没有改动 |
| TLC 正常模型 | Java 11、TLC 1.7.4、Node 24 实际运行，退出码 0，报告与 Mermaid 图均产生 |
| TLC 故障模型 | 故意关闭 generation 检查，退出码 1，报告包含 `CancelStaysTerminal` 反例 |
| TLC 缺失依赖 | 清除该子进程的 Java/TLC 配置后退出码 2，无模型报告，明确说明未安装依赖 |
| Codex 目录发现 | 使用单次 `-c marketplaces...` 临时配置后，原生 CLI 返回 `pstack-codex@pstack-codex`、版本 0.1.0，`installed=false`、`enabled=false` |

测试与生成命令见[中文使用说明](../../README-CODEX.zh-CN.md)，模型重现命令见[样例](../../examples/pstack-codex/async-owner/README.md)。状态机测试脚本校验 TLC 的 SHA-256，不下载工具、不安装插件。

## 审查与修正

Astra 对实际适配文件做了独立静态审查，覆盖只读调查、仅设计、普通修复不推送、沿用已授权推送、无子代理、指定模型不可用和依赖缺失七种情形。审查发现并修正：

1. 整目录复制会发布未适配的原始自动化脚本，改为文件级 allowlist。
2. 形式验证的故障注入必须在任务拥有的隔离副本进行，保全原工作树及已有修改。
3. 不能用正文中任意合同链接代替明确加载要求，所有技能统一生成先读运行合同的前导。

这些是文件审查与有界工具测试；未宣称已经完成新模型会话的行为评估。

## 使用边界

首次只读执行目录发现时，当前客户端没有自动列出本仓库的 marketplace；通过官方支持的单次配置覆盖后成功解析。因而这里证明的是配置目录和原生解析可用，不是所有客户端都能自动发现。

以上 0.1.0 首版验证时插件没有安装或启用，没有修改个人技能、全局 Codex 配置、模型设置或 hook 信任。该阶段未验证安装后的技能加载。GitHub CI 的结果需以该提交的实际 workflow 状态为准。

状态机样例是一个 owner、一个 ACK、一次取消的通用有界模型，没有映射到任何业务项目。其通过不能作为 Android SDK、设备采集、音画同步或生产服务的验收依据。

## 0.1.1 全局安装复核

同日按用户明确授权执行当前用户安装，使用本机 Codex CLI **0.163.0-alpha.10.2** 的实际子命令：

```sh
codex plugin marketplace add /absolute/path/to/pstack-codex --json
codex plugin add pstack-codex@pstack-codex --json
codex plugin list --marketplace pstack-codex --json
```

- 原生 CLI 返回版本 **0.1.1**、`installed=true`、`enabled=true`，缓存位于 `~/.codex/plugins/cache/pstack-codex/pstack-codex/0.1.1/`。
- 通过同一 CLI 生成的 JSON-RPC schema，单独运行只读 `initialize` 和 `skills/list`；在两个仓库外工作目录均返回 11 个 `scope=user`、`enabled=true` 的技能，无解析错误。注册名称统一为 `pstack-codex:<技能名>`，不覆盖个人裸名称。
- 生成器 `--check` 及对缓存绝对路径的 `--check --out` 均通过，安装包 64 个文件与内容、执行位完全一致。24 个生成器测试再次通过。
- 直接从安装缓存执行 statechart，正常、反例和缺失依赖三个用例的退出码分别为 0、1、2，报告/反例/Mermaid 与预期一致；使用已存在的 Node 24、Java 11 和经过 SHA-256 核验的 TLC 1.7.4，未安装依赖或修改全局环境变量。
- 没有重启当前 Codex、启动模型工作回合、修改模型选择或 hook 信任。下一轮对话可使用已安装技能；客户端技能选择器和模型实际执行质量仍以相应运行证据为准。

此次修正补全此前只写图形安装的说明，补充经过实际验证的 CLI 安装、命名空间和版本缓存检查；没有修改上游技能树或业务项目源码。
