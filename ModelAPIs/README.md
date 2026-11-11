# NeuroGuide Model APIs

NeuroGuide is a Docker Compose application with a Django REST Framework API and a Next.js frontend. It supports caregiver and content-provider accounts, child profiles, text and media assessment, moderation, and age- and goal-based recommendations. PostgreSQL stores accounts, profiles, content, moderation flags, notifications, and recommendation history.

## Features

- Register caregiver/parent or content-provider accounts, obtain and refresh JSON Web Tokens (JWTs), and edit account details in Settings.
- Enforce role-based access for administrators, caregivers/parents, and content providers in both the API and frontend.
- Create and manage child profiles. Caregivers can access only their own profiles; administrators can review all child profiles and request recommendations for each one.
- Classify text as safe or unsafe and return the model confidence.
- Score text against 21 developmental domains and classify its overall suitability.
- Submit text, audio, and video learning content for safety and developmental assessment. Audio and video use their safe speech transcripts to produce developmental scores and suitability classifications.
- Let content providers manage only content they uploaded; administrators can manage all content.
- Let authenticated users flag content. Flagged content is hidden from caregiver activities and recommendations pending review; admins can clear or reject flags.
- Notify content providers when their content is flagged and when an administrator resolves the review.
- Request ranked recommendations using a caregiver's saved child profile. Administrators can select any child profile.
- Persist recommendation history with a snapshot of the child, goals, and returned content; record views, clicks, saves, completions, dismissals, and caregiver feedback.
- Show a public login/register landing page to logged-out visitors, a profile menu with logout, and an unread-notification indicator in the navbar.
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

The same Compose stack starts the Next.js frontend at <http://localhost:3000>, Redis, and one Celery media worker. The API and worker share the persistent `media_files` volume. The API image installs FFmpeg/ffprobe and Python dependencies from `requirements.txt`; the project and model files are supplied by the Compose bind mount. PyTorch is CPU-only. Frontend requests use `/api/ModelAPIs/RecEngine`; Next.js proxies those requests to Django using `API_INTERNAL_BASE_URL`, so browser requests stay same-origin. The Next.js proxy and API upload limit are configured for 100 MB media uploads by default; `MEDIA_MAX_UPLOAD_BYTES` adjusts the API limit.

Video frame safety checks run locally with the Transformers image-classification pipeline. The worker downloads `HF_NSFW_MODEL` from Hugging Face on its first video assessment and stores a persistent copy in `./model_cache/nsfw_image_detection`, which is mounted into the worker at `/models/nsfw_image_detection`. The public default model does not require `HF_TOKEN`; leave it blank unless the selected model requires authentication. Never commit a live token to `.env.example` or source control. A video is flagged by its sampled frames when at least `MEDIA_NSFW_MIN_FLAGGED_FRAMES` frames meet the `HF_NSFW_THRESHOLD` (default: two frames at 0.5). Audio transcription runs locally with open-source faster-whisper; its model downloads on first use and is cached in the `whisper_cache` Docker volume. The defaults use the multilingual `tiny` model with CPU INT8, two CPU threads, and beam size one. Set `WHISPER_MODEL_SIZE` to `base` or `small` for higher transcription accuracy at greater memory and latency cost. Media limits are configurable with `MEDIA_MAX_UPLOAD_BYTES`, `MEDIA_MAX_DURATION_SECONDS`, `MEDIA_FRAME_INTERVAL_SECONDS`, and `MEDIA_MAX_FRAMES`; visual model settings use `HF_NSFW_MODEL` and `HF_NSFW_THRESHOLD`. One worker processes one media job at a time; within a job, audio and visual checks run concurrently. Frames are sampled across the clip, increasing the interval if needed to stay within the frame cap. Brief scenes between sampled frames may still be missed.

To remove the database volume and all stored database data, run `docker compose down -v`.

## Configuration and model files

Compose reads configuration from `.env`. Start with `.env.example`, change the development database password, and add `HF_TOKEN` only when the selected Hugging Face model requires authentication. Do not commit `.env`. The API service connects to Postgres using the Compose service name `db`.

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

Protected endpoints require an authenticated session or JWT. The prediction endpoints are restricted to administrators and content providers. The frontend refreshes access tokens automatically while a refresh token remains valid; logging out clears the local tokens.

For browser use, open a browsable API endpoint such as `/ModelAPIs/RecEngine/children/` and use the page's **Log in** link. This signs into the browsable API with a Django session; a JWT does not need to be pasted into browser forms. The same API continues to accept JWT bearer tokens from clients such as Postman or `curl`.

## Routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| `POST` | `/register/` | Public | Create a user account. |
| `POST` | `/login/` | Public | Obtain JWT access and refresh tokens. |
| `POST` | `/refresh/` | Public | Exchange a refresh token for a new access token. |
| `GET`, `POST` | `/api-auth/login/` | Django session | Sign in or out of the browsable API in a browser. |
| `GET`, `PUT`, `PATCH` | `/profile/` | Authenticated user | Retrieve or update the current user's own account profile. The frontend account form is in Settings. |
| `GET`, `POST` | `/children/` | Caregiver: own; Admin: all | List accessible child profiles or create a child profile. |
| `GET`, `PUT`, `PATCH`, `DELETE` | `/children/<id>/` | Caregiver: own; Admin: all | Retrieve or manage an accessible child profile. |
| `POST` | `/predict/` | Admin, Content Provider | Return developmental-domain probabilities and predicted domains for text. |
| `POST` | `/safety/predict/` | Admin, Content Provider | Classify text as safe or unsafe and return confidence. |
| `GET`, `POST` | `/content/` | GET: role-filtered; POST: Admin, Content Provider | List visible records or submit and assess content. Admins see all; providers see their own uploads; caregivers see safe, unflagged content. |
| `GET`, `PATCH`, `DELETE` | `/content/<id>/` | Admin; provider owner; caregiver safe/unflagged GET only | Retrieve or manage content. Providers cannot modify another provider's upload. Editing assessed fields resets assessment and eligibility. |
| `POST` | `/content/<id>/assess/` | Admin, provider owner | Queue a new safety and developmental assessment. |
| `POST` | `/content/<id>/flag/` | Any authenticated user | Flag content for admin review. It is hidden from caregiver activities and recommendations while flagged. |
| `POST` | `/content/<id>/moderate/` | Admin | Clear or reject flagged content; a decision is sent to its provider as a notification. |
| `POST` | `/recommend/` | Caregiver: own child; Admin: any child | Generate and store recommendations for a saved child profile. |
| `GET` | `/recommend/history/` | Caregiver: own history; Admin: all | List history; optionally filter with `?child_id=<id>`. |
| `POST` | `/recommend/history/<history_id>/feedback/` | History owner; Admin | Add or update a 1–5 rating and optional text feedback. |
| `POST` | `/recommend/history/<history_id>/activity/` | History owner; Admin | Record a content `viewed`, `clicked`, `saved`, `completed`, or `dismissed` event. |
| `GET` | `/notifications/` | Authenticated user | List the current user's notifications. |
| `POST` | `/notifications/<id>/read/` | Notification recipient | Mark a notification as read. |
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

Administrators can use all application views and APIs, view every child profile, and select a child to generate or review recommendations. Caregivers can manage only their own child profiles and use activities, recommendations, and progress. Content providers can manage only their own uploads, use media assessment tools, and receive in-app notifications about flags and review decisions. Every authenticated role can flag content; only admins can clear or reject a flag. API permissions enforce ownership and role rules in addition to frontend navigation.

The Profile page is for child profiles. All roles edit their own account details in Settings. A caregiver cannot see flagged or rejected content. The Activities catalog can show safe, unflagged content even before recommendation history exists, which helps populate the page during cold start. Recommendations use the stricter assessment and suitability eligibility rules described below. The navbar profile menu provides the profile/settings link and logout; the notification bell shows a red dot when the user has unread notifications.

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

Text upload returns `202 Accepted` after saving and queueing assessment, so the API request does not wait for model loading or inference. The worker checks safety first and runs developmental scoring only when the text is classified as safe. Content is recommendation-eligible only after both assessments complete successfully and suitability is Suitable or Partially Suitable. Poll `GET /content/<id>/` for `assessment_status`, `safety_label`, `suitability_label`, `developmental_scores`, and `recommendation_eligible`. Text content is limited to 100,000 characters; uploaded files are limited to 2 MB and must be UTF-8 `.txt` files. Audio and video uploads default to a 100 MB limit, configurable through `MEDIA_MAX_UPLOAD_BYTES`.

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

All content-management requests require a JWT access token. The records returned by `GET /content/` are role-filtered: admins see all content, providers see their own uploads, and caregivers see only safe, unflagged content. Admins and owning providers can retrieve pending, unsafe, or failed assessments. `GET /content/<id>/` retrieves an accessible record. `PATCH /content/<id>/` can update `title`, `text`, `age_min`, `age_max`, and `content_type`; changing assessed fields clears previous assessment results and makes the item ineligible until reassessed. `DELETE /content/<id>/` removes a record when permitted by the same ownership rules.

To rerun assessment, send an authenticated empty `POST` to `/content/<id>/assess/`. Text reassessment returns `202 Accepted` and is performed by the worker. Audio and video receive safety checks; when speech is present and its transcript passes safety review, that transcript is assessed for developmental scores and suitability. Long text and transcripts are evaluated in overlapping model-length windows. Media without an assessable transcript, or with an unsafe transcript or visual result, remains ineligible for recommendations.

### Request recommendations for a saved child

First create or update a child profile with an age and one or more valid `learning_goals`. Then send the child's ID to `POST /recommend/`:

```json
{
  "child_id": 1,
  "top_n": 5
}
```

The API reads age and goals from the selected child profile. Caregivers can request recommendations only for their own children; administrators can select any child profile. Learning goal names must match one of the 21 model labels, including `counting`, `number_identification`, `working_memory`, `expressive_language`, or `self_regulation`. Recommendation candidates must be safe, unflagged, assessed, marked eligible, classified `Suitable` or `Partially Suitable`, and have an age range containing the child's age. `Not Suitable`, flagged, and rejected content is excluded.

The `relevance_score` is the arithmetic mean of the model probabilities for the selected goals. For example, probabilities of 0.80 for counting and 0.60 for expressive language produce a score of 0.70 (70%). `goal_scores` contains each probability and `matched_goals` lists goals with a score of at least 0.5. Suitable and Partially Suitable content use the same relevance calculation. For audio and video, domain probabilities are based on the safety-checked transcript. Results are stored in recommendation history.

The trained suitability output order is `Not Suitable`, `Partially Suitable`, `Suitable`; the runtime label mapping follows that order. The developmental-assessment training notebook describes a synthetic/generated dataset, so these model probabilities and suitability labels are experimental prototype outputs, not expert-validated educational judgments.

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
