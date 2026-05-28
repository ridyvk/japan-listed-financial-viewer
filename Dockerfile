FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY . .

EXPOSE 4180

CMD ["node", "server.js"]
