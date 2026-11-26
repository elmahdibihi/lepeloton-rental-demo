FROM node:24-alpine

WORKDIR /app
COPY package.json server.js db.js stripe.js data.js app.js admin.js leaders.js index.html admin.html leaders.html styles.css seed-club.json ./
COPY assets ./assets

RUN mkdir -p /app/data && chown -R node:node /app

USER node
ENV NODE_ENV=production
ENV PORT=3000
VOLUME ["/app/data"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=4s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
