# Stage 1 — Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci --silent
COPY frontend/ ./
RUN npm run build

# Stage 2 — Build backend (copies frontend dist into static resources)
FROM eclipse-temurin:21-jdk-alpine AS builder
WORKDIR /build
COPY pom.xml .
COPY src ./src
COPY --from=frontend-builder /app/dist/ ./src/main/resources/static/
RUN apk add --no-cache maven && mvn package -DskipTests -q

# Stage 3 — Runtime
FROM eclipse-temurin:21-jre-alpine AS runtime
WORKDIR /app
COPY --from=builder /build/target/server-0.0.1-SNAPSHOT.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", \
  "-XX:TieredStopAtLevel=1", \
  "-Xms128m", "-Xmx384m", \
  "-jar", "app.jar"]
