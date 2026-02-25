# Deploying the Churn Prediction API

This project is a FastAPI app that serves churn predictions. Below are several deployment options.

---

## Prerequisites

Before deploying, ensure you have:

- **Trained model artifacts** in `models/`: `churn_model.joblib`, `scaler.joblib`, `feature_columns.json` (and any quantile files your app loads)
- **Data** in `data/`: the dataset your API uses at startup (e.g. for monthly charge quantiles). The path is used in `api/main.py` via `load_and_clean_data()`.

---

## Option 1: Docker (any server or cloud VM)

Your project already has a `Dockerfile`.

### Build and run locally

```bash
# From project root
docker build -t churn-api .
docker run -p 8000:8000 churn-api
```

Then open **http://localhost:8000/docs** for the Swagger UI.

### Deploy to a server (e.g. AWS EC2, DigitalOcean, your own Linux box)

1. Copy the project (e.g. via Git) to the server.
2. Ensure `models/` and `data/` are present (or mount them).
3. On the server:
   ```bash
   docker build -t churn-api .
   docker run -d -p 8000:8000 --name churn-api churn-api
   ```
4. Put a reverse proxy (e.g. **Nginx**) in front of the container and use HTTPS (e.g. Let’s Encrypt).

---

## Option 2: Docker Compose

A `docker-compose.yml` is included for one-command run:

```bash
docker compose up -d
```

API: **http://localhost:8000**. Use `docker compose down` to stop.

---

## Option 3: PaaS (Platform as a Service)

These platforms can run your Dockerfile or detect Python and run the app.

### Railway

1. Sign up at [railway.app](https://railway.app).
2. **New Project** → **Deploy from GitHub** (connect repo).
3. Root directory: project root. Railway will use the **Dockerfile** if present.
4. Ensure `models/` and `data/` are in the repo or add them via **Variables** / **Volumes** if the platform supports it.
5. Set **Port** to `8000` if asked. Railway will assign a public URL.

### Render

1. Sign up at [render.com](https://render.com).
2. **New** → **Web Service** → connect your Git repo.
3. **Build Command:** `pip install -r requirements.txt` (or leave blank if using Docker).
4. **Start Command:** `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
5. If using **Docker**: set **Environment** to **Docker**; Render will use your Dockerfile. Expose `PORT` (Render sets this env var).
6. Add `models/` and `data/` in the repo or via persistent disks if needed.

### Google Cloud Run

1. Install [Google Cloud SDK](https://cloud.google.com/sdk) and run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID`.
2. Build and push the image:
   ```bash
   gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/churn-api
   ```
3. Deploy:
   ```bash
   gcloud run deploy churn-api --image gcr.io/YOUR_PROJECT_ID/churn-api --platform managed --region us-central1 --allow-unauthenticated
   ```
4. Cloud Run will give you a URL. Ensure your app reads `PORT` from the environment (Cloud Run sets it); in the Dockerfile you already use port 8000—Cloud Run can map it, but if you want to be explicit, use `CMD ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", os.environ.get("PORT", "8000")]` or set `PORT=8000` in the service.

### Azure Container Apps / AWS ECS

- Build the image and push to **Azure Container Registry** or **AWS ECR**.
- Create a **Container App** or **ECS service** that runs the image and exposes port 8000.
- Ensure `models/` and `data/` are inside the image (as in your Dockerfile) or mounted from storage.

---

## Option 4: Run without Docker (VPS or shared host)

On a Linux server with Python 3.11:

```bash
cd /path/to/churn-prediction
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn api.main:app --host 0.0.0.0 --port 8000
```

For production, run under **Gunicorn** with Uvicorn workers:

```bash
pip install gunicorn
gunicorn api.main:app -w 2 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```

Use **systemd** or **supervisor** to keep the process running, and Nginx as a reverse proxy for HTTPS.

---

## Checklist before going live

| Item | Check |
|------|--------|
| Model files | `models/churn_model.joblib`, `scaler.joblib`, `feature_columns.json` (and any quantile data) present |
| Data | `data/` with the dataset used by `load_and_clean_data()` |
| Port | App listens on `0.0.0.0` (already in Dockerfile and run command) |
| CORS | If you have a frontend on another domain, CORS is already configured in `api/main.py`; adjust origins if needed |
| Secrets | No API keys or secrets in code; use environment variables and platform secrets |
| Health check | `GET /health` is available for load balancers and monitoring |

---

## Quick reference

| Method        | Command / step |
|---------------|----------------|
| Docker        | `docker build -t churn-api .` then `docker run -p 8000:8000 churn-api` |
| Docker Compose| `docker compose up -d` |
| Railway/Render| Connect repo, use Dockerfile or set start command to uvicorn |
| Cloud Run     | `gcloud builds submit` then `gcloud run deploy` |
| Bare server   | `uvicorn api.main:app --host 0.0.0.0 --port 8000` or gunicorn |
