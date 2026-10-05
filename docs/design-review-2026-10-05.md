# 设计自查(2026-10-05)

评审对象:五轮需求访谈形成的设计共识(见 ADR-0001~0003 与 CONTEXT.md)。

## 结论

设计整体成立,无推翻级问题:**1 处 ADR 补强**(已完成)、**7 项实现期风险**、**1 个遗留开放问题**(dsh 开发者视图深度);调研报告([docs/research/prior-art.md](./research/prior-art.md))已回,采纳 7 项设计补强(见文末「调研采纳」)。

## ADR 补强

- ADR-0001 增补乐观并发校验:宿主 CLI 在工具运行期间改写文件是常态(它们常驻运行),盲写会静默丢宿主的更新。已补「写前比对内容/mtime,不一致则提示刷新」。

## 实现期风险清单

1. **共享 skills 目录的禁用是全局效应**:`~/.agents` 里禁用一个 skill 会影响所有引用它的宿主;宿主级禁用需要各宿主有原生排除机制(待核实)。v1 按目录级启停设计,界面上明示影响范围。
2. **Codex config.toml 的注释与格式保留**:JS 生态缺少可靠的 format-preserving TOML 编辑器(`@iarna/toml` 不保留注释)。缓解:TOML 采用定位文本修补而非全量序列化;若不可行,接受受控重排但用适配器快照测试锁定行为。
3. **dsh `cordis.patch.yml` 支持 `!!js` 标签**:YAML 往返必须保留自定义标签与注释,选型需支持自定义 tag;同样禁止全量 dump 重写。
4. **Codex 官方登录与自定义供应商共存**:cc-switch 的 `preserveCodexOfficialAuthOnSwitch` 键证明切自定义供应商时 `auth.json` 有被冲掉的坑。适配器只动 `[model_providers.*]` 与 `model_provider`,绝不碰 auth 相关文件。
5. **`~/.agents/.skill-lock.json` 同步**:skills 的增删移动必须同步维护该锁文件,否则宿主侧状态不一致。
6. **dsh 可能没有独立 MCP 配置面**:MCP 域对 dsh 大概率是薄适配器(其工具面走 cordis 插件);调研佐证:dsh 官方 Web UI 的 MCP 管理亦走插件生态,外部适配器 v1 只读展示,确认后 MCP 域按三宿主落地。
7. **ZCode `v2/provider_config.json` + `credentials.json` 结构未知**:四家适配器中唯一无公开文档的,先逆向确认再定档案落地格式。

## 遗留开放问题(不阻塞)

1. ~~Skills「安装」的来源未定~~ **已解决**,见下方「调研采纳」第 5 条。
2. **dsh 开发者视图的深度边界**:只读挂载状态 + patch diff 已确认;是否追加「一键重载/调试」留实现期评估(调研佐证:dsh patch 下次请求即热重载,一键重载价值有限)。

## 调研采纳(2026-10-05)

来源:[docs/research/prior-art.md](./research/prior-art.md)。核心结论:**四宿主统一管理是真空地带**——cc-switch 覆盖 10 工具但无 dsh/ZCode,SkillDock 与 vercel skills 亦无 dsh;且 dsh 官方 Web UI 已原生管理自身供应商/凭证/MCP,本项目对 dsh 的价值在跨工具统一层而非重复其管理面。采纳的设计补强:

1. **三态扫描**(SkillDock 先例):Skills/MCP/插件每个条目标注 托管/外来/冲突 态——本工具晚于用户环境存在,初始全为外来态,必须显式标记「归谁管」才能安全写盘。术语已入 CONTEXT.md。
2. **最小侵入写盘**(cc-switch 明文原则):切换只改连接字段,plugins/hooks/MCP/注释不动,不提供删除活跃供应商的操作,卸载本工具后一切照旧。已并入 ADR-0001。
3. **UI 密钥只回显打码值**(dsh 官方 write-only 范式):存储仍按原决策跟随真实配置明文,但界面永不回显完整 key;导出/备份默认脱敏(dsh-config-manager 的 SecretScanner 模式)。
4. **「何时生效」显式化**:每类资源标注生效模型——dsh patch 下次请求热重载;OpenCode 插件需 reload;Codex/ZCode 需重启或下次会话。四家差异成为 UI 的一部分,不再让用户猜。
5. **Skills 安装来源 v1 = GitHub shorthand(`owner/repo`)+ 任意 git URL + 本地目录**,语义对齐 skills.sh(vercel-labs/skills,生态事实标准);市场浏览/排行不进 v1。凭证走用户已有 git credential helper,不把 token 读进进程。
6. **代理层(Coexist)留接入位不做**:v1 只做 Switch(文件替换)路线;未来出现多供应商并存需求时,档案预留「本地端点」字段,可与 claude-code-router 类工具组合。
7. **备份节奏对齐 cc-switch**:每次写前必备份 + 保留 N 份(N 默认 10);skills/插件域滚动保留 20 份。

另:本机 `~/.local/bin/skillhub`(版本 2026.5.19)经核实为 Python 版「Minimal local skills store CLI」(`skills_store_cli.py`),与调研中 npm `skillhub`(airano)同名不同物;不影响结论。cc-switch 星数经 `gh api` 抽查吻合(140,192)。
