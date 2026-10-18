# NeuroGuide Model APIs

NeuroGuide Model APIs is a Django REST Framework backend for caregiver accounts, child profiles, text classification, developmental scoring, and age- and goal-based learning content recommendations. PostgreSQL stores users, child profiles, and submitted learning content.

## Features

- Register accounts, obtain and refresh JSON Web Tokens (JWTs), and view or update the authenticated user's profile.
- Create and manage child profiles. Each caregiver can access only their own child profiles.
- Classify text as safe or unsafe and return the model confidence.
- Score text against 20 developmental domains and return probabilities and domains at or above a 0.5 threshold.
- Submit learning content for safety and developmental assessment. Submissions are stored in PostgreSQL; only safe, fully assessed content is marked eligible for recommendations.
- List eligible content, retrieve individual content records, edit or delete records, and request ranked recommendations filtered by age and developmental goals.
- Accept plain text in JSON or `.txt` uploads for the prediction and content submission endpoints.

## Run with Docker Compose

From this directory:

```sh
cp .env.example .env
docker compose up --build -d
```

The API is served at <http://localhost:8000>. Postgres is published to the host on port `5433`; inside the Compose network, the API connects to `db:5432`. The database data persists in the `postgres_data` volume.

Useful commands:

```sh
docker compose ps
docker compose logs -f neuroguide-api db
docker compose restart neuroguide-api
docker compose down
```

The API container runs Django migrations when it starts. If you change a model, generate and apply its migration from the API container:

```sh
docker compose exec neuroguide-api python manage.py makemigrations RecEngine
docker compose exec neuroguide-api python manage.py migrate
```

On Linux systems where Docker requires elevated privileges, prefix these commands with `sudo`.

To remove the database volume and all stored database data, run `docker compose down -v`.

## Configuration and model files

Compose reads database settings from `.env`. The development defaults are in `.env.example`; change the sample password for your local setup. The API service uses the same database settings and connects to the Postgres service by its Compose name, `db`.

The prediction modules expect these local files:

- `models/safety_classification/tokenizer.json`
- `models/safety_classification/tokenizer_config.json`
- `models/safety_classification/bertsafety_classification.pth`
- `models/dev_assessment/tokenizer.json`
- `models/dev_assessment/tokenizer_config.json`
- `models/dev_assessment/dev_assessment.pth`

Both modules initialize their tokenizer and model when Django imports the views. They also load the `bert-base-uncased` architecture through Transformers; it may need to be available in the Hugging Face cache or downloaded when the container starts. Missing or incompatible model files prevent prediction features from working and may prevent the API from starting.

## API base URL and authentication

All API routes are prefixed with:

```text
http://localhost:8000/ModelAPIs/RecEngine/
```

The project does not define a route for `/`, so visiting `http://localhost:8000/` returns 404. Use the endpoint paths below.

Registration and login are public. Login returns `access` and `refresh` JWTs. For protected endpoints, send the access token in this header:

```http
Authorization: Bearer <access-token>
```

Protected endpoints include profile, child profile, and content library/detail routes. Prediction and recommendation endpoints are currently public.

## Routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/register/` | Public | Create a user account. |
| `POST` | `/login/` | Public | Obtain JWT access and refresh tokens. |
| `POST` | `/refresh/` | Public | Exchange a refresh token for a new access token. |
| `GET`, `PUT`, `PATCH` | `/profile/` | JWT | Retrieve or update the current user's profile. |
| `GET`, `POST` | `/children/` | JWT | List the current user's children or create a child profile. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/children/<id>/` | JWT | Retrieve or manage one of the current user's child profiles. |
| `POST` | `/predict/` | Public | Return developmental probabilities and predicted domains for text. |
| `POST` | `/safety/predict/` | Public | Classify text as safe or unsafe and return confidence. |
| `GET`, `POST` | `/content/` | JWT | List eligible content or submit and assess new content. |
| `GET`, `PATCH`, `DELETE` | `/content/<id>/` | JWT | Retrieve, update, or delete a content record. Changes to text or age range reset assessment results and eligibility. |
| `POST` | `/recommend/` | Public | Find ranked eligible content for an age and one or more learning goals. |
| `GET` | `/admin/` | Django admin | Open the Django administration site. |

For example, the login endpoint is `http://localhost:8000/ModelAPIs/RecEngine/login/`.

## Request examples

### Register

Send JSON to `POST /register/`:

```json
{
  "username": "caregiver1",
  "email": "caregiver@example.com",
  "password": "a-strong-password",
  "password2": "a-strong-password"
}
```

### Log in and use a protected route

Send JSON to `POST /login/`:

```json
{
  "username": "caregiver1",
  "password": "a-strong-password"
}
```

Use the returned `access` token on a protected request:

```sh
curl http://localhost:8000/ModelAPIs/RecEngine/profile/ \
  -H 'Authorization: Bearer <access-token>'
```

### Create a child profile

Send an authenticated `POST /children/` request:

```json
{
  "display_name": "Child",
  "age_months": 36,
  "learning_goals": ["number_identification"],
  "interests": ["puzzles"],
  "notes": "Optional notes"
}
```

Age must be between 0 and 83 months. The API assigns the authenticated user as caregiver.

### Predict developmental domains or safety

Send JSON with a non-empty `text` field to `POST /predict/` or `POST /safety/predict/`:

```json
{
  "text": "The child identifies numbers while playing a counting game."
}
```

Both endpoints also accept a `.txt` upload using the form field `file`. Prediction uploads are limited to 1 MB and must be UTF-8. Developmental prediction returns probabilities keyed by domain and a `predicted_domains` list for scores of at least `0.5`. Safety prediction returns a classification and confidence.

### Submit content for assessment

Send an authenticated JSON `POST /content/` request with `text` or upload a `.txt` file:

```json
{
  "title": "Counting through play",
  "text": "Count objects together and name each number.",
  "age_min": 24,
  "age_max": 48,
  "content_type": "activity"
}
```

The API checks safety first. Developmental scoring runs only when content is classified as safe. Content is recommendation-eligible only after both assessments complete successfully. Content text is limited to 100,000 characters; uploaded files are limited to 2 MB and must be UTF-8 `.txt` files.

### Request recommendations

Send JSON to `POST /recommend/`:

```json
{
  "age": 36,
  "learning_goals": ["number_identification", "working_memory"],
  "top_n": 5
}
```

Age is in months (0–83). Learning goal names must match the model labels, such as `number_identification`, `working_memory`, `expressive_language`, or `self_regulation`. Results include relevance scores and per-goal scores. Only safe, fully assessed, eligible content matching the requested age and goals can be returned.

## Database inspection

Open a Postgres prompt using the credentials loaded in the database container:

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

At the `psql` prompt, `\dt` lists tables. Registered accounts are stored in `auth_user`; child profiles are stored in `RecEngine_childprofile`; assessed learning content is stored in `RecEngine_content`.

## Development notes

- The API source directory is bind-mounted into the container, so Python source changes are visible without rebuilding the image. Rebuild after changing dependencies or the Dockerfile with `docker compose up --build -d`.
- The provided Compose and Django settings are for local development. Configure production secrets, allowed hosts, HTTPS, and a production-grade application server before deployment.
