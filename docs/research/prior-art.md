# 同类项目调研(截至 2026-10)

> 调研目的:为「私有自用 AI Agent 环境管理工具」(本地 Web,TypeScript 全栈,直读直写真实配置文件,管理 ZCode / OpenAI Codex / OpenCode / dsh 四家 agent CLI 的供应商、Skills、MCP、插件)做 prior art 调研。
>
> 数据来源与方法:GitHub REST API(经 `gh` 认证调用)、各仓库 README / 官方文档原文、npm registry 元数据。star 数、fork 数、最近推送时间(`pushed_at`)均于 **2026-10-05** 经 GitHub API 逐仓核实,非转述。个别通过网页抓取获得且无法二次核实的数据已单独标注。

---

## 一览表

| 项目 | 定位 | 技术栈 | 供应商 | Skills | MCP | 插件 | 多工具 | stars(2026-10-05) | 最近推送 | 链接 |
|---|---|---|---|---|---|---|---|---|---|---|
| cc-switch | AI CLI 供应商切换 + 配置中心(桌面) | Tauri 2 / Rust / React / SQLite | ✅(核心) | ✅(安装) | ✅(统一面板) | ✅(保留不碰) | ✅ 10 个(无 dsh) | 140,187 | 2026-10-05 | [farion1231/cc-switch](https://github.com/farion1231/cc-switch) |
| mcporter | MCP 运行时 + CLI(发现/调用/导入) | TypeScript / Node 24+ | ❌ | ❌ | ✅(核心) | ❌ | ✅(可导入 6 家 MCP 配置) | 5,048 | 2026-10-01 | [openclaw/mcporter](https://github.com/openclaw/mcporter) |
| skillhub | Agent Skills 开源市场 + CLI | TypeScript | ❌ | ✅(核心) | ❌ | ❌ | ✅(Claude/Codex/Copilot) | 19 | 2026-04-12 | [airano-ir/skillhub](https://github.com/airano-ir/skillhub) |
| oh-my-opencode | OpenCode 编排插件(内容包) | TypeScript | 部分(preset 换模型) | ✅(bundled) | ✅(bundled) | 本身即插件 | ❌(仅 OpenCode) | 1,248 | 2026-01-26(停滞) | [opensoft/oh-my-opencode](https://github.com/opensoft/oh-my-opencode) |
| oh-my-opencode-slim | 上者精简活跃 fork | TypeScript | ✅(/preset 运行时切换) | ✅ | ✅ | ✅(marketplace) | ❌(仅 OpenCode) | 9,294 | 2026-10-05 | [alvinunreal/oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) |
| superpowers | 跨 harness skills 框架 + 开发方法论 | Shell / Node | ❌ | ✅(核心) | ❌ | ✅(多 harness plugin 目录) | ✅(15+ harness,只读分发) | 295,456 | 2026-09-27 | [obra/superpowers](https://github.com/obra/superpowers) |
| skills(skills.sh) | 开放 agent skills 安装 CLI + 排行站 | TypeScript | ❌ | ✅(核心) | ❌ | ❌ | ✅(80+ agent) | 33,152 | 2026-10-02 | [vercel-labs/skills](https://github.com/vercel-labs/skills) |
| SkillDock | Skills/MCP/插件 桌面管理器(最接近本项目) | Tauri(桌面) | ❌ | ✅(核心) | ✅ | ✅ | ✅(无 dsh) | 607 | 2026-10-04 | [wanghuan9/skilldock](https://github.com/wanghuan9/skilldock) |
| claude-code-router | 本地路由控制面(模型路由/格式转换) | TypeScript | ✅(代理层) | ❌ | 部分(工具编排) | ❌ | ✅(任意 agent 走代理) | 37,557 | 2026-09-26 | [musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) |
| mcp-hub | MCP 中心协调器(REST API + Web UI + 单端点聚合) | Node(npm mcp-hub) | ❌ | ❌ | ✅(核心) | ❌ | ✅(任意 MCP 客户端) | 520 | —(2026 活跃) | [ravitemer/mcp-hub](https://github.com/ravitemer/mcp-hub) |
| mcpd | 声明式 MCP 工具守护进程(面向部署) | Go | ❌ | ❌ | ✅(核心) | ❌ | ✅(跨环境) | 183 | 2026-09-24 | [mozilla-ai/mcpd](https://github.com/mozilla-ai/mcpd) |
| ouroboros | 「Agent OS」:跨 14 个 runtime 的可复现工作流/自演化 | Python | ❌ | 部分(rules) | ✅(以 MCP server 形态) | ❌ | ✅(14 runtime) | 6,181 | 2026-10-05 | [Q00/ouroboros](https://github.com/Q00/ouroboros) |
| deepseek-harness(dsh 官方) | agent harness 本体,"Everything is a Plugin" | TypeScript / Cordis | ✅(Web UI 原生) | ✅(原生) | ✅(原生) | ✅(核心) | ❌(仅自身) | 243,753 | 2026-10-03 | [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) |
| dsh-config-manager | DSH 配置备份/迁移/同步插件(社区) | TypeScript(DSH 插件) | ✅(DSH 内) | ✅(DSH 内) | ✅(DSH 内) | ✅(DSH 内) | ❌(仅 dsh) | 小(新版 npm 0.1.69) | 2026-09~10 | [xiajiajun516/dsh-config-manager](https://github.com/xiajiajun516/dsh-config-manager) |

> 注:「多工具」列指能同时作用于多家 agent CLI。**没有任何已发现项目同时覆盖 ZCode + Codex + OpenCode + dsh 四家;覆盖 dsh 的第三方工具为零(除 dsh 生态内部插件)。**

---

## 每项目一节

### 1. cc-switch(farion1231/cc-switch)— 赛道头部,供应商切换的标杆

**出处**:[github.com/farion1231/cc-switch](https://github.com/farion1231/cc-switch) · 官网 ccswitch.io · MIT

- **定位**:跨平台桌面「All-in-One assistant」,为 AI 编码工具一键切换 API 供应商,免手动编辑 JSON/TOML/YAML。GitHub API 描述:"A cross-platform desktop All-in-One assistant for Claude Code, Codex, OpenCode, OpenClaw, Grok Build & Hermes Agent."
- **架构与数据流**:Tauri 2 + Rust + React 18 + TypeScript,SQLite(pnpm / Vite / Tailwind / Vitest)。自有数据域 `~/.cc-switch`:SQLite 库 `cc-switch.db`(providers / MCP / prompts / skills / projects / usage)+ `settings.json`(设备设置)+ `live-state.json` + 日志。切换时由 Rust 侧**原子写回**各工具的真实配置文件;备份体系:默认每 24h 自动备份、保留最近 10 份,首次写入前额外备份,skill 操作另有 20 份滚动备份;支持 WebDAV / S3 兼容存储云同步。
- **功能覆盖**:
  - 供应商:90+ 预设、一键/托盘切换、导入导出、拖拽排序;两种模式——**Switch**(单活跃供应商,文件替换)与 **Coexist**(多供应商共存于工具自身配置);本地路由:内置 Anthropic/OpenAI/Gemini API 格式互转 + 自动故障转移(熔断 + 健康监测),向工具写入 `127.0.0.1:15721` + `PROXY_MANAGED` 占位 key;OAuth 账户管理(Copilot / ChatGPT / xAI)。
  - MCP:统一 MCP 面板(跨工具管理)。
  - Skills:从 skills.sh / GitHub / ZIP 安装。
  - 其他:每工具 prompt 库(CLAUDE.md / AGENTS.md / GEMINI.md)、会话管理、用量/成本面板、WSL 配置目录覆盖、`ccswitch://` deep link、i18n。
- **写配置的「最小侵入」原则**(README 原文要点):切换**只替换 endpoint、key、model 等连接细节**;用户自己加的 plugins、hooks、MCP、settings、**注释**保持原样;不允许删除当前活跃供应商,保证卸载 cc-switch 后工具仍可用。
- **活跃度**:140,187 stars / 9,424 forks / 2,707 commits,`pushed_at` 2026-10-05(调研当天仍在提交),最新 release v3.20.4。无官方 headless CLI,社区另有 cc-switch-cli TUI。
- **可借鉴**:SQLite 档案 + 原子写回 + 多层备份;最小侵入写文件;Switch/Coexist 双模式;本地路由层(格式互转 + failover);「切换前后工具始终可用」的兜底设计。
- **不合适/缺失**:桌面 App(Tauri)而非本地 Web;**不支持 dsh,也不支持 ZCode**;Skills 仅「安装」,无三层(内置/全局/项目)生命周期管理;插件域基本只承诺「不弄坏」,不做管理。

### 2. mcporter(openclaw/mcporter,原 steipete/mcporter)— MCP 运行时,不是配置管理器

**出处**:[github.com/openclaw/mcporter](https://github.com/openclaw/mcporter) · [mcporter.sh](https://mcporter.sh) · npm `mcporter` / `@steipete/mcporter` · MIT

- **定位**:TypeScript runtime + CLI,「把 MCP 工具带进脚本、CLI 和 agent」——发现、配置、鉴权、调用 MCP 服务器/工具,并能把工具集生成独立 CLI。API 描述:"Call MCPs via TypeScript, masquerading as simple TypeScript API. Or package them as cli."
- **架构与数据流**:TypeScript(Vitest,Node 24+)。自有配置 `config/mcporter.json`(支持 JSONC、`${VAR}` / `${VAR:-fallback}` 环境占位符、HTTP/stdio 定义、OAuth 设置、工具过滤器、生命周期策略);**能从 Cursor、Claude Code/Desktop、Codex、Windsurf、OpenCode、VS Code 的既有配置中发现并导入 MCP 服务器**(import reference 明确列出各家格式);OAuth 走 `mcporter auth` + `vault`。
- **功能覆盖**:list / call / resource / auth / vault / generate-cli(生成聚焦 CLI)/ emit-ts(生成类型化客户端)/ record / replay(录制复现 MCP 会话);stdio、Streamable HTTP、legacy SSE;keep-alive daemon(服务器池化 + MCP 桥);OpenClaw Chrome 扩展 relay 集成。
- **活跃度**:5,048 stars / 346 forks,`pushed_at` 2026-10-01。
- **可借鉴**:**多工具 MCP 配置导入**(一套代码适配 6 家客户端配置格式与 schema 差异,是本项目 MCP 域最直接的一手参考);环境变量占位符规范(明确拒绝 `${env:VAR}` 形式并给出替代建议,而非静默透传);JSONC 支持。
- **不合适/缺失**:核心是运行时/客户端,不做供应商、Skills、插件;不做跨工具「写回」管理(读入各家配置,但不作为统一编辑器)。

### 3. skillhub(airano-ir/skillhub)— 小型开源 skills 市场

**出处**:[github.com/airano-ir/skillhub](https://github.com/airano-ir/skillhub) · [skills.palebluedot.live](https://skills.palebluedot.live) · npm `skillhub` · MIT

- **定位**:"The open-source marketplace for AI Agent skills",索引 GitHub 上的 SKILL.md 技能并使之可搜索、可安装(自称索引 170K+)。CLI:`skillhub search / install / list`;`skillhub install anthropics/skills/pdf` 支持全局/`--project`/`--platform codex` 等目标;每个 skill 做恶意模式安全扫描;可 Docker 自托管。
- **活跃度**:**19 stars**,`pushed_at` 2026-04-12(半年未更新);npm `skillhub` v0.4.1(2026-07-13 发布),关键词 claude/codex/copilot/cursor/windsurf。
- **名称消歧(置信度:中)**:用户机器上的 "skillhub" 最可能是 npm 上的 `skillhub`(airano)。同名/近似物还有:`@astron-team/skillhub`(科大讯飞,"Manage and install skills for AI coding agents",Apache-2.0)、GitHub topic `claude-skills-hub`、腾讯 SkillHub(由第三方聚合仓库描述提及)、claudeskillsgithub.com 目录站。无法从公开来源确认用户安装的是哪一个,不影响调研结论:该赛道是「市场/目录」型,不做本机环境管理。
- **可借鉴**:安全扫描门禁;`--platform` 参数式的「同一 skill 装到不同 agent」命令面。
- **不合适/缺失**:纯目录/下载器;无本机三层 skills 状态管理(哪些已装、在哪层、是否过期)。

### 4. oh-my-opencode / oh-my-opencode-slim — OpenCode 生态的内容包与编排插件

**出处**:[opensoft/oh-my-opencode](https://github.com/opensoft/oh-my-opencode) · [alvinunreal/oh-my-opencode-slim](https://github.com/alvinunreal/oh-my-opencode-slim) · npm `oh-my-opencode` · [OpenCode 官方生态页](https://opencode.ai/docs/ecosystem)

- **定位**:OpenCode 插件("Coding on steroids"):异步子代理、精选 agents(oracle / librarian / frontend engineer...)、LSP/AST/MCP 工具、Claude Code 兼容层。原仓库 1,248 stars,`pushed_at` **2026-01-26(停滞约 8 个月)**,license 字段 NOASSERTION。
- **fork 更活跃**:oh-my-opencode-slim 9,294 stars,MIT,`pushed_at` 2026-10-05。功能:七个专家 agents(Orchestrator/Explorer/Oracle/Council/Librarian/Designer/Fixer)、后台编排、bundled skills(deepwork/codemap/reflect 等)、Council 多模型并行作答、**preset switching**(`/preset` 运行时整队换模型)、**marketplace packages**(安装/管理社区 agents,重载 OpenCode 后生效)、细粒度权限(每 agent 的 skill/MCP 权限)与**全局禁用开关**(tools/MCPs/agents/skills/hooks/slash commands)、项目本地定制。
- **可借鉴**:「全局开关 + 每 agent 授权」的配置面;preset 作为「一组模型映射的命名快照」;marketplace 安装后需 reload 的生效模型(与 dsh 的 HMR 形成对照)。
- **不合适/缺失**:是 OpenCode 的**内容/编排插件**,不是环境管理器;不写其他工具的配置;原仓库已停滞。

### 5. superpowers(obra/superpowers)— 跨 harness skills 分发的一手范例

**出处**:[github.com/obra/superpowers](https://github.com/obra/superpowers) · MIT

- **定位**:"An agentic skills framework & software development methodology that works":brainstorming → 写计划 → subagent-driven development → 强制 TDD → code review → 收尾分支;技能经 session-start bootstrap 自动注入,"Mandatory workflows, not suggestions"。
- **架构**:Shell + Node/npm 入口;目录为 `skills/`、`hooks/`、`scripts/`、`docs/`,**外加每个宿主一套 plugin 目录**(`.claude-plugin`、`.codex-plugin`、`.cursor-plugin`、`.devin-plugin`、`.hermes-plugin`、`.kimi-plugin`、`.muse-plugin`、`.opencode` 等),同一内容适配 15+ harness,各宿主有自己的安装命令(官方 marketplace 或本仓库作为 marketplace)。
- **活跃度**:295,456 stars / 26,394 forks(GitHub API 核实),`pushed_at` 2026-09-27。
- **可借鉴**:**「单仓库多宿主清单」的 skills 分发结构**——本项目若做「一处 skill,多 CLI 生效」,superpowers 的 per-harness 清单目录是最成熟的一手先例;skills 与 hooks 成对交付的模式。
- **不合适/缺失**:它是**被管理的对象**(内容),不是管理工具;不涉及供应商/MCP 配置。

### 6. vercel-labs/skills(npx skills / skills.sh)— skills 安装的事实标准 CLI

**出处**:[github.com/vercel-labs/skills](https://github.com/vercel-labs/skills) · [skills.sh](https://skills.sh) · npm `skills` · MIT

- **定位**:"The CLI for the open agent skills ecosystem",`npx skills add owner/repo`,支持 OpenCode、Claude Code、Codex、Cursor 及共 80+ agent;`-g` 装用户级、缺省装项目级、`-a` 指定 agent、`-s` 选 skill;`skills use` 不落盘、生成 prompt 后可拉起任一 agent。来源支持 GitHub/GitLab/Azure DevOps/任意 git URL/本地路径;**私有仓库复用用户已配置的 git 凭证(git credential helper → gh → SSH 回退),明确不把 gh token 读进进程**;GitHub API 匿名 → 环境变量 token → `gh api` 三级回退。skills.sh 同时是安装量排行站(第三方聚合站如 LinklyAI/best-skills 即抓取 skills.sh、ClawHub 等榜单)。
- **活跃度**:33,152 stars,`pushed_at` 2026-10-02。
- **可借鉴**:**凭证隔离原则**;来源解析器(GitHub shorthand / URL / 子路径 / 本地)的语义设计;「装到哪个 agent 的哪一层」的一等参数化。
- **不合适/缺失**:只管安装/分发,不管本机已装 skills 的盘点、更新、冲突(这正是 SkillDock 补的位)。

### 7. SkillDock(wanghuan9/skilldock)— 与本项目定位最接近的桌面工具

**出处**:[github.com/wanghuan9/skilldock](https://github.com/wanghuan9/skilldock) · MIT · v1.0.8,macOS(Apple Silicon)/ Windows x64

- **定位**:"AI Skill Manager" 桌面控制中心:同时管理 **Skills、MCP 配置、插件** 三类资源,面向 Claude Code、Cursor、Codex、Windsurf、Gemini CLI、GitHub Copilot、OpenCode 等。
- **架构与数据流**:Tauri 桌面应用(src-tauri);**扫描每个工具的真实 skill 目录**,区分 managed / unmanaged / conflicting 三态;Git-aware:Git 来源的 skill/插件保持真实仓库,检测上游更新、本地改动、待推送,更新前可预览 diff、按文件或 hunk 回退;一键把 skill/MCP/插件**同步启用到多个工具**;安装源:skills.sh、ClawHub、MCP.Directory、Git 仓库、本地目录;MCP 工具发现(枚举 server 暴露的 tools 并做工具级启停);核心场景是团队协作(发布者本地改完一键 push,使用者一键 update 并看到谁改了什么)。
- **活跃度**:607 stars,`pushed_at` 2026-10-04。
- **可借鉴**:**三态扫描(managed/unmanaged/conflicting)** 是本机直读直写模式下的关键问题;Git-backed 资源的 diff/push/update 工作流;「同一资源在多个工具中启用/停用」的同步矩阵。
- **不合适/缺失**:桌面 App 非 Web;**工具列表中没有 dsh,也没有 ZCode**;不做供应商/密钥管理。

### 8. claude-code-router(musistudio/claude-code-router)— 「代理层」路线的头部

**出处**:[github.com/musistudio/claude-code-router](https://github.com/musistudio/claude-code-router) · MIT

- **定位**:API 描述:"One local control plane for every AI agent: route across models, fuse new capabilities, orchestrate tools, and stay fully in control." 本地起路由服务,任意 agent 的请求被代理并按规则路由到不同模型/供应商。与 cc-switch 的 local routing(127.0.0.1:15721)同属一条技术路线,但更侧重路由规则与工具编排。
- **活跃度**:37,557 stars,TypeScript,`pushed_at` 2026-09-26。
- **可借鉴**:代理层是「切换供应商」的另一种范式——不动工具配置文件,只写一次本地端点;适合做故障转移/多供应商并存的场景。
- **不合适/缺失**:不管理本机配置文件本身;对私有自用场景引入常驻进程与单点。

### 9. MCP 配置管理器们(mcp-hub / mcpd / mcpdog / Docker MCP / smithery)

- **[ravitemer/mcp-hub](https://github.com/ravitemer/mcp-hub)**(520 stars,MIT,npm `mcp-hub`):中心协调器,双接口——`/api/*` REST + Web UI 管理 MCP 服务器,`/mcp` 单一端点让**任意 MCP 客户端**(Claude Desktop、Cline 等)接入全部服务器(localhost:37373);支持 stdio/SSE/Streamable HTTP、OAuth PKCE、marketplace 发现与自动配置、服务器与连接状态实时更新。
- **[mozilla-ai/mcpd](https://github.com/mozilla-ai/mcpd)**(183 stars,Go,`pushed_at` 2026-09-24):"Declaratively define and run required tools across environments, from local development to containerized cloud deployments"——声明式定义 + 守护进程运行,面向部署而非桌面。
- **Docker MCP Toolkit**([docs.docker.com](https://docs.docker.com))(非 GitHub 开源仓库本体):`docker mcp` 命令管理 profiles、servers、OAuth credentials、catalogs,面向脚本化。
- **smithery.ai**:托管 MCP 注册表/目录(发现、配置、部署);**未找到公开主仓库**,按闭源托管服务对待(2026-09 起 GitHub 另有官方向的 [MCP Registry](https://github.com/blog) 与 registry.modelcontextprotocol.io,属生态基础设施)。
- **长尾**:[kinhunt/mcpdog](https://github.com/kinhunt/mcpdog)(20 stars,统一代理层 + Web dashboard,面向 Claude Desktop/Code、Cursor、Gemini CLI)、[AZERDSQ131/mcpm](https://github.com/AZERDSQ131/mcpm)(14 stars,跨 Claude Code/Cursor/VS Code 安装配置)、[holstein13/mcp-config-manager](https://github.com/holstein13/mcp-config-manager)(29 stars,交互式 CLI:enable/disable、preset、跨 Claude/Gemini 配置同步)等。
- **小结**:MCP 域的两极分化——要么做 **registry/市场**(smithery、官方 registry),要么做 **runtime/聚合**(mcpd、mcp-hub、mcporter);纯「配置文件编辑器/同步器」只有 <30 stars 的长尾。**轻量、可靠、懂各家 schema 差异的 MCP 配置 GUI 仍是空档。**

### 10. dsh 生态(官方 harness + 社区插件)— 与本项目四分之一域直接相关

**官方:[deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**(243,753 stars / 29,206 forks,TypeScript,MIT,`pushed_at` 2026-10-03;官网 [deepseek.com/harness](https://deepseek.com/harness),文档 [deepseek-harness.github.io/deepseek-harness](https://deepseek-harness.github.io/deepseek-harness/),Discord 社区)

- **定位**:"Everything is a Plugin",基于 [Cordis](https://github.com/cordiverse/cordis) 的 agent harness;**developer preview,官方明示将有破坏性变更**。apps 四件套:cli / web / desktop / desktop-host;packages 覆盖 boot / core / llm / mcp / credentials / preset / hooks / sandbox 等。
- **官方 Web UI 已原生管理**(docs/user/guide/providers.md 原文核实):
  - 供应商:Settings → Models 配 DeepSeek key;内置第三方 provider 预设(anthropic、openai、moonshotai、zai 等);**自定义 OpenAI 兼容端点**(三协议:`openai-completions` / `openai-responses` / `anthropic-messages`),支持 **Fetch available models** 模型发现;OAuth 型供应商(Codex 等)暂不支持。
  - 凭证:key **write-only**,页面只回 redacted descriptor;字面密钥存 `$DSH_HOME/.credentials.yaml`,settings 只保留 credential **引用**。
  - 配置文件:`$DSH_HOME/profiles/<profile>/cordis.patch.yml`,适配器**下一次请求即重读,免重启**(另有 `dsh-hmr` 监视 manifest 与 patch 做序列化 reload)。
- **插件体系**(apps/cli/README.md 原文核实):profile = **有序 plugin-bundle patch 层叠**:bundles 按序 patch → profile 的 `cordis.patch.yml` → home 级 `$DSH_HOME/cordis.patch.yml` → `--patch` 覆盖;profile 目录即一个含 `package.json` 的 **pnpm 安装域**,`dsh plugin --profile <name> <pnpm args>` 直接转发 pnpm 管理插件;`--dump-config` / `--dump-config-schema`(按已装载插件 schema 输出 JSON Schema);npm 包自述:"dsh CLI: profile launch, plugin management, and configuration inspection"。
- **发现机制**:无官方市场,靠 GitHub topic `dsh-plugin` + npm。

**社区插件/工具(均为 2026-08~10 创建的小项目,生态正爆发)**:

| 项目 | 作用 | 出处 |
|---|---|---|
| dsh-config-manager | DSH 全配置备份/恢复/导出/导入/迁移/同步:settings、模型供应商、插件、MCP、skills、agent presets、workspaces;定时备份(6h/12h/24h/7d);**默认不含 secrets**,SecretScanner 扫描载荷;可选加密导出 credentials(scrypt + AES-256-GCM);Git/WebDAV 同步;**配置市场**(dry-run 预览、逐项批准、供应链警告);跨机器死路径检测与重映射;还原前自动快照回滚 | [xiajiajun516/dsh-config-manager](https://github.com/xiajiajun516/dsh-config-manager) |
| dsh-backup / dsh-config-sync | 同赛道兄弟项目:CLI 一键 `~/.dsh` 快照 + session doctor;加密导出导入 | [xiaoyuyu6420/dsh-backup](https://github.com/xiaoyuyu6420/dsh-backup) · [muyifc/dsh-config-sync](https://github.com/muyifc/dsh-config-sync) |
| DeepSeekHarness-MCP-Manager | MCP 服务器管理插件:Settings UI + HTTP API + `mcp_manager_*` 模型工具 | [xxxyz/DeepSeekHarness-MCP-Manager](https://github.com/xxxyz/DeepSeekHarness-MCP-Manager) |
| dsh-mcp-manager | MCP 插件:OAuth(PKCE + 动态客户端注册)或静态 token,工具注册为 `mcp__<name>__*` | [hyqhyq3/dsh-mcp-manager](https://github.com/hyqhyq3/dsh-mcp-manager) |
| dsh-skills-manager 系 | 多个变体:全局/workspace 两级安装、跨工具 SKILL.md + Rules 管理、技能启停/搬运/诊断 | npm:`dsh-skills-manager`、`@michengai/dsh-skills-manager`、`@zhijianren/dsh-skills-manager`、`@wisdoverse/dsh-skills-manager`、`@zfdx123/dsh-skills-manager` 等 |
| 桌面/托盘管理器 | 一键启动内嵌 DSH + 插件与预设管理 + API 切换 + 托盘(Tauri/Electron/pywebview 各一) | [luocuiyu/deepseek-harness-manager](https://github.com/luocuiyu/deepseek-harness-manager) · [mocilukalbj/deepseek-harness-manager](https://github.com/mocilukalbj/deepseek-harness-manager) · [kanneiren/dsh-windows-manager](https://github.com/kanneiren/dsh-windows-manager) 等 |

- **对本项目的意义**:dsh 官方已把「供应商 + 凭证 + MCP + 插件」做进了自身 Web UI,外部工具的价值必须落在**跨工具统一层**(把 dsh 与 ZCode/Codex/OpenCode 放在一张桌子上),而不是重复 dsh 自己的管理面;同时社区插件已经踩出「备份不带 secrets / dry-run / 逐项批准」的成熟模式。

### 11. 其他发现:Agent OS / 多 runtime 路线

- **[Q00/ouroboros](https://github.com/Q00/ouroboros)**(6,181 stars,Python,MIT,`pushed_at` 2026-10-05):"Agent OS for replayable AI coding workflows",以 MCP server 形态服务 14 个 runtime(Claude Code、Codex CLI、Gemini CLI、OpenCode、Copilot、Kiro 等)。定位是工作流/自演化,不管理本机配置文件。
- **供应商切换器的长尾**:"claude-provider-switcher" 在 GitHub 上有 **8 个以上同名独立小仓库**(最高 6 stars,脚本/VS Code 插件/托盘各异),说明「供应商切换」需求真实且分散,尚无除 cc-switch 外的整合者。
- Codex 单工具方向存在多个 0-star 的 "codex-config-manager"(Windows GUI presets/providers/backups、本地 Web UI 切换 auth/config profile 等),无一成势。

---

## 对本项目的启示

### 值得直接抄的设计

1. **最小侵入写文件**(cc-switch):切换供应商只改 endpoint/key/model 等连接字段;用户的 plugins、hooks、MCP、注释原样保留;禁止删除当前活跃配置,保证卸载本工具后一切照旧。这是所有「直写真实配置文件」工具里唯一被头部产品明文化的原则,应作为本项目写盘层的硬约束。
2. **SQLite(或等价档案库)+ 原子写回 + 多层备份**(cc-switch:24h×10 份、首写前备份、skills 20 份):本机可见的旁证是用户 `~/.codex/backups/` 目录真实存在同类结构。
3. **Switch / Coexist 双模式**(cc-switch):单活跃供应商(文件替换)与多供应商共存(代理/路由)分开建模;若做代理路线,抄 cc-switch 的占位 key(`PROXY_MANAGED`)与 claude-code-router 的本地控制面。
4. **多工具配置 schema 适配层**(mcporter import reference + cc-switch 10 工具):MCP 域的各家格式差异(Claude Desktop JSON、Codex TOML、OpenCode JSON、dsh cordis YAML)是本项目 MCP 统一面板的核心工程量,mcporter 已验证「一份导入器清单 + 逐家格式文档」的可行性。
5. **三态扫描:managed / unmanaged / conflicting**(SkillDock):凡直读真实目录,就必须回答「这个 skill/MCP 是我管的、别人装的、还是两边都改过」;配合 Git-backed 资源的 diff 预览与按 hunk 回退。
6. **凭证隔离**(vercel skills + dsh 官方双重先例):不把 token 读进自己的进程(git credential helper 优先);存字面密钥单独文件(`.credentials.yaml`),设置里只存引用、界面只回 redacted 值(write-only)。
7. **导出/同步默认不带 secrets + dry-run 逐项批准**(dsh-config-manager):SecretScanner 扫载荷、可选加密(scrypt + AES-256-GCM)后才能带走 credentials、供应链警告——备份/迁移功能的安全底线已由社区插件定型。
8. **schema dump**(dsh `--dump-config-schema`):面向「配置檢查」的调试面,组合后的有效配置与 JSON Schema 均可导出;本项目可为四家工具各做一层「effective config 预览」。
9. **单仓库多宿主分发清单**(superpowers 的 per-harness plugin 目录):若引入「一处 skills,多 CLI 生效」,直接参考其 `.claude-plugin` / `.codex-plugin` / `.opencode` 并列清单结构,再补 dsh(cordis bundle)与 ZCode 两列。

### 大家普遍没做好的点

1. **没人支持 dsh**:cc-switch(10 工具)、SkillDock、vercel skills、mcporter、mcp-hub 的支持列表里都没有 dsh;dsh 社区工具又只管 dsh 自己。四工具统一是真空地带。
2. **Skills 偏「装」不偏「管」**:市场型(skillhub/skills.sh/ClawHub)只管发现安装;SkillDock 做了生命周期但止步于桌面双平台。三层模型(内置/用户全局/项目)在同一工具里的盘点、启停、冲突提示,只有 SkillDock 的三态扫描接近,尚无 Web 实现。
3. **多格式统一编辑无人做**:JSON(~/.zcode)、TOML(~/.codex config.toml)、JSON(~/.config/opencode)、YAML(dsh cordis.patch.yml)+ 各自的注释保留问题——cc-switch 明确把「保注释」当卖点反证了这是行业痛点,但它是 Rust 侧实现的,TS 全栈下(toml 与 YAML 的注释保留解析)仍需自研。
4. **MCP 配置 GUI 是长尾洼地**:registry 与 runtime 两头热闹,中间的「跨工具配置编辑/校验/冲突检测/一键启停」最大只有 29 stars(mcp-config-manager)与 520 stars 的 hub 型(mcp-hub,已偏 runtime)。
5. **凭证安全参差**:头部供应商切换器把 key 明文存本地档案是常态;dsh 官方的 write-only + redacted + 引用式存储是唯一被一手验证的更优范式。
6. **生效模型缺共识**:cc-switch 靠工具热重载,dsh 有 HMR,OpenCode 插件要 reload,superpowers 靠 session bootstrap——「改了什么、何时生效、是否需要重启」没有统一表达,用户永远在猜。

### 差异化机会(本项目可占的位置)

1. **四工具统一桌面**:ZCode + Codex + OpenCode + dsh 的供应商/Skills/MCP/插件一张桌子——已验证无竞品;且四家中 dsh 的 cordis patch 层叠与 ZCode 的插件体系都要求深度适配,通用工具不会为小众组合做这件事,私有自用工具正合适。
2. **「何时生效」的显式化**:为每类资源标注生效方式(热重载 / 下次请求 / 下次会话 / 需重启),把四家的差异变成 UI 的一部分。
3. **TS 全栈的注释保留写回**:JSONC/TOML/YAML 三种带注释格式的 parse→patch→serialize 管线,是本项目区别于「整体覆盖式」小工具的技术护城河。
4. **代理层作为可选 Coexist 后端**:不自己做路由,聚焦配置面;需要多供应商并存时,像 cc-switch 一样留出「写入本地端点」的接入位,可与 claude-code-router 类工具组合。
5. **私有部署的安全基线即卖点**:密钥引用化 + 导出默认脱敏 + dry-run——对自己用,这些是把「工具弄坏环境」风险压到最低的设计,也全部有一手先例可依。

---

## 调研方法与置信度备注

- 星数 / fork / `pushed_at` / license:全部经 GitHub REST API(`gh api repos/<owner>/<repo>`)于 2026-10-05 逐仓核实;npm 版本与描述经 `npm view` 核实。
- **cc-switch 确认为 farion1231/cc-switch**(API 描述、README、ccswitch.io、CSDN 解析文多方一致),置信度:高。
- **skillhub 存在同名消歧问题**(npm `skillhub` by airano 最可能;另有 @astron-team/skillhub、腾讯 SkillHub、topic claude-skills-hub),置信度:中,已在上文如实并列。
- smithery.ai 未找到公开主仓库,按闭源服务处理;oh-my-opencode 原仓库 license 字段为 NOASSERTION(仓库页面未给出标准 license)。
- superpowers 295,456 与 cc-switch 140,187 的星数初看异常高,但均经 API 字段直接核实,并非网页摘要推测。
- 未发现任何覆盖 ZCode 的第三方管理工具;`gh search repos "zcode config manager"` 结果为空。
