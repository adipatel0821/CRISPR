# DecisionTwin web (Next.js). Build context: ./web  (compose: dockerfile ../deploy/web.Dockerfile)
# NOTE: written for the compose setup but NOT executed on the build machine (Docker not installed; IMP-006).
# NEXT_PUBLIC_* values are inlined at build time, so the API base is a build argument.
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000
COPY --from=build --chown=node:node /app ./
RUN npm prune --omit=dev
USER node
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
