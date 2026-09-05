# API 与事件

返回 JSON，错误格式为 `{ "error": "面向用户的说明" }`。写入请求要求同源，标记「登录」的接口使用 HttpOnly 会话 Cookie。无默认账号，首次使用自行注册。

| 方法 | 路径                            | 登录 | 说明                                      |
| ---- | ------------------------------- | ---- | ----------------------------------------- |
| GET  | /api/health                     | 否   | 健康状态                                  |
| GET  | /api/bootstrap                  | 否   | 当前用户、活动、圈子、作品                |
| POST | /api/auth/register              | 否   | name / email / password；密码至少 8 位    |
| POST | /api/auth/login                 | 否   | email / password                          |
| POST | /api/auth/logout                | 否   | 销毁当前会话                              |
| GET  | /api/activities/:id             | 否   | 活动、个人投票、最近 100 条聊天           |
| POST | /api/activities                 | 是   | 创建活动，返回 id                         |
| POST | /api/activities/:id/reservation | 是   | 切换预约，满额 409、结束后 409            |
| POST | /api/activities/:id/vote        | 是   | choice 0–2，只在 live 状态开放            |
| POST | /api/activities/:id/report      | 是   | reason 5–500 字符，保存待处理反馈         |
| POST | /api/circles/:id/membership     | 是   | 切换圈子加入状态                          |
| POST | /api/works                      | 是   | title / description / image / activityId? |
| POST | /api/works/:id/like             | 是   | 切换作品喜欢状态                          |
| GET  | /api/rtc-config                 | 否   | 客户端 ICE 配置                           |

创建活动示例：

```json
{
  "title": "一起设计一张秋日海报",
  "description": "从配色、排版到最终作品，一起完成一次设计练习。",
  "category": "视觉设计",
  "startsAt": "2027-01-01T12:00:00.000Z",
  "duration": 60,
  "seats": 20,
  "tasks": ["寻找灵感", "动手制作", "分享成果"]
}
```

时间为 UTC ISO 8601，页面按浏览器时区显示。有效分类：视觉设计 / 手作生活 / 摄影影像 / 音乐现场 / 灵感闲聊。duration 15–240，seats 2–100，tasks 1–6 条。

作品 image 接受 PNG/JPEG/WebP 的 base64 data URL，不接受 SVG/任意 URL。页面上传限制 1 MiB，服务端对应 data URL 长度上限 1,500,000 字符；超过请求体限制的请求会被拒绝。

## Socket.IO

同源 `/socket.io`。房间是活动 id，加入新房间前离开旧房间。

| 方向            | 事件                        | 数据                                   |
| --------------- | --------------------------- | -------------------------------------- |
| 客户端 → 服务端 | room:join                   | activityId                             |
| 客户端 → 服务端 | chat:send                   | text，ack 返回 ok 或 error             |
| 服务端 → 房间   | chat:message                | id/userId/author/color/text/createdAt  |
| 服务端 → 房间   | poll:update                 | 投票总数，个人选择由客户端或 HTTP 获取 |
| 服务端 → 房间   | catalog:update              | 提醒客户端重取活动状态                 |
| 主播 → 服务端   | broadcast:start             | ack 返回 ok 或 error                   |
| 主播 → 服务端   | broadcast:stop              | 无                                     |
| 服务端 → 主播   | viewer:joined / viewer:left | socketId                               |
| 双向信令        | rtc:signal                  | target/from、description 或 candidate  |
| 服务端 → 房间   | broadcast:ended             | 无                                     |

聊天室允许匿名阅读、要求登录发言。每人每条消息最大 500 字符，当前连接每次发送至少间隔 800ms。生产规模下需要补充跨连接的用户级限流和反垃圾策略。

## HTTPS 直播上传

默认 hls 模式中，`broadcast:start` 传入 `{ mime }` 并提供 ack。支持约定的 WebM（VP8/VP9 + Opus）和 MP4 类型。服务端确认后，主播按顺序发送 `media:chunk` 二进制包并等待 ack；不允许观众上传。编码失败时发送 `broadcast:error` 并结束广播。

观众读取 `index.m3u8` 和其引用的 `segmentNNNNNN.ts`，接口设置 no-store；播放请求不占用通用 JSON API 的限流额度。
