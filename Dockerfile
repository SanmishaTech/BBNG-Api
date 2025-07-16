FROM node:18-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Bundle app source
COPY . .

# Generate Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# ------------------- FIX START -------------------
# Set build-time arguments
ARG DATABASE_URL

# Create environment file as root
RUN if [ -n "$DATABASE_URL" ]; then \
      echo "DATABASE_URL=$DATABASE_URL" > /usr/src/app/.env; \
    fi

# Switch to non-root user
USER node
# -------------------- FIX END --------------------

# Expose port and start
EXPOSE 3000
CMD ["node", "server.js"]