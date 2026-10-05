# Spike:ZCode 供应商配置结构(2026-10-05,本机只读探查)

目的:T06 适配器的事实依据。全部结论来自 `~/.zcode/v2` 实机只读检查,敏感值已打码。

## 1. `v2/provider_config.json`(用户自定义供应商规则)

```json
{
  "schemaVersion": 1,
  "config": {
    "providerOrder": ["<providerId>", ...],
    "providerConfigRules": {
      "providerRules": [
        {
          "providerId": "<uuid 或 slug>",
          "providerName": "sensenova",
          "config": {
            "group": "...",
            "access": { "type": "api-key", "apiKey": "***" },
            "api": { "type": "openai", "baseUrl": "***", "headers": {} },
            "personalModelIds": ["deepseek-v4.1-flash", "glm-5.3-flash"],
            "modelOrder": [...]
          }
        }
      ]
    },
    "modelConfigRules": {
      "providerModelRules": [ { "modelId": "...", "config": {}, "providerId": "..." } ],
      "manualProviderModelRules": []
    }
  }
}
```

## 2. `v2/config.json`(provider 注册表;规则会合并进来)

`provider.<providerId>`(实机见规则里的 UUID id 出现在此):

```json
{ "name": "...", "kind": "...", "options": { "apiKey": "***", "baseURL": "***" },
  "enabled": true, "source": "...", "models": { "GLM-5.3": {} } }
```

## 3. 激活态:`v2/setting.json`

```json
{ "modelProviderFamilySelectedKeys": { "zai": "coding-plan:builtin:zai-coding-plan" },
  "modelProviderFamilyModes": { "zai": "oauth" } }
```

选中值格式 = `[kind:]providerId`。

## 4. 适配器设计(推断项已标注)

- 注册:upsert providerRules(按 providerId=slug)+ providerOrder 追加 + `config.json provider.<slug>` 完整条目。
- 激活:写 `modelProviderFamilySelectedKeys.zai = "<slug>"`(裸 id;读取端按最后一个 `:` 分段取 id,兼容 kind 前缀格式)。**推断项**:自定义供应商的选中值是否带 kind 前缀未证实;写错可经备份回滚,读取端两种格式都兼容。
- 凭据:仅写入上述两个文件的 options/access 字段(明文,与现状一致);`credentials.json` 的 OAuth/token 键一律不碰。
