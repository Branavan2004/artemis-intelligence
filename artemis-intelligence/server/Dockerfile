# Stage 1: Build
FROM node:18-alpine AS builder

# Add openssl for Prisma
RUN apk add --no-cache openssl openssl-dev

WORKDIR /app

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm ci

# Copy prisma schema and generate client
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy the rest of the source and build TypeScript
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

# Add openssl for Prisma runtime
RUN apk add --no-cache openssl

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy prisma schema and generate client for the production environment
COPY prisma/ ./prisma/
RUN npx prisma generate

# Copy compiled code from builder
COPY --from=builder /app/dist ./dist

# Expose the backend port
EXPOSE 4000

# Start the server
CMD ["node", "dist/index.js"]
