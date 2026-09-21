FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built frontend & server bundle, static assets, memory/data, and runner files
COPY dist/ ./dist/
COPY public/ ./public/
COPY data/ ./data/
COPY local-runner/ ./local-runner/

EXPOSE 3000

CMD ["node", "dist/server.cjs"]
