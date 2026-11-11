# NeuroGuide Model APIs

NeuroGuide Model APIs is a Django REST Framework backend for caregiver accounts, child profiles, text classification, developmental scoring, and age- and goal-based learning content recommendations. PostgreSQL stores users, child profiles, and submitted learning content.

## Features

- Register accounts, obtain and refresh JSON Web Tokens (JWTs), and view or update the authenticated user's profile.
- Assign role based access for administrators, caregivers/parents, and content providers.
- Create and manage child profiles. Each caregiver can access only their own child profiles.
- Classify text as safe or unsafe and return the model confidence.
- Score text against 21 developmental domains and classify its overall suitability.
- Submit text, audio, and video learning content for safety and developmental assessment. Audio and video use their safe speech transcripts to produce developmental scores and suitability classifications.
- Manage the full content library: list and retrieve records, update or delete them, and rerun assessments.
- Request ranked recommendations using a caregiver's saved child profile.
- Persist recommendation history with a snapshot of the child, goals, and returned content; record views, clicks, saves, completions, dismissals, and caregiver feedback.
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

## Automated testing and checks

Run both checks from the project root while the Compose services are running:

```sh
docker compose exec neuroguide-api python manage.py test
docker compose exec neuroguide-frontend npm run lint
```

The Django command runs the backend suite in the API container. Tests cover registration and authentication, profiles and child ownership, prediction endpoints, text and media uploads and assessment outcomes, recommendation eligibility and age/goal matching, history filtering, feedback, and safe activity events. Model inference and Celery dispatch are mocked, so these tests do not need model weights, Hugging Face access, Redis, or a worker. The lint command runs in the frontend container and checks code style and common errors; it is not a UI behavior test. The project currently has no frontend test runner configured.

After the Django suite completes, the custom test runner writes `test_results.xlsx` in the project root with one row per test and the columns `Test Name`, `Purpose`, and `Status` (`PASS` or `FAIL`). Skipped tests are reported as `FAIL` and include the skip reason in the purpose column because they did not pass.

The same Compose stack starts the Next.js frontend at <http://localhost:3000>, Redis, and one Celery media worker. The API and worker share the persistent `media_files` volume. The API image installs FFmpeg/ffprobe and Python dependencies from `requirements.txt`; the project and model files are supplied by the Compose bind mount. PyTorch is CPU-only. Frontend requests can use the `NEXT_PUBLIC_API_BASE_URL` value (`/api/ModelAPIs/RecEngine`); Next.js proxies those requests to Django using `API_INTERNAL_BASE_URL`, so browser requests stay same-origin.

Video frame safety checks run locally with the Transformers image-classification pipeline. The worker downloads `HF_NSFW_MODEL` from Hugging Face on its first video assessment and stores a persistent copy in `./model_cache/nsfw_image_detection`, which is mounted into the worker at `/models/nsfw_image_detection`. The public default model does not require `HF_TOKEN`; set it only if the selected model requires authentication. A video is flagged by its sampled frames when at least `MEDIA_NSFW_MIN_FLAGGED_FRAMES` frames meet the `HF_NSFW_THRESHOLD` (default: two frames at 0.5). Audio transcription runs locally with open-source faster-whisper; its model downloads on first use and is cached in the `whisper_cache` Docker volume. The defaults use the multilingual `tiny` model with CPU INT8, two CPU threads, and beam size one. Set `WHISPER_MODEL_SIZE` to `base` or `small` for higher transcription accuracy at greater memory and latency cost. Media limits are configurable with `MEDIA_MAX_UPLOAD_BYTES`, `MEDIA_MAX_DURATION_SECONDS`, `MEDIA_FRAME_INTERVAL_SECONDS`, and `MEDIA_MAX_FRAMES`; visual model settings use `HF_NSFW_MODEL` and `HF_NSFW_THRESHOLD`. One worker processes one media job at a time; within a job, audio and visual checks run concurrently. Frames are sampled across the clip, increasing the interval if needed to stay within the frame cap. Brief scenes between sampled frames may still be missed.

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

The API loads these models on first use of a text prediction or text assessment endpoint. The single media worker loads them when it starts. Both use the `bert-base-uncased` architecture through Transformers; it may need to be available in the Hugging Face cache or downloaded when the container starts. Missing or incompatible model files prevent prediction and media assessment from working.

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

Protected endpoints include profile, child profile, content library/detail routes, and recommendation/history routes. The standalone prediction endpoints remain public.

For browser use, open a browsable API endpoint such as `/ModelAPIs/RecEngine/children/` and use the page's **Log in** link. This signs into the browsable API with a Django session; a JWT does not need to be pasted into browser forms. The same API continues to accept JWT bearer tokens from clients such as Postman or `curl`.

## Routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/register/` | Public | Create a user account. |
| `POST` | `/login/` | Public | Obtain JWT access and refresh tokens. |
| `POST` | `/refresh/` | Public | Exchange a refresh token for a new access token. |
| `GET`, `POST` | `/api-auth/login/` | Django session | Sign in or out of the browsable API in a browser. |
| `GET`, `PUT`, `PATCH` | `/profile/` | JWT | Retrieve or update the current user's profile. |
| `GET`, `POST` | `/children/` | JWT | List the current user's children or create a child profile. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/children/<id>/` | JWT | Retrieve or manage one of the current user's child profiles. |
| `POST` | `/predict/` | Public | Return developmental probabilities and predicted domains for text. |
| `POST` | `/safety/predict/` | Public | Classify text as safe or unsafe and return confidence. |
| `GET`, `POST` | `/content/` | JWT | List all stored content records or submit and assess new content. |
| `GET`, `PATCH`, `DELETE` | `/content/<id>/` | JWT | Retrieve, update, or delete a content record. Changes to text or age range reset assessment results and eligibility. |
| `POST` | `/content/<id>/assess/` | JWT | Rerun safety assessment; developmental scoring applies to text content. |
| `POST` | `/recommend/` | JWT | Generate recommendations for one of the caregiver's saved child profiles and record the result in history. |
| `GET` | `/recommend/history/` | JWT | List the caregiver's recommendation history; optionally filter with `?child_id=<id>`. |
| `POST` | `/recommend/history/<history_id>/feedback/` | JWT | Add or update a 1–5 rating and optional text feedback for a result. |
| `POST` | `/recommend/history/<history_id>/activity/` | JWT | Record a content `viewed`, `clicked`, `saved`, `completed`, or `dismissed` event for a result. |
| `GET` | `/admin/` | Django admin | Open the Django administration site. |

For example, the login endpoint is `http://localhost:8000/ModelAPIs/RecEngine/login/`.

## Request examples

### Register

Send JSON to `POST /register/`:

```json
{
  "username": "caregiver1",
  "email": "caregiver@example.com",
  "role": "caregiver",
  "password": "a-strong-password",
  "password2": "a-strong-password"
}
```

Public registration accepts `caregiver` or `content_provider`. Admin accounts cannot be created from the registration form. Existing users become caregivers by default, while Django staff/superusers have administrator access. Create or reset the two bootstrap administrators by running `docker compose exec neuroguide-api python manage.py create_neuroguide_admins` and entering their shared password at the prompt.

Administrators can use all application views and APIs. Caregivers can manage their child profiles and use activities, recommendations, and progress views. Content providers can view and manage the content library and media assessment tools. API permissions enforce these roles in addition to the frontend navigation and route checks.

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
  "content_type": "text"
}
```

Text upload returns `202 Accepted` after saving and queueing assessment, so the API request does not wait for model loading or inference. The worker checks safety first and runs developmental scoring only when the text is classified as safe. Content is recommendation-eligible only after both assessments complete successfully and suitability is Suitable or Partially Suitable. Poll `GET /content/<id>/` for `assessment_status`, `safety_label`, `suitability_label`, `developmental_scores`, and `recommendation_eligible`. Text content is limited to 100,000 characters; uploaded files are limited to 2 MB and must be UTF-8 `.txt` files.

Audio and video are submitted as multipart uploads using the `media_file` field and `content_type=audio` or `content_type=video`. They return `202 Accepted` while the single worker probes the media, transcribes speech locally with faster-whisper, checks transcript safety with the existing BERT model, and checks sampled video frames with the local Falconsai NSFW image classifier. If any checked frame or transcript is unsafe, the content is marked unsafe and remains ineligible. A processing or model-download failure is marked inconclusive/failed and remains ineligible. Poll `GET /content/<id>/` for `processing_status`, `safety_label`, `visual_assessment`, `audio_assessment`, and `transcript`.

Example video upload:

```sh
curl http://localhost:8000/ModelAPIs/RecEngine/content/ \
  -H 'Authorization: Bearer <access-token>' \
  -F 'title=Learning video' \
  -F 'age_min=24' \
  -F 'age_max=48' \
  -F 'content_type=video' \
  -F 'media_file=@learning-video.mp4'
```

### Manage stored content

All content-management requests require a JWT access token. `GET /content/` lists records, including pending, unsafe, and failed assessments. `GET /content/<id>/` retrieves one record. `PATCH /content/<id>/` can update `title`, `text`, `age_min`, `age_max`, and `content_type`; changing the text or age range clears previous assessment results and makes the item ineligible until reassessed. `DELETE /content/<id>/` removes the record.

To rerun assessment, send an authenticated empty `POST` to `/content/<id>/assess/`. Text reassessment returns `202 Accepted` and is performed by the worker. Audio and video receive safety checks; when speech is present and its transcript passes safety review, that transcript is assessed for developmental scores and suitability. Long text and transcripts are evaluated in overlapping model-length windows. Media without an assessable transcript, or with an unsafe transcript or visual result, remains ineligible for recommendations.

### Request recommendations for a saved child

First create or update a child profile with an age and one or more valid `learning_goals`. Then send the child's ID to `POST /recommend/`:

```json
{
  "child_id": 1,
  "top_n": 5
}
```

The API reads age and goals from the authenticated caregiver's child profile; clients cannot request recommendations for another user's child. Learning goal names must match one of the 21 model labels, including `counting`, `number_identification`, `working_memory`, `expressive_language`, or `self_regulation`. Recommendations include content with completed developmental assessment, a suitability classification of `Suitable` or `Partially Suitable`, and an age range containing the child's age. `Not Suitable` content is excluded. Suitable and Partially Suitable items use the same score: the arithmetic mean of the model probabilities for the child's selected goals. For audio and video, these probabilities are based on the safety-checked transcript. Results include `relevance_score` and the selected `goal_scores`; each request is stored in recommendation history.

### Review history, log activity, and submit feedback

List recommendation history with `GET /recommend/history/`; narrow it to one saved child using `GET /recommend/history/?child_id=1`. Each history record contains a snapshot of the recommendations, child, age, goals, feedback, and activity events.

Log an activity for content included in a result with `POST /recommend/history/<history_id>/activity/`:

```json
{
  "content_id": 12,
  "event_type": "viewed",
  "details": {"source": "child_dashboard"}
}
```

Allowed event types are `viewed`, `clicked`, `saved`, `completed`, and `dismissed`.

Submit or update a rating with `POST /recommend/history/<history_id>/feedback/`:

```json
{
  "rating": 5,
  "text": "This activity worked well."
}
```

Ratings must be from 1 to 5; feedback text is optional and limited to 1,000 characters.

## Database inspection

Open a Postgres prompt using the credentials loaded in the database container:

```sh
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

At the `psql` prompt, `\dt` lists tables. Registered accounts are stored in `auth_user`; child profiles are stored in `RecEngine_childprofile`; assessed learning content is stored in `RecEngine_content`; recommendation records and activity events are stored in `RecEngine_recommendationhistory` and `RecEngine_recommendationactivity`.

## Development notes

- The API source directory is bind-mounted into the container, so Python source changes are visible without rebuilding the image. Rebuild after changing dependencies or the Dockerfile with `docker compose up --build -d`.
- The provided Compose and Django settings are for local development. Configure production secrets, allowed hosts, HTTPS, and a production-grade application server before deployment.
