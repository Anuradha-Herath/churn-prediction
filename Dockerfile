# Customer Churn Prediction - FastAPI backend
# Build: docker build -t churn-api .
# Run:   docker run -p 8000:8000 churn-api

FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code and artifacts
COPY src/ ./src/
COPY api/ ./api/
COPY models/ ./models/
COPY data/ ./data/

# Expose API port
EXPOSE 8000

# Run the API (host 0.0.0.0 so it's reachable from outside the container)
CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
