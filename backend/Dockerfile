# ==========================================
# Backend Dockerfile for One-Time Link Generator
# Uses multi-stage build for minimal production image size
# ==========================================

# Stage 1: Build & compile TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy TypeScript config and source files
COPY tsconfig.json ./
COPY src ./src/

# Generate Prisma Client and compile TypeScript to JS
RUN npx prisma generate
RUN npm run build

# Stage 2: Production runtime
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install openssl for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl

# Copy package manifests and production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --only=production

# Copy compiled files and generated prisma client from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 5000

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5000/api/health || exit 1

CMD ["node", "dist/index.js"]
