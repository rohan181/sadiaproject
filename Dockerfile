# Runs the AccessBD Next.js/vinext frontend. Serves the dashboard-ready
# outputs already committed under public/data/ — no Postgres connection
# needed for this container (see compose.yaml's postgis service for the
# separate spatial pipeline).
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
RUN npm config set fetch-retries 5 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm ci

COPY . .
RUN WRANGLER_LOG_PATH=.wrangler/wrangler.log npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start"]
