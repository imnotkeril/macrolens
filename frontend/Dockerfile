FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --prefer-online

COPY . .

CMD ["npm", "run", "dev"]
