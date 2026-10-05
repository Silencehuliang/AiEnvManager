# 范围边界:四宿主,不纳管 Claude Code

宿主明确为 **ZCode、Codex、OpenCode、dsh** 四个。尽管本工具取代 cc-switch(Claude/Codex 供应商切换器),但用户已不用 Claude Code,决定**完全不纳管 Claude**——这是「取代 cc-switch」与「纳管 Claude」的显式解耦,未来若要支持 Claude 属于新增宿主,而非回归。其他显式边界:

- 内置层(宿主/插件自带资源)只读展示,永不编辑。
- v1 资源域:供应商、Skills(内置/用户全局/项目)、MCP、插件;agents 定义、hooks、权限、settings 键值列 v1.x。
- 插件域深度不对称:dsh 全量(总览+启停+全生命周期+开发者视图),其余宿主 v1 = 总览+启停。
- 项目层范围 = 配置根目录扫描(识别 `.agents/`、`AGENTS.md`、`cordis.patch.yml` 等标记)+ 手动排除。
- 仅本机 localhost、无鉴权、按需启动(`npm start`);MVP 竖切从供应商域开始。
