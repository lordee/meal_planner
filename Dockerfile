# Base image for building the frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final image
FROM node:20-slim
WORKDIR /app

# Copy backend dependencies and install
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY server/ ./server/
COPY data/ ./data/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port the app runs on
EXPOSE 3001

# Start the application
CMD ["node", "server/index.js"]
