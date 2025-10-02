# ---------- Build stage ----------
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -q -DskipTests dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

# ---------- Runtime stage ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

COPY --from=build /workspace/target/quarkus-app /app/quarkus-app

EXPOSE 8080

# Run fast-jar
ENTRYPOINT ["java","-jar","/app/quarkus-app/quarkus-run.jar"]
