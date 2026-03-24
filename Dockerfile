# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Supabase env vars (baked into the React build)
ENV VITE_SUPABASE_URL=https://euljumeflwtljegknawy.supabase.co
ENV VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV1bGp1bWVmbHd0bGplZ2tuYXd5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5NjYzMTQsImV4cCI6MjA4OTU0MjMxNH0.TAem9XE_b7Sx-rlHpZiU40rXKvwYWCBnqwLlAFYetJk

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
