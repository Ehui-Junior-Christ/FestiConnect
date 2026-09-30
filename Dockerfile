# Image de production FestiConnect (Zeabur, Northflank, Koyeb, Fly.io, VPS...).
# Build :  docker build -t festiconnect .
# Run   :  docker run --rm -p 3000:3000 --env-file .env festiconnect
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /app

# Dependances d'abord (meilleur cache). Le lockfile contient les binaires
# libsql "musl" necessaires sur Alpine.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Code de l'application (voir .dockerignore), possede par l'utilisateur non-root.
COPY --chown=node:node . .

# Utilisateur non-root fourni par l'image officielle node.
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1

# Un seul processus Node (PID 1 recoit SIGTERM directement) :
# migrations idempotentes puis serveur. RUN_MIGRATIONS=false pour les sauter.
CMD ["node", "scripts/start-prod.js"]
