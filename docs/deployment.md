# 运行与部署

## 当前机器

项目按要求位于 `/costage`，与 `/root` 同级，不依赖原来的 `/root/project/model.py`。

应用由 Supervisor 托管，监听 `127.0.0.1:3001`。按用户公开访问要求，增加两个独立入口：

- HTTPS：https://lights-engage-preliminary-difficulty.trycloudflare.com
- 公网 IP：http://116.127.115.18:21282（映射容器端口 10200）

两个入口均允许匿名浏览，账号写入操作仍要求登录。原来的 VS Code Ports 转发和 SSH 本地转发也可以使用。

```bash
supervisorctl status costage
supervisorctl restart costage
```

部署更新：

```bash
cd /costage
npm ci
npm run build
supervisorctl restart costage
```

本机配置样例位于 `deployment/`。原始 Vast 环境的管理服务保持不变。独立 `costage-public` Caddy 进程提供公网 10200 端口反代；`costage-https` Cloudflare Quick Tunnel 提供 HTTPS，不要求服务器管理口令。只信任 loopback 反代的客户端地址，用于 HTTP 限流。

```bash
supervisorctl status costage costage-public costage-https
```

Quick Tunnel 是临时入口，重启或断线重建可能更换地址。更换后从 `/var/log/portal/costage-https-tunnel.log` 找到新 `https://*.trycloudflare.com` 地址，将 `.env` 中对应 `ALLOWED_ORIGINS` 更新后重启 `costage`，再分享新地址。生产运营应绑定自有域名和固定隧道或 HTTPS 反向代理。IP 入口在该实例与端口映射保留期间有效。

## 环境变量

| 变量            | 默认                   | 说明                                          |
| --------------- | ---------------------- | --------------------------------------------- |
| HOST            | 127.0.0.1              | 监听地址                                      |
| PORT            | 3001                   | 网页/API/Socket 共用端口                      |
| DATABASE_PATH   | ./data/costage.sqlite  | 数据库路径，以项目根目录为工作目录            |
| COOKIE_SECURE   | false                  | 对外 HTTPS 时改为 true                        |
| ALLOWED_ORIGINS | localhost 的 3001/5173 | 逗号分隔的实际浏览器 Origin，协议与端口要一致 |
| ICE_SERVERS     | []                     | RTCIceServer JSON 数组                        |

HTTPS 反向代理需要转发 WebSocket Upgrade，且保留浏览器实际 Origin。反代后的用户级/IP限流需要依据真实代理层级配置 Express trust proxy；不能无条件信任任意来源的 X-Forwarded-For。

## 直播服务器分发（当前默认）

设置 `MEDIA_TRANSPORT=hls`，安装 FFmpeg（libx264 + AAC）。主播通过现有 WebSocket 上传，观众通过现有 HTTPS 入口观看，不需要额外端口或 TURN。`FFMPEG_PATH` 指定程序路径，`MEDIA_PATH` 指定临时片段目录，`MAX_LIVE_STREAMS` 默认 4。直播结束后片段会被删除，不是长期录像。

已验证公网 HTTPS/IP 入口的 HLS 播放和声音开关，并在禁用 WebRTC 的自动测试中验证持续播放和中途加入。真实手机浏览器兼容性及大规模观众容量还需要独立验证。

## 可选 WebRTC 直连模式

只有设置 `MEDIA_TRANSPORT=webrtc` 时才需要本节配置。localhost 上两浏览器可直接测试；跨网络通常需要 TURN，中继服务不会由此项目自动创建。

```dotenv
ICE_SERVERS='[{"urls":"stun:your-stun.example:3478"},{"urls":"turn:your-turn.example:3478","username":"temporary-user","credential":"temporary-credential"}]'
```

这是格式示例，域名和凭证不可直接使用。ICE 配置需要发送给浏览器，所以不能把长期管理员密钥填进去。正式部署应在登录后的配置端点签发短期 TURN 凭证，并限制额度。

主播上行带宽约为单路编码码率乘以观众数。当前直接连接拓扑只面向小规模试点；不能把「100 个预约席位」解读为已验证的 100 人实时视频容量。扩大直播规模前接入 SFU/云直播并进行容量测试。

## 容器（在支持 Docker 的其他环境中使用）

本机是受限容器，不在本机嵌套运行 Docker。提供的 Dockerfile 供独立服务器或容器平台部署：

```bash
docker build -f deployment/Dockerfile -t costage .
docker run --rm -p 127.0.0.1:3001:3001 \
  -v costage-data:/app/data \
  -e ALLOWED_ORIGINS=http://localhost:3001 \
  costage
```

容器内监听 0.0.0.0，示例只将主机 localhost 暴露出来。首次使用挂载卷必须能由容器中的 node 用户写入。

## 数据备份

默认 SQLite WAL 模式。运行中的数据库应使用 SQLite 在线备份接口，而不是只复制主文件漏掉 WAL。可在维护窗口停止 `costage` 后备份整个 `data/` 目录，再恢复服务。

Vast 实例 stop/start 与销毁/回收的持久性不同；`/costage` 路径本身不代表持久卷。重要代码与数据库应另行备份到自己的持久存储。项目未自动推送任何远程仓库或上传用户数据。

## 上线前需完成的工程工作

账号邮箱验证和恢复、后台角色与审核处理、文件对象存储、版本化数据库迁移、分页与容量测试、生产告警、备份恢复演练，以及按经营地区与业务范围完成上线要求评估。商业化和 AI 需要独立接入服务与验证，不在此 MVP 中假设可用。
