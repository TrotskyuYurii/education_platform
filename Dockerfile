# Образ «Навчального порталу ВІАТЕК»: Express API + зібраний React в одному процесі.
# Розгортання описане в DEPLOY.md.

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Після збірки лишаємо тільки runtime-залежності. tsx серед них навмисно:
# міграції (scripts/migrations/*.ts) запускаються ним при старті контейнера.
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Вихідники потрібні лише міграціям: вони імпортують моделі з server/ напряму.
COPY --from=build /app/tsconfig.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts ./scripts
COPY deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
LABEL org.opencontainers.image.source="https://github.com/viasecurity/education-platform"

# multer складає сюди завантаження до обробки; після імпорту файли видаляються,
# а постійне сховище — GridFS у базі, тож окремий volume не потрібен.
RUN mkdir uploads && chown node:node uploads

USER node
EXPOSE 3000

# Здоровим вважаємо лише процес із живим підключенням до бази.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>r.json()).then(j=>process.exit(j.dbConnected?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
