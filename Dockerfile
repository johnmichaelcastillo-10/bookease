# BookEase development image. Production is a static build on Vercel; Docker is for local work.
# There is no database container: BookEase stores its data in the browser (IndexedDB).
FROM node:24-alpine AS base
WORKDIR /app
ENV CI=true
# Install from the lockfile first so dependency layers cache across source edits.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS dev
COPY . .
EXPOSE 5173
# --host 0.0.0.0 so the dev server is reachable from the host through the published port.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

# Production preview: build the static bundle and serve it with `vite preview`.
FROM base AS preview
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
