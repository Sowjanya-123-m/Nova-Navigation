# Nova Navigation

Real-Time Routing & VRP Engine with authentication, database persistence, REST APIs, containerization, and cloud deployment assets.

## Features
- Live map routing with Leaflet + OpenStreetMap
- User login and registration
- Database-backed stops, vehicles, and saved routes
- CRUD APIs for stops, vehicles, and saved routes
- Responsive UI for desktop and mobile
- Voice turn-by-turn navigation and analytics
- Docker, Kubernetes, CI/CD, and AWS deployment files

## How to run locally
```bash
pip install -r requirements.txt
python run.py
```
Then open http://localhost:5000/login to access the app.

## Test
```bash
pytest -q
```

## Deploy
- Render: use render.yaml and Procfile
- Azure: use azure.yaml
- Docker: use Dockerfile and docker-compose.yml
- Kubernetes: apply the YAML files in the k8s folder

## Notes
- SQLite is used by default for local development.
- For production, set DATABASE_URL and SECRET_KEY appropriately.
