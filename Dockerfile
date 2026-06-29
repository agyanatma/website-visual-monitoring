FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS development-dependencies-env
ENV NODE_ENV=development
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS production-dependencies-env
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS build-env
ENV NODE_ENV=production
COPY --from=development-dependencies-env /app/node_modules ./node_modules
COPY . ./
RUN npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package.json package-lock.json ./
COPY --from=production-dependencies-env /app/node_modules ./node_modules
COPY --from=build-env /app/build ./build
COPY app ./app
COPY migrations ./migrations
COPY public ./public
COPY tsconfig.json ./tsconfig.json

RUN npx playwright install --with-deps chromium \
  && chmod -R 755 /ms-playwright

EXPOSE 3000

CMD ["npm", "run", "start"]
