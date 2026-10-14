FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY server/package.json server/package.json
COPY client/package.json client/package.json
RUN npm ci
COPY server server
COPY client client
COPY database database
RUN npm run build
ENV NODE_ENV=production
USER node
WORKDIR /app/server
EXPOSE 4100
CMD ["npm","start"]
