# Twin Admin - Single-container deploy (API + minimal dashboard)
FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js scenarios.js motion-templates.js ./
COPY lib/ lib/
COPY public/ public/

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
