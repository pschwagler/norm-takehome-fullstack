FROM node:20-slim AS base
RUN corepack enable

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Build -- NEXT_PUBLIC_* vars must be present at build time
ARG NEXT_PUBLIC_API_URL=http://localhost:80
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY . .
RUN pnpm build

# Production
FROM node:20-slim AS runner
RUN corepack enable
WORKDIR /app

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
