# 取消与旧 ACK：有界工具验证样例

这个小模型验证一条规则：取消后的 owner 不会被旧 ACK 恢复为完成。`safe.cfg` 启用 generation 检查，`broken.cfg` 关闭它。后者应给出“开始异步工作 → 取消 → 收到旧 ACK”的反例；前者应通过。

这是用于验证 statechart 工具链的通用模型，包含一个 owner、一个待处理 ACK 和一次取消。它没有绑定任何业务 SDK 的代码，既不证明 Android 实现正确，也不覆盖线程调度、媒体时间戳或设备行为。用它发现的模型反例不能冒充真实产品缺陷。

在仓库根目录运行：

```sh
node scripts/verify-pstack-codex-statechart.mjs \
  --java /absolute/path/to/java \
  --tlc /absolute/path/to/tla2tools.jar \
  --out /absolute/path/to/new-evidence-directory
```

命令验证现有 TLC 的固定摘要，再实际运行通过模型、故障模型和缺失依赖三种情形。它不下载依赖，也不安装插件。输出保留报告、图和 receipt；任何情形不符合预期都会返回失败。
