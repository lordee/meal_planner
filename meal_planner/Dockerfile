ARG BUILD_ARCH=amd64
ARG BUILD_FROM=ghcr.io/home-assistant/${BUILD_ARCH}-base:latest

# Base image for building the frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final image
FROM $BUILD_FROM

# Install NodeJS and NPM
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy backend dependencies and install
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY server/ ./server/
COPY data/ ./data/
COPY run.sh ./
RUN chmod a+x run.sh
RUN mkdir -p uploads

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["./run.sh"]
