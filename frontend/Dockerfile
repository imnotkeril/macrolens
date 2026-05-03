FROM node:20-alpine

WORKDIR /app

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
# Windows CRLF in shell scripts breaks shebang (exec: no such file or directory)
RUN sed -i 's/\r$//' /usr/local/bin/docker-entrypoint.sh && chmod +x /usr/local/bin/docker-entrypoint.sh

# Copy lockfile so install is reproducible and matches Next.js expectations (SWC deps)
COPY package.json package-lock.json* ./
RUN npm ci --prefer-online || npm install --prefer-online

COPY . .

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]
