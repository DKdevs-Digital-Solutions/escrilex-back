FROM node:20-bookworm-slim

# Prisma precisa do openssl; ca-certificates para chamadas HTTPS (webhook Teams)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instala deps completas (o CLI do prisma fica em devDependencies e é usado
# no `migrate deploy` do start)
COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

ENV NODE_ENV=production
ENV API_PORT=3000
EXPOSE 3000

CMD ["node", "src/server.js"]
