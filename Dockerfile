# Twin Admin - Single-container deploy (API + minimal dashboard)
FROM node:20-alpine

WORKDIR /app

# Minimal API server
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
RUN mkdir -p public && echo '<!DOCTYPE html><html><head><title>Twin Admin</title></head><body><h1>Twin Admin</h1><p>Multi-tenant control platform for SurgiTwin Pro & GlowMorph Studio</p><p>API: <a href="/api/health">/api/health</a></p></body></html>' > public/index.html

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
