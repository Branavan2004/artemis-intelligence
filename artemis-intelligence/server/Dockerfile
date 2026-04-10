# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install ALL dependencies
COPY package*.json ./
RUN npm ci

# Copy source and config
COPY . .

# Generate Prisma client and build TypeScript
RUN npm run db:generate
RUN npm run build

# Stage 2: Production
FROM node:18-alpine

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled code and prisma schema
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the backend port
EXPOSE 4000

# Start the server
CMD ["node", "dist/index.js"]
