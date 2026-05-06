# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app

# Supabase env vars (baked into the React build)
ENV VITE_SUPABASE_URL=https://prfcbfumyrrycsrcrvms.supabase.co
ENV VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_ayu87rwh94XQcMt1_1ka_w_hOQy8rZe

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
