# https://developers.home-assistant.io/docs/apps/configuration#app-dockerfile
ARG BUILD_FROM=ghcr.io/home-assistant/base:latest

# Base image for building the frontend
FROM node:22-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Final image
FROM ${BUILD_FROM}

# Execute during the build of the image
ARG TEMPIO_VERSION=2021.09.0
ARG TARGETARCH
RUN \
    apk add --no-cache nodejs npm \
    && if [ -z "${TARGETARCH}" ]; then \
        echo "TARGETARCH is not set, please use Docker BuildKit for the build." && exit 1; \
    fi \
    && case "${TARGETARCH}" in \
        amd64) tempio_arch="amd64" ;; \
        arm64) tempio_arch="aarch64" ;; \
        *) echo "Unsupported TARGETARCH: ${TARGETARCH}" && exit 1 ;; \
    esac \
    && curl -sSLf -o /usr/bin/tempio \
        "https://github.com/home-assistant/tempio/releases/download/${TEMPIO_VERSION}/tempio_${tempio_arch}"

WORKDIR /app

# Copy backend dependencies and install
COPY package*.json ./
RUN npm install --production

# Copy backend code
COPY server/ ./server/
COPY data/ ./data/
COPY uploads/ ./uploads/
COPY run.sh ./
RUN chmod a+x run.sh

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose the port the app runs on
EXPOSE 3001

LABEL \
    org.opencontainers.image.title="Home Assistant App: Meal Planner" \
    org.opencontainers.image.description="Meal planner app for Home Assistant." \
    org.opencontainers.image.source="https://github.com/lordee/meal_planner" \
    org.opencontainers.image.licenses="Apache License 2.0"

# Start the application
CMD ["./run.sh"]
