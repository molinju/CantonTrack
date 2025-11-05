# --- Build (Vite) ---
FROM node:20 AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm i
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build

# --- Runtime (Nginx) ---
FROM nginx:alpine
RUN printf 'server { \
  listen 80; \
  root /usr/share/nginx/html; \
  index index.html; \
  location / { try_files $uri /index.html; } \
  location ~* \\.(?:png|jpg|jpeg|gif|svg|ico|css|js|map|woff2?)$ { try_files $uri =404; } \
}\n' > /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

