# Stage 1: Build the frontend
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# In Docker the API is reached through the nginx proxy below
ENV VITE_API_URL=/api
RUN npm run build

# Stage 2: Serve the static files with nginx and proxy /api to the backend
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
