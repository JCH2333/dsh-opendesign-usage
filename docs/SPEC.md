# dsh-opendesign-usage 设计规范（唯一事实源）

## 目标
给 DSH Web GUI 做一个 OpenDesign Go 套餐额度药丸，形态照搬 `v587d/dsh-opencode-go-usage`。
显示 Design Plan 的 **5 小时窗口** 与 **7 天窗口** 的已用百分比 + 重置倒计时。

## 已实测确认的上游接口（不要重新探测，直接用）
Base: `https://amr-api.open-design.ai`

### 1. 套餐额度
```
GET /api/v1/workspaces/{workspaceId}/billing/coding-plan-usage
Headers:
  Cookie: <浏览器会话 cookie>
  x-vela-workspace-id: <workspaceId>
  Accept: application/json
```
未登录返回 `401 {"error":"unauthenticated"}`。

### 2. 钱包余额（可选，次要）
```
GET /api/v1/workspaces/{workspaceId}/wallet/balance
```
同样认证。

### 3. 响应结构（从官方前端 bundle 逆向，字段名以此为准）
`coding-plan-usage` 返回对象含 `windows` 数组，每个窗口：
- `durationSeconds`  number  窗口时长。3600*5=5小时；86400*7=7天
- `remainingCredits` number  剩余额度
- `limitCredits`     number  窗口总额度
- `resetsAt`         string  ISO 时间戳
- `policyId`         string  窗口标识

百分比计算（官方前端 qu 函数）：
```js
function percentOf(remaining, limit) {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return 0
  return Math.min(100, Math.max(0, remaining / limit * 100))
}
```
注意：这是**剩余百分比**。药丸要显示"已用"，所以展示时用 `usedPercent = 100 - remainingPercent`。
但详情面板两条都显示，避免歧义。

### 4. 认证（路线 B：内嵌登录窗口）
控制台 API 只认浏览器会话 cookie，**不认任何 API key**（已穷举验证）。
登录页有 Cloudflare Turnstile，必须真人操作，无法自动登录。

因此采用：**host 侧拉起带远程调试端口的 Chrome，用户在窗口里登录，host 通过 CDP 收割 cookie**。

#### 登录流程（host 侧实现）
1. `POST /api/opendesign-usage/login` 触发：
   - 选一个空闲本地端口 P
   - 在 `%TEMP%\opendesign-login-<rand>` 建临时 user-data-dir（避免污染用户日常 Chrome）
   - spawn：
     ```
     chrome.exe --remote-debugging-port=P
                --user-data-dir=<tmp>
                --no-first-run --no-default-browser-check
                "https://open-design.ai/cloud/dashboard?workspaceId=<workspaceID>"
     ```
   - Chrome 路径按序探测：
     `C:\Program Files\Google\Chrome\Application\chrome.exe`（已确认存在）
     `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`
     `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
     `C:\Program Files\Microsoft\Edge\Application\msedge.exe`
2. 轮询 `http://127.0.0.1:P/json/list` 直到拿到 `type==="page"` 的 `webSocketDebuggerUrl`
3. 连 WebSocket（Node 24 原生 `globalThis.WebSocket` 可用，已确认）
4. 发 `{"id":1,"method":"Network.getAllCookies"}`
5. 从返回的 cookies 里挑 `domain` 含 `amr-api.open-design.ai`（或 `open-design.ai`）的项，
   拼成 `name=value; name=value` 的 Cookie 头
6. 判定成功条件：存在名字匹配 `session_token` 或 `session` 的 cookie（Better Auth 约定，
   可能是 `better-auth.session_token` 或 `__Secure-better-auth.session_token`）。
   **同时**用这批 cookie 实打实请求一次 `coding-plan-usage`，返回 200 才算真成功。
7. 成功 → 写入配置文件 → 关闭 Chrome（taskkill /pid）→ 清理临时目录
8. 失败 → 保留窗口让用户重试；超过 5 分钟超时则关闭并报 timeout

#### 登录状态查询
`GET /api/opendesign-usage/login/status` 返回
`{ state: 'idle'|'pending'|'success'|'failed', message?, updatedAt? }`

## 配置文件
路径：`$DSH_HOME/opendesign-usage.json`（DSH_HOME 缺省 `~/.dsh`）
```json
{
  "cookie": "better-auth.session_token=...; other=...",
  "workspaceID": "<你的 workspaceId>",
  "cacheTTL": 60,
  "timeoutMs": 10000
}
```
写文件用 mode 0600。**cookie 绝不回传给浏览器**，只回 mask（`••••` + 末4位）。

环境变量覆盖（优先级高于文件）：
- `OPENDESIGN_USAGE_COOKIE`
- `OPENDESIGN_USAGE_WORKSPACE_ID`
- `OPENDESIGN_USAGE_CACHE_TTL`
- `OPENDESIGN_USAGE_TIMEOUT_MS`

默认 workspaceID：`<你的 workspaceId>`（用户当前工作区）

## Host HTTP 路由（全部同源，浏览器直连）
| Method | Path | 说明 |
|---|---|---|
| GET | `/api/opendesign-usage` | 额度快照（走缓存） |
| GET | `/api/opendesign-usage/refresh` | 强制刷新 |
| GET | `/api/opendesign-usage/config` | 脱敏配置 |
| POST | `/api/opendesign-usage/config` | 写配置（body: {cookie?, workspaceID?}） |
| POST | `/api/opendesign-usage/login` | 拉起登录窗口 |
| GET | `/api/opendesign-usage/login/status` | 登录进度 |

## 浏览器可见的数据契约（两端共同遵守）
```ts
interface WindowView {
  kind: 'rolling' | 'weekly' | 'other'   // rolling=5小时, weekly=7天
  label: string                           // '5h' | '7d'
  durationSeconds: number
  remainingPercent: number                // 0-100 整数
  usedPercent: number                     // 0-100 整数
  resetsAt?: string                       // ISO
  resetInSec: number                      // 由 resetsAt 算出的剩余秒数
  status: 'ok' | 'exhausted'
}

interface UsageView {
  updatedAt?: number
  windows?: WindowView[]
  balanceUsd?: string | null
  error?: string          // 'noconfig' | 'unauthorized' | 'http500' | 'timeout' | 'fetch' | ...
  message?: string
}

interface MaskedSecret { set: boolean; tail: string }
interface MaskedConfigView { workspaceID: MaskedSecret; cookie: MaskedSecret }

interface LoginStatus {
  state: 'idle' | 'pending' | 'success' | 'failed'
  message?: string
  updatedAt?: number
}
```

窗口归类规则（按 durationSeconds）：
- `durationSeconds === 18000` → kind `rolling`, label `5h`
- `durationSeconds === 604800` → kind `weekly`, label `7d`
- 其它 → kind `other`, label 由 `durationSeconds/3600` 推出（整除24则 `Nd` 否则 `Nh`）

## 打包格式（关键，照抄参考插件）
DSH 插件是纯文件产物，**不需要构建工具链，直接手写 JS**。

### `lib/index.js` — host 半，普通 ESM
```js
import { Service } from '@deepseek-ai/cordis'
export const name = 'opendesign-usage'
export const inject = ['webServer']
export function apply(ctx, config = {}) { /* 注册 service + 路由 */ }
```

### `lib/client.js` — 浏览器半，必须是这种包装
```js
window.__ModuleLoader__.load({
  id: "dsh-opendesign-usage",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
    let react = require("react");
    let react_jsx_runtime = require("react/jsx-runtime");
    // ... 实现 ...
    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  }
});
```

### 槽位注册（照抄参考插件）
```js
const inject = ['slots', 'locale']
function apply(ctx) {
  ctx.effect(() => ctx.locale.register('odusage', { zh, en }), 'dict')
  ctx.inject(['slots', 'conversation', 'connection'], (scope) => {
    scope.effect(() => scope.slots.register({
      name: 'conversation.input.right',   // 输入框上方工具行
      id: 'opendesign-usage',
      order: 110,
      locale: 'odusage',
    }, DockEntry), 'chip')
  })
}
```

## 药丸 UI（照搬 OcgoDockEntry 形态）
- 收起态：logo + `5h 12% · 7d 82%` + 小箭头
- 悬停 title 提示
- 点击展开详情面板（绝对定位在药丸上方，bottom: calc(100% + 6px)）
  - 每个窗口一行：标签 + 进度条 + `已用 x% · 剩余 y% · 重置于 ...`
  - 底部：`登录` 按钮 + `刷新` 按钮 + 更新时间
- 错误态：显示 `<err:code>`，点击直接展开登录面板
- 颜色阈值：>=50 琥珀、>=70 橙、>=80 红、>=90 红加粗
- 深色模式：监听 `document.body[data-ds-dark-theme]`
- 每 10 秒轮询一次，页面重新可见时立即轮询
- 常量 CSS 用内联 style 或注入 <style>，类名带前缀避免污染

## 安装
```
dsh plugin --profile desktop add link:C:/Users/Administrator/.dsh/plugins/dsh-opendesign-usage
```
profile package.json 里 `dsh.profile.bundles` 也要加上该包名。

## 项目根目录
`C:\Users\Administrator\.dsh\plugins\dsh-opendesign-usage`