# Twin Admin - Single-container deploy (API + minimal dashboard)
FROM node:20-alpine

WORKDIR /app

# Minimal API server
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public/ public/

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
