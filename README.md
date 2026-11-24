# 时间管理局

单用户、自托管、手机 + 网页双端的**家庭时间事件管理器**。把三类容易忘的事放到一起管：

- **亲人**：生日（公历 / 农历），提前提醒，不知道出生年份也能记
- **物品**：购买日、价格、保修到期，自动算"已用多久"
- **会员**：购买日期 + 时长（N 个月/季/年）自动算到期日、费用，一键"标记已续费"

首页「近期提醒」只显示未来 30 天内需要行动的事，按会员 / 生日 / 保修分三组，不混排。

> 当前是第一期：三张表增删改查 + 近期提醒 + 农历换算 + 自托管部署 + **数据导出导入与自动快照备份**。
> 提醒推送（ntfy）、照片上传留到后续迭代，详见文末路线图。

---

## 一、技术栈

| 层 | 选型 |
|---|---|
| 前端 | React 18 + Vite 6，PWA（可添加到手机主屏幕） |
| 后端 | Node.js 22 + Express |
| 数据库 | SQLite 单文件（better-sqlite3） |
| 农历 | lunar-javascript（闰月按同名平月处理） |
| 部署 | Docker Compose 单容器 |

三张表各自独立，日期规则分开算：生日每年滚动、保修固定不滚动、会员续费后推进一个周期。"近期提醒"是计算出来的视图，不落库。

---

## 二、部署到你的服务器（GitHub + Docker，推荐）

代码托管在 GitHub：`https://github.com/nibaka-coder/rizi.git`

> **用宝塔面板部署？** 直接看 [部署-宝塔面板.md](./部署-宝塔面板.md)，那份文档按图形界面操作写好了，含域名、HTTPS、反向代理的完整步骤。

### 前置条件

一台能跑 Docker 的服务器（Linux 云主机 / 群晖 / NAS 都行），装好 Docker 20+ 与 Docker Compose v2。

```bash
docker --version
docker compose version
```

### 三步上线

```bash
# 1. 从 GitHub 克隆到服务器
cd /www/wwwroot                       # 或你想要的任意目录
git clone https://github.com/nibaka-coder/rizi.git
cd rizi

# 2. 构建并启动（首次会构建镜像，稍微等一会）
docker compose up -d

# 3. 浏览器访问（容器端口只监听本机，需配反向代理；或用 IP 直连见下）
# 配好宝塔反向代理后用 https://你的域名 访问
```

> 容器端口绑定为 `127.0.0.1:3000`（安全考虑，强制走 HTTPS 反代）。若要临时用 `IP:3000` 直连调试，把 compose 里端口改成 `3000:3000` 再 `docker compose up -d`。

首次打开是空数据库（演示数据已清空）。在「近期」页点右上角「＋ 新增」会弹出类型菜单，可选新增亲人 / 物品 / 会员；在亲人、物品、会员各分类页点「＋ 新增」则直接新增对应类型（手机端为右下角悬浮 ＋ 按钮）。

会员录入最省心：只填**购买日期 + 时长 + 单位**（如 2026-05-15、1、年），到期日自动算好，不用自己推算。

> **手机添加到主屏幕**：用手机浏览器打开上面地址 → 浏览器菜单里选"添加到主屏幕"，之后就像一个 App，全屏打开。数据存在服务器，手机和电脑看到的是同一份。

### 首次访问：设置密码（重要）

应用带登录保护，防止他人访问你的数据。第一次打开会进入「设置密码」页面：

1. 输入你想设置的密码（至少 6 位）并确认，即可进入。之后每次打开输入这个密码登录。
2. 如果在 `docker-compose.yml` 里设置了 `SETUP_KEY`，设置密码时还需输入该初始化密钥——建议设置，可防止别人抢先设置密码把你锁在外面。这个密钥只在首次设置时用一次，日常登录用你自己设的密码。
3. 修改密码：进入应用后，打开「数据与备份」→ 底部「安全」→「修改密码」。
4. **忘记密码：可以在服务器上无损重置，数据不会丢**（见下）。

> 登录状态保存 30 天（`SESSION_DAYS` 可调），到期需重新登录。修改密码后所有设备都需要重新登录。连续输错密码 5 次会锁定 15 分钟，防止暴力破解。

### 忘记密码怎么办（无损重置）

登录密码可以重置，**亲人、物品、会员数据一律不动**：

```bash
# 普通部署（在项目 server 目录）
cd server && npm run auth:reset -- 你的新密码

# Docker 部署（在服务器上，项目目录内）
docker compose exec rizi npm run auth:reset -- 你的新密码
```

重置后所有设备的登录会话立即失效，用新密码重新登录即可。可加 `--dry-run` 预览（不改动）：`npm run auth:reset -- --dry-run 新密码`。

> 密码以加盐哈希（scrypt）存在数据库里，无法反推明文，所以只能"重置"不能"找回"——但重置不需要清空数据。

### 常用运维命令

```bash
docker compose logs -f rizi          # 看实时日志
docker compose restart rizi          # 重启
docker compose ps                    # 看运行状态
docker compose down                  # 停止（数据不丢）
docker compose up -d --build         # 改了代码后重新构建并启动
```

### 改配置

编辑 `docker-compose.yml` 的 `environment`，改完执行 `docker compose up -d` 重建容器生效：

| 变量 | 说明 | 默认 |
|---|---|---|
| `APP_NAME` | 应用名（标题 + 侧边栏） | 时间管理局 |
| `UPCOMING_DAYS` | 近期提醒窗口天数 | 30 |
| `BACKUP_DIR` | 自动快照目录（在挂载卷内） | `/app/server/data/backups` |
| `BACKUP_KEEP` | 保留最近几份快照 | 7 |
| `BACKUP_HOUR` | 每天几点后执行当日快照 | 3 |
| `BACKUP_ON_START` | 启动时若当天无快照则补一份 | true |
| `SETUP_KEY` | 首次设置密码时的初始化密钥（防抢注），留空则不要求 | 空 |
| `SESSION_DAYS` | 登录状态有效天数 | 30 |
| `COOKIE_SECURE` | Cookie 安全标志，HTTPS 保持 true，本地 HTTP 调试改 false | true |

### 反向代理 + HTTPS（可选）

如需用域名访问，用 Nginx / Caddy 反代到 `3000` 端口。Caddy 示例（自动申请 HTTPS 证书）：

```
rizi.你的域名.com {
    reverse_proxy localhost:3000
}
```

---

## 三、数据备份与恢复（重要）

数据是你最宝贵的东西，本应用提供三层保障：

### 1. 自动快照（服务器本地，默认开启）

服务每天按 `BACKUP_HOUR` 之后生成一份 SQLite 一致性快照到 `data/backups/rizi-YYYY-MM-DD.db`，自动保留最近 7 份。即使误删数据，也能从昨天的快照恢复。

在网页「数据与备份」设置里可以看到快照列表，或点「立即生成快照」手动打一份。

### 2. 手动导出 JSON（推荐定期下载到网盘）

网页右上角 ⚙ → 「数据与备份」→「下载备份文件」，得到一个包含全部数据的 JSON 文件。**建议每周下载一次存到网盘或另一台设备**——这样即使服务器整个挂了，数据也能找回来。

### 3. 恢复数据

网页「数据与备份」→「导入恢复」，选择之前导出的 JSON 文件：

- **合并**（默认）：保留现有数据，只补进备份里没有的记录（按 id 判断），适合误删后找回
- **覆盖**：清空现有数据后完整恢复，适合换服务器、迁移数据（会二次确认）

恢复后立即生效，无需重启。

### 命令行恢复快照（服务器本地）

若整个数据库损坏，用某天的 SQLite 快照直接替换：

```bash
# 先停服务
docker compose down
# 用快照覆盖主库
cp data/backups/rizi-2026-11-23.db data/rizi.db
# 再启动
docker compose up -d
```

### 清空演示 / 重新开始

```bash
cd server && npm run db:reset          # 清空三张表（保留表结构）
cd server && npm run db:reset -- --dry-run   # 先看会清掉多少条，不真的删
```

> 原始开发时的演示数据已经清空，新部署是空库。此命令用于你以后想推倒重来。

---

## 四、升级到新版本

```bash
cd /www/wwwroot/rizi
git pull                      # 拉取 GitHub 上的最新代码
docker compose up -d --build # 重建镜像并重启
```

数据存在 `data/` 卷里，升级不会丢。**升级前建议先手动下载一份 JSON 备份**以防万一。
若需回滚：`git log --oneline` 找到旧提交号 → `git checkout <提交号>` → `docker compose up -d --build`。

---

## 五、本地开发

```bash
# 后端（:3000）
cd server && npm install && npm run dev

# 前端（:5173，自动代理 /api 到 3000）
cd web && npm install && npm run dev
```

浏览器打开 `http://localhost:5173`。

日期算法有单元测试：

```bash
cd server && npm test
```

---

## 六、目录结构

```
rizi/
├── server/                 后端
│   ├── index.js            启动入口（含定时备份调度）
│   └── src/
│       ├── config.js       应用名、分类、窗口天数、备份等可配置常量
│       ├── db.js           SQLite 三张表结构
│       ├── app.js          Express 路由（CRUD + 聚合 + 续费 + 备份）
│       ├── routes/crud.js  通用增删改查
│       ├── services/
│       │   ├── dates.js    ★ 日期算法（农历/滚动/保修/倒计时）
│       │   └── backup.js   ★ 数据导出导入 + SQLite 快照
│       └── scripts/reset-db.js  清空数据脚本
├── web/                    前端 PWA
│   ├── src/
│   │   ├── App.jsx         主程序 / 导航 / 状态
│   │   ├── pages.jsx       四个页面
│   │   ├── forms.jsx       三类登记表单
│   │   ├── detail.jsx      详情弹窗
│   │   ├── settings.jsx    数据与备份设置
│   │   └── styles.css      样式（响应式：桌面侧栏 / 手机底栏）
│   └── public/             PWA manifest / service worker / 图标
├── data/                   SQLite 数据 + 快照（运行时生成，已 gitignore）
├── Dockerfile
└── docker-compose.yml
```

---

## 七、路线图

- **第一期（已实现）**：三张表 CRUD + 近期提醒首页 + 农历 + 自托管部署 + 数据导出导入与自动快照
- **第二期（候选）**：照片上传（亲人头像 / 物品照片 / 小票）、一键"已维护"、提醒规则按条目自定义
- **第三期（看需求）**：ntfy / 邮件到期推送、日历订阅链接（iCal）、OCR 识别小票、深色模式

---

## 附：数据模型要点

- **亲人**：`calendar`(lunar/solar) + 月日；`birth_year` 可空（长辈只记月日也能用）；农历闰月按同名平月处理
- **物品**：`purchase_date` 是一切起点；`warranty_months` 填月数，到期日 = 购买日 + N 月（不手填，月末自动收敛，如 1/31 + 1 月 = 2/28）；"已用时长"实时算，不存库
- **会员**：`purchase_date` 购买日 + `duration` 时长 + `cycle`(月/季/年)；到期日 = 购买日 + 时长×周期月数，写入时自动算好存进 `expiry_date`（月末自动收敛），前端不用手填；"标记已续费"在当前到期日基础上再延长一个时长，并同步更新购买日。旧数据（只有 `expiry_date`）自动兼容，读取时沿用已存到期日
- 时区统一按 `Asia/Shanghai` 算"今天"
- 备份 JSON 结构带 `format: rizi-backup` 标识与版本号，便于未来兼容升级
