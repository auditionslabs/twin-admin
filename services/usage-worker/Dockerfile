# Twin Admin - Usage Aggregation Worker
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
CMD ["node", "src/worker.js"]
