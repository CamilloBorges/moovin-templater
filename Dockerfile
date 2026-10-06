# Painel + API + script da loja num só contêiner. O servidor roda com tsx (o TypeScript do servidor não é compilado).
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci
COPY . .
RUN npm run build
ENV HOST=0.0.0.0 PORTA=3001 NODE_ENV=production
EXPOSE 3001
USER node
CMD ["npx", "tsx", "server/index.ts"]
