# dsh-opendesign-usage

OpenDesign **Go 套餐额度药丸** — 在 DSH Web 输入框上方常驻显示 Design Plan 的 **5 小时** 与 **7 天** 用量窗口，附重置倒计时。

DeepSeek Harness (DSH) Web GUI 插件。

---

## 效果

收起态：

```
[logo]  5h 12% · 7d 82%  [v]
```

点开展开：

```
┌────────────────────────────────────┐
│ 5 小时                             │
│ ████████░░░░░░░░░░░░░░░░  已用 12%  │
│ 剩余 88% · 重置于 2h 59m            │
│                                    │
│ 7 天                               │
│ ████████████████████░░░░  已用 82%  │
│ 剩余 18% · 重置于 23h 41m           │
│ ────────────────────────────────   │
│ 将打开浏览器窗口，请在其中完成登录   │
│ 登录          刷新        更新于 11:49│
└────────────────────────────────────┘
```

百分比超过 50% / 70% / 80% / 90% 时逐级变黄 → 橙 → 红 → 红加粗。

---

## 为什么需要"登录窗口"

OpenDesign 的额度只存在于 **控制台 API**，它仅接受浏览器会话 cookie：

```
GET https://amr-api.open-design.ai/api/v1/workspaces/{workspaceId}/billing/coding-plan-usage
```

- **不接受任何 API Key**（`Authorization: Bearer`、`x-api-key`、`x-control-key` 全部返回 401）
- 登录页启用 Cloudflare Turnstile 人机验证，无法自动登录
- 官方 spec 明确禁止 runtime key 读取钱包/额度

因此本插件采用：**host 侧拉起带远程调试端口的 Chrome → 你在窗口里正常登录 → host 通过 CDP 收割 cookie → 实测请求一次接口，200 才写入配置 → 关闭窗口**。

cookie 仅保存在本机 `~/.dsh/opendesign-usage.json`（mode `0600`），**绝不回传浏览器**，前端只能看到 `••••m8gy` 这样的掩码。

---

## 安装

### 前置

- DSH 桌面端或 `dsh web`，profile 为 `desktop`（或你实际使用的 profile）
- Node ≥ 22.19

### 步骤

```bash
# 1. 克隆到 DSH 插件目录
git clone https://github.com/JCH2333/dsh-opendesign-usage.git \
  "%USERPROFILE%\.dsh\plugins\dsh-opendesign-usage"
```

**2. 建 cordis 解析链**（关键，否则 `import '@deepseek-ai/cordis'` 会 `ERR_MODULE_NOT_FOUND`）

```powershell
$plug = "$env:USERPROFILE\.dsh\plugins\dsh-opendesign-usage"
$prof = "$env:USERPROFILE\.dsh\profiles\desktop"
New-Item -ItemType Directory -Force -Path "$plug\node_modules\@deepseek-ai" | Out-Null
cmd /c mklink /J "$plug\node_modules\@deepseek-ai\cordis" "$prof\node_modules\@deepseek-ai\cordis"
```

> **为什么需要**：`link:` 安装时 Node ESM 按 realpath 解析，从插件目录向上找不到 profile 的 `node_modules`。

**3. 注册到 profile**

在 `~/.dsh/profiles/desktop/package.json` 中：

```jsonc
{
  "dependencies": {
    "dsh-opendesign-usage": "link:C:/Users/<you>/.dsh/plugins/dsh-opendesign-usage"
  },
  "dsh": {
    "profile": {
      "bundles": [
        // ... 已有项
        "dsh-opendesign-usage"
      ]
    }
  }
}
```

**4. 建软链**

```powershell
cmd /c mklink /D "$prof\node_modules\dsh-opendesign-usage" "$plug"
```

**5. 重启 DSH**

---

## 使用

> **只在当前会话选中 OpenDesign 模型时显示。** 切到 DeepSeek、OpenCode 等其他服务商时药丸自动隐藏，并停止轮询与上游请求；切回 OpenDesign 模型立即恢复。
>
> 会话刚打开、选择尚未解析的那一小段仍会显示（fail-open）——一次失败的选择读取不该被误读成「插件没装」。

1. 输入框上方出现药丸，未登录时显示 `<err:noconfig>`
2. 点开 → 点 **登录**
3. 弹出的 Chrome 窗口里登录 [open-design.ai](https://open-design.ai/cloud/dashboard)（需过人机验证，正常）
4. 登录成功后窗口自动关闭，药丸显示真实额度

之后每 10 秒自动刷新；页面重新可见时立即刷新。cookie 过期后药丸会重新显示 `<err:unauthorized>`，再点一次登录即可。

---

## 配置

配置文件 `$DSH_HOME/opendesign-usage.json`（默认 `~/.dsh/opendesign-usage.json`）。

环境变量优先级更高：

| 环境变量 | 说明 | 默认 |
|---|---|---|
| `OPENDESIGN_USAGE_COOKIE` | 会话 cookie（手动指定，跳过登录窗口） | — |
| `OPENDESIGN_USAGE_WORKSPACE_ID` | 工作区 ID | —（必填） |
| `OPENDESIGN_USAGE_CACHE_TTL` | 缓存秒数 | `60` |
| `OPENDESIGN_USAGE_TIMEOUT_MS` | 上游超时（毫秒） | `10000` |

> workspace ID 可从控制台地址栏取：`open-design.ai/cloud/dashboard?workspaceId=xxxxx`

---

## HTTP 接口（同源，浏览器直连）

| Method | Path | 说明 |
|---|---|---|
| GET | `/api/opendesign-usage` | 额度快照（走缓存） |
| GET | `/api/opendesign-usage/refresh` | 强制刷新 |
| GET | `/api/opendesign-usage/config` | 脱敏配置 |
| POST | `/api/opendesign-usage/config` | 写配置 |
| POST | `/api/opendesign-usage/login` | 拉起登录窗口 |
| GET | `/api/opendesign-usage/login/status` | 登录进度 |

---

## 数据结构

`coding-plan-usage` 返回 `windows[]`，插件归一化为：

```ts
interface WindowView {
  kind: 'rolling' | 'weekly' | 'other'   // rolling = 5 小时, weekly = 7 天
  label: string                           // '5h' | '7d'
  durationSeconds: number                 // 18000 | 604800
  remainingPercent: number                // 0-100
  usedPercent: number                     // 0-100
  resetsAt?: string                       // ISO
  resetInSec: number
  status: 'ok' | 'exhausted'
}
```

窗口归类只依据 `durationSeconds`：`18000` → 5 小时，`604800` → 7 天，其它按 `durationSeconds/3600` 推出标签。

---

## 项目结构

```
dsh-opendesign-usage/
├── package.json          # dsh.bundle + dsh.client 声明
├── cordis.patch.yml      # 插件行注册
└── lib/
    ├── index.js          # 入口：注册 5 条 HTTP 路由
    ├── api.js            # 上游请求 + 窗口归一化
    ├── service.js        # 缓存 / 并发去重 / 失败冷却
    ├── login.js          # Chrome 拉起 + CDP cookie 收割
    ├── config.js         # 配置读写 + 脱敏
    └── client.js         # 药丸 UI（__ModuleLoader__ 包装）
```

纯 JS，**无需构建步骤**。

---

## 踩坑记录

这两点会让人白白调试很久，记下来：

**1. `@deepseek-ai/dsh-*` 的 peerDependencies 是与运行时的硬绑定**

DSH 启动时会校验。版本不匹配则**整个 bundle 被静默跳过**——不报错、界面无变化，只在启动日志里留一行 `dsh: skipping profile bundle`。

插件应优先使用 `engines.dsh` 的宽松范围（一旦存在就独占判定，peerDependencies 被忽略）：

```json
{ "engines": { "dsh": ">=0.1.0-rc.1" } }
```

**2. `link:` 安装时裸 import `@deepseek-ai/*` 必然失败**

Node ESM 对符号链接按 realpath 解析，从插件目录向上找不到 profile 的 `node_modules`。需在插件自己的 `node_modules/@deepseek-ai/` 下建 junction（见安装步骤 2）。

---

## 许可

MIT
