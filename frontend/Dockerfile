# ==========================================
# Frontend Dockerfile for One-Time Link Generator
# Multi-stage: Node build -> Nginx Alpine runtime
# ==========================================

# Stage 1: Build Vite React SPA
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy sources and build configuration
COPY tsconfig*.json ./
COPY vite.config.ts ./
COPY index.html ./
COPY src ./src/

# Compile React bundle
RUN npm run build

# Stage 2: Serve via Nginx
FROM nginx:1.27-alpine AS runner

# Remove default nginx HTML files
RUN rm -rf /usr/share/nginx/html/*

# Copy build artifacts to nginx public directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
