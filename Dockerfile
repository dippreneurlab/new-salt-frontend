FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps
RUN npm install -D typescript @types/node

COPY . .
ENV NODE_ENV=production
ENV PORT=8080
RUN npm run build

EXPOSE 8080
CMD ["npm", "start", "--", "-p", "8080"]
