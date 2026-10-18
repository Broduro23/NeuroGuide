# NeuroGuide Model APIs

## Run the API and PostgreSQL in Docker

1. Copy `.env.example` to `.env` and change `DB_PASSWORD` for your local setup.
2. From this directory, start both containers:

   ```sh
   docker compose up --build
   ```

   The `db` service starts PostgreSQL and persists its data in the
   `postgres_data` volume. The API waits for PostgreSQL's health check, runs
   migrations, and serves at <http://localhost:8000>.
3. Stop the containers with `docker compose down`. To also delete database data,
   use `docker compose down -v`.

Compose uses the already-downloaded PostgreSQL image when it exists locally.
The API dependencies are installed inside the API image; packages installed in a
host virtual environment are separate. Docker caches the dependency layer, so
ordinary source changes reuse it. Changing `requirements.txt` or the dependency
install steps causes Docker to install the dependencies again.

PostgreSQL is also published on `localhost:5432` for host tools. If that port is
already in use, change the left side of the `5432:5432` mapping in `compose.yaml`.

The sample credentials are for development only. Use managed secrets and
production Django settings when deploying.
