FROM node:20-alpine

WORKDIR /app

# Copy lockfile so install is reproducible and matches Next.js expectations (SWC deps)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-online || npm install --prefer-online

COPY . .

CMD ["npm", "run", "dev"]
