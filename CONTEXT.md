# AiEnvManagent

管理多个 AI Agent CLI 的运行环境(LLM 供应商、Skills、MCP 服务器、插件)的本地 Web 工具。本文件是项目术语表。

## Language

### 宿主与资源

**Host(宿主)**:
被管理的 agent CLI,当前指 ZCode、Codex、OpenCode、dsh 四者。
_Avoid_: 工具、目标 CLI、平台

**dsh**:
DeepSeek 官方 agent CLI(npm 包 `@deepseek-ai/dsh`),配置根在 `~/.dsh`。注意小写是官方拼写。
_Avoid_: DSH、DeepSeek Harness

**真实配置(Real Config)**:
各 Host 自己的配置文件(JSON/TOML/YAML/Markdown),是唯一事实源;本工具直读直写,不做自己的事实源。
_Avoid_: manifest、数据库配置、托管配置

**Provider(供应商)**:
一家 LLM 服务(如 modelscope、sensenova、wb),拥有 base_url、api_key 与模型列表。
_Avoid_: 渠道、API、模型

**供应商档案(Provider Profile)**:
供应商在共享档案库中的记录(base_url、api_key、模型映射);全宿主只录入一次,不按宿主重复维护。
_Avoid_: 供应商条目、账号

**切换(Switch)**:
把某 Host 的当前供应商改为某条档案,并写回其真实配置;写前自动备份,保留最近 N 份可回滚。
_Avoid_: 应用、落地、激活

**Skill**:
以 `SKILL.md` 为入口的自包含目录,是 agent 的能力包;按所在位置属于不同层级。
_Avoid_: 技能、命令

**Plugin(插件)**:
通过各 Host 自身扩展机制安装的能力包(ZCode marketplace、Codex `[plugins.*]`、OpenCode npm 插件、dsh cordis 组件);与 Skill 的区别是安装来源与宿主机制。
_Avoid_: 扩展、组件

### 层级(Layer)

**内置层(Built-in)**:
宿主或其插件自带的资源,在界面上只读展示,不可编辑。
_Avoid_: 系统、官方、全局

**用户全局层(User Global)**:
用户主目录下的资源,跨项目生效;含被多宿主共享的 `~/.agents`。
_Avoid_: 用户级、全局层(单独说「全局」易与内置层混淆)

**项目层(Project)**:
项目目录内的资源,仅对该项目生效。
_Avoid_: 工作区、局部

### dsh 专有

**Profile(dsh)**:
dsh 的运行组合(desktop / devwf / headless / web),每个是一个 pnpm workspace + cordis 组合树;插件装在其中。
_Avoid_: 环境(留给本工具自己的概念)
