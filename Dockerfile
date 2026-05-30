# Stage 1 — Vite frontend (web/dist)
FROM node:20-alpine AS web-build

WORKDIR /app

# web/package.json links "triage-coins": "file:.." — root package.json required for npm ci
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/

RUN npm ci --prefix web

COPY web/ ./web/

RUN npm run build --prefix web

# Stage 2 — production server (tsx, no tsc emit)
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY --from=web-build /app/web/dist ./web/dist

EXPOSE 8080

CMD ["npm", "start"]
