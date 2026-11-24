# 时间管理局 - 单容器部署：Node 后端托管前端静态产物 + SQLite
FROM node:22-bookworm-slim

WORKDIR /app

# 先复制依赖清单，利用 layer 缓存
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN cd /app/server && npm install --omit=dev && \
    cd /app/web && npm install

# 复制源码
COPY server ./server
COPY web ./web

# 构建前端（构建产物 server 端会托管）
RUN cd /app/web && npm run build

# 数据目录（compose 挂载卷到这里持久化）
RUN mkdir -p /app/server/data
ENV DB_PATH=/app/server/data/rizi.db \
    PORT=3000 \
    NODE_ENV=production \
    TZ=Asia/Shanghai

EXPOSE 3000
CMD ["node", "/app/server/index.js"]
