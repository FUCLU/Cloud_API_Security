FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

ARG VITE_KEYCLOAK_URL
ARG VITE_KONG_URL
ARG VITE_REALM
ARG VITE_CLIENT_ID

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KONG_URL=$VITE_KONG_URL
ENV VITE_REALM=$VITE_REALM
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID

RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80