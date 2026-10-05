# 设计自查(2026-10-05)

评审对象:五轮需求访谈形成的设计共识(见 ADR-0001~0003 与 CONTEXT.md)。

## 结论

设计整体成立,无推翻级问题:**1 处 ADR 补强**(已完成)、**7 项实现期风险**、**2 个遗留开放问题**(不阻塞动工)。

## ADR 补强

- ADR-0001 增补乐观并发校验:宿主 CLI 在工具运行期间改写文件是常态(它们常驻运行),盲写会静默丢宿主的更新。已补「写前比对内容/mtime,不一致则提示刷新」。

## 实现期风险清单

1. **共享 skills 目录的禁用是全局效应**:`~/.agents` 里禁用一个 skill 会影响所有引用它的宿主;宿主级禁用需要各宿主有原生排除机制(待核实)。v1 按目录级启停设计,界面上明示影响范围。
2. **Codex config.toml 的注释与格式保留**:JS 生态缺少可靠的 format-preserving TOML 编辑器(`@iarna/toml` 不保留注释)。缓解:TOML 采用定位文本修补而非全量序列化;若不可行,接受受控重排但用适配器快照测试锁定行为。
3. **dsh `cordis.patch.yml` 支持 `!!js` 标签**:YAML 往返必须保留自定义标签与注释,选型需支持自定义 tag;同样禁止全量 dump 重写。
4. **Codex 官方登录与自定义供应商共存**:cc-switch 的 `preserveCodexOfficialAuthOnSwitch` 键证明切自定义供应商时 `auth.json` 有被冲掉的坑。适配器只动 `[model_providers.*]` 与 `model_provider`,绝不碰 auth 相关文件。
5. **`~/.agents/.skill-lock.json` 同步**:skills 的增删移动必须同步维护该锁文件,否则宿主侧状态不一致。
6. **dsh 可能没有独立 MCP 配置面**:MCP 域对 dsh 大概率是空适配器(其工具面走 cordis 插件体系);确认后 MCP 域按三宿主落地。
7. **ZCode `v2/provider_config.json` + `credentials.json` 结构未知**:四家适配器中唯一无公开文档的,先逆向确认再定档案落地格式。

## 遗留开放问题(不阻塞)

1. **Skills「安装」的来源未定**:访谈确认 v1 含安装/卸载,但来源(本地目录导入 / git URL / 技能市场)未定;待 GitHub 同类项目调研(mcporter、skillhub 的模式)回来后补决策。
2. **dsh 开发者视图的深度边界**:只读挂载状态 + patch diff 已确认;是否追加「一键重载/调试」留实现期评估。
