# Stage 1 — Build React app
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files trước để tận dụng Docker layer cache
COPY package.json package-lock.json ./
RUN npm ci --silent

# Copy source code
COPY . .

# Build production
RUN npm run build

# Stage 2 — Serve bằng nginx
FROM nginx:alpine

# Copy build output vào nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config (file nginx.conf trong thư mục frontend/)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
