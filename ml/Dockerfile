# ml/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (cache layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create models directory
RUN mkdir -p models

# Environment variables (can be overridden at runtime)
ENV MODEL_PATH=models/bias_model_v1.json
ENV MODEL_VERSION=v1
ENV PORT=8080

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8080/health || exit 1

# Run the service
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
