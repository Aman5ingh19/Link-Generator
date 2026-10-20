# 🔐 One-Time Link Generator

> A beginner-friendly, production-ready full-stack web application for generating secure, self-destructing confidential links. Built to learn **React, TypeScript, Node.js, Express, Cloud-hosted MySQL (Aiven), Docker, Jenkins CI/CD, Ansible, and Zipkin Distributed Tracing** step-by-step.

📄 **[Download Complete Architecture & DevOps Guide (PDF)](./PROJECT_DOCUMENTATION.pdf)** — *A comprehensive 9-page guide explaining the system architecture, tech stack rationale, Zipkin distributed tracing, Jenkins vs GitHub Actions, and Ansible deployment.*

---

## 📑 Table of Contents

1. [Project Overview & Architecture](#-project-overview--architecture)
2. [Technology Stack](#-technology-stack)
3. [How the System Works](#-how-the-system-works)
   - [How React Communicates with Express](#1-how-react-communicates-with-express)
   - [How Express Communicates with Aiven Cloud MySQL](#2-how-express-communicates-with-aiven-cloud-mysql)
   - [How One-Time Tokens Work (Cryptographic Security)](#3-how-one-time-tokens-work-cryptographic-security)
   - [How Expiration & Atomic Consumption Prevent Race Conditions](#4-how-expiration--atomic-consumption-prevent-race-conditions)
   - [How Docker Runs the Application & Container Networking](#5-how-docker-runs-the-application--container-networking)
   - [How Jenkins Automates Continuous Integration (CI)](#6-how-jenkins-automates-continuous-integration-ci)
   - [How Ansible Automates Remote Server Deployment](#7-how-ansible-automates-remote-server-deployment)
   - [How Zipkin Traces Backend Requests (Distributed Tracing)](#8-how-zipkin-traces-backend-requests-distributed-tracing)
4. [Project Structure](#-project-structure)
5. [Environment Variables Setup](#-environment-variables-setup)
6. [Getting Started (Local Development)](#-getting-started-local-development)
7. [Running with Docker Compose](#-running-with-docker-compose)
8. [Automated Testing](#-automated-testing)
9. [Zipkin Distributed Tracing (How-To)](#-zipkin-distributed-tracing-how-to)
10. [Jenkins CI Pipeline (How-To)](#-jenkins-ci-pipeline-how-to)
11. [Ansible Remote Deployment (How-To)](#-ansible-remote-deployment-how-to)
12. [REST API Documentation](#-rest-api-documentation)
13. [Learning Takeaways](#-learning-takeaways)

---

## 🏛 Project Overview & Architecture

The **One-Time Link Generator** allows users to store a confidential note (such as an API token, password, or recovery phrase) and generate an unpredictable, single-use link. When the recipient opens the link, the secret is displayed and the link is permanently marked as used (or destroyed). Any subsequent attempt displays: *"This link has already been used."*

```
               [ User Browser ]
                      │
           HTTP (Port 3000 / 5173)
                      ▼
            ┌───────────────────┐
            │  React + Vite SPA │ (Frontend)
            └─────────┬─────────┘
                      │
               REST API (/api/links)
                      │
                      ▼
            ┌───────────────────┐        Export Spans       ┌───────────────────┐
            │ Express.js Server │ ────────────────────────> │   Zipkin Engine   │
            │   (TypeScript)    │      HTTP (Port 9411)     │  (Port 9411 Web)  │
            └─────────┬─────────┘                           └───────────────────┘
                      │
                Prisma ORM
           TLS Encrypted (Port 12345+)
                      ▼
            ┌───────────────────┐
            │ Cloud Aiven MySQL │ (Managed Cloud Database)
            │  (SSL Required)   │
            └───────────────────┘
```

---

## 🛠 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS | Reactive UI with high-contrast dark theme and animations |
| **Backend** | Node.js, Express.js, TypeScript | RESTful API server with input validation and security controls |
| **Database** | Aiven Cloud MySQL, Prisma ORM | Managed cloud database with automated schema migrations |
| **Observability** | OpenTelemetry, Zipkin | Distributed request and query tracing across application spans |
| **Containerization** | Docker, Docker Compose | Multi-stage container builds and unified local stack orchestration |
| **CI / CD** | Jenkins (`Jenkinsfile`) | Automated pipeline for linting, testing, and multi-tier building |
| **Configuration Mgmt** | Ansible (`playbook.yml`) | Declarative, agentless deployment to remote Linux servers |
| **Testing** | Vitest, Supertest | Isolated unit and integration tests with in-memory database mocks |

---

## 💡 How the System Works

### 1. How React Communicates with Express
- The frontend initiates standard HTTP requests using the browser's native `fetch()` API via the helper in `frontend/src/api/client.ts`.
- In **development**, Vite's dev server (`vite.config.ts`) proxies requests matching `/api/*` directly to `http://localhost:5000`. This eliminates CORS issues while working locally.
- In **production / Docker**, Nginx (`frontend/nginx.conf`) acts as a reverse proxy: requests to `/api/` are forwarded internally to `http://backend:5000/api/`.
- All requests send and receive JSON payloads.

### 2. How Express Communicates with Aiven Cloud MySQL
- **No local MySQL installation is needed.** Aiven hosts a managed MySQL instance in the cloud.
- Express connects via **Prisma ORM** using the `DATABASE_URL` environment variable:
  ```env
  DATABASE_URL="mysql://<user>:<password>@<aiven-host>:<port>/<dbname>?ssl-mode=REQUIRED"
  ```
- Aiven enforces TLS/SSL encryption for all database connections. The query parameter `?ssl-mode=REQUIRED` ensures traffic between your backend and Aiven is encrypted in transit.
- Prisma models are defined in `backend/prisma/schema.prisma` and applied using migrations.

### 3. How One-Time Tokens Work (Cryptographic Security)
- Predictable IDs (like sequential integers `1, 2, 3`) allow attackers to guess links and steal secrets before intended recipients open them.
- Instead, the backend generates tokens using Node's cryptographic random byte generator:
  ```ts
  crypto.randomBytes(16).toString('hex'); // Produces a 32-character hex string (128 bits of entropy)
  ```
- With $2^{128}$ possible combinations, brute-forcing or guessing a link token is computationally impossible.

### 4. How Expiration & Atomic Consumption Prevent Race Conditions
> ⚠️ **The Concurrency Problem**: What if two people (or an attacker and recipient) click the one-time link at the exact same millisecond? A naive implementation might check `if (!link.usedAt)` and then update `link.usedAt = now`. In that gap, both requests could read `usedAt == null` and both receive the secret note!

**The Solution — Atomic Conditional Update:**
In `backend/src/services/linkService.ts`, consumption executes a single atomic SQL statement:
```ts
const updateResult = await prisma.shareLink.updateMany({
  where: {
    token: token,
    usedAt: null, // ONLY update if not already consumed
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: new Date() } } // ONLY update if not expired
    ]
  },
  data: {
    usedAt: new Date(),
  }
});
```
- In MySQL, this acquires an exclusive row-level lock.
- If two requests hit simultaneously, MySQL serializes them:
  - **Request 1**: Updates `usedAt` from `NULL` to the current timestamp. `updateResult.count` is `1`. It receives the secret note.
  - **Request 2**: Sees `usedAt` is no longer `NULL`. `updateResult.count` is `0`. The query matches zero rows and the second request is rejected with `410 ALREADY_USED`.
- The secret note is **never** included in dashboard APIs (`GET /api/links`), preserving zero-knowledge until deliberate consumption.

### 5. How Docker Runs the Application & Container Networking
- **Multi-Stage Builds**:
  - `backend/Dockerfile`: Stage 1 compiles TypeScript and generates Prisma engines; Stage 2 copies only compiled files to a minimal Alpine container.
  - `frontend/Dockerfile`: Stage 1 builds the Vite bundle; Stage 2 serves the static bundle via Nginx.
- **Docker Compose Networking**:
  - All services run on a custom bridge network named `link_network`.
  - Docker's embedded DNS server resolves container names to IP addresses:
    - Frontend's Nginx proxies to `http://backend:5000`.
    - Backend exports spans to `http://zipkin:9411`.
    - Both backend and host communicate directly with Aiven MySQL over the Internet.

### 6. How Jenkins Automates Continuous Integration (CI)
The declarative `Jenkinsfile` at the repository root runs a 6-stage pipeline:
1. **Checkout Source Code**: Clones the Git repository.
2. **Install Dependencies**: Runs `npm ci` for backend and frontend.
3. **Run Backend Tests**: Executes Vitest suite with Supertest (all tests run against in-memory mocks without needing external DB access).
4. **Build Backend**: Compiles TypeScript to JavaScript with `npm run build`.
5. **Build Frontend**: Compiles React Vite assets with `npm run build`.
6. **Report Status**: Notifies build success or failure via the `post` block.

### 7. How Ansible Automates Remote Server Deployment
The `ansible/playbook.yml` provides agentless infrastructure deployment:
1. Connects to your remote Ubuntu server via SSH (`app_servers` inventory).
2. Installs Docker and Docker Compose plugin automatically if not already present.
3. Synchronizes project code to `/opt/one-time-link-generator/`.
4. Writes a secure `.env` file containing the Aiven MySQL credentials.
5. Runs `docker compose up -d --build` to build and launch the containers.
6. Validates deployment by polling `http://localhost:5000/api/health`.

### 8. How Zipkin Traces Backend Requests (Distributed Tracing)
- **OpenTelemetry SDK** (`backend/src/tracing.ts`) instruments Express and HTTP requests automatically.
- Custom spans track domain operations:
  - `linkService.createLink`: Records link token, ID, and expiration flag.
  - `linkService.consumeLink`: Records consumption outcome (`success`, `already_used`, `expired`, `not_found`).
- **Viewing Traces in Zipkin**:
  1. Start Zipkin via Docker Compose (`docker compose up -d zipkin`).
  2. Open your browser to `http://localhost:9411`.
  3. Click **"Run Query"** to see recent requests and trace timelines.
  4. Click on any trace to inspect span latency, database call duration, and custom attributes.

---

## 📂 Project Structure

```
Link Generator/
├── backend/
│   ├── prisma/
│   │   ├── migrations/             # Schema migration SQL files
│   │   └── schema.prisma           # Prisma MySQL model definition
│   ├── src/
│   │   ├── routes/
│   │   │   ├── health.ts           # Health check endpoint
│   │   │   └── links.ts            # REST API endpoints
│   │   ├── services/
│   │   │   └── linkService.ts      # Core business logic & atomic consumption
│   │   ├── app.ts                  # Express application setup
│   │   ├── db.ts                   # Prisma client singleton & connection tester
│   │   ├── index.ts                # Server entry point
│   │   └── tracing.ts              # OpenTelemetry + Zipkin configuration
│   ├── tests/
│   │   └── links.test.ts           # Automated Vitest test suite
│   ├── Dockerfile                  # Multi-stage production container
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # Fetch API wrapper
│   │   ├── components/
│   │   │   ├── ConsumeTab.tsx      # Reveal & consume UI
│   │   │   ├── CreateLinkTab.tsx   # Note input & expiration selector
│   │   │   ├── DashboardTab.tsx    # Link management dashboard
│   │   │   └── Header.tsx          # Brand header with health indicator
│   │   ├── App.tsx                 # Root tab navigation & state
│   │   ├── index.css               # Modern dark-mode styling
│   │   └── main.tsx
│   ├── Dockerfile                  # Vite build + Nginx Alpine runtime
│   ├── nginx.conf                  # Nginx proxy & SPA router
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── ansible/
│   ├── inventory.ini.example       # Server inventory template
│   ├── playbook.yml                # Automated deployment script
│   └── README.md                   # Ansible guide
├── docker-compose.yml              # Frontend, Backend, Zipkin orchestration
├── Jenkinsfile                     # Declarative CI pipeline
├── .env.example                    # Global environment variables template
└── README.md                       # This document
```

---

## ⚙️ Environment Variables Setup

### 1. Cloud Database (Aiven MySQL)
1. Sign up for a free account at [aiven.io](https://aiven.io/).
2. Create a **MySQL** service (the free tier or trial tier is sufficient).
3. Once running, copy the **Service URI** from your Aiven dashboard.
   It looks like:
   ```
   mysql://avnadmin:AVNS_example123@mysql-example.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED
   ```

### 2. Configure Local `.env`
In both the root directory and `backend/` directory, create a `.env` file:
```bash
cp .env.example .env
cp backend/.env.example backend/.env
```
Update `DATABASE_URL` with your actual Aiven connection string.

---

## 🚀 Getting Started (Local Development)

### Step 1: Install Dependencies
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### Step 2: Push Prisma Schema to Aiven MySQL
```bash
cd backend
npx prisma db push
```

### Step 3: Start the Backend API
```bash
cd backend
npm run dev
```
The backend starts on `http://localhost:5000`.

### Step 4: Start the Frontend SPA
In a separate terminal:
```bash
cd frontend
npm run dev
```
The frontend is available at `http://localhost:5173`.

---

## 🐳 Running with Docker Compose

To launch the complete multi-tier system (Frontend, Backend, and Zipkin) with a single command:

```bash
# Ensure your root .env has your Aiven DATABASE_URL
docker compose up -d --build
```

Access services:
- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api/links](http://localhost:5000/api/links)
- **Zipkin Tracing UI**: [http://localhost:9411](http://localhost:9411)

To view container logs:
```bash
docker compose logs -f
```

To stop containers:
```bash
docker compose down
```

---

## 🧪 Automated Testing

Backend tests run completely isolated without requiring a live database connection by using mocked storage:

```bash
cd backend
npm test
```

### Test Coverage Highlights:
- ✅ **Health Check**: Verifies `/api/health` reports status.
- ✅ **Link Creation**: Generates a 32-character random token and verifies the note is omitted from response metadata.
- ✅ **Validation**: Rejects empty notes with `400 VALIDATION_ERROR`.
- ✅ **First Access**: Successfully consumes the link and returns the decrypted note.
- ✅ **Double-Access Rejection**: Verifies subsequent consumption attempts return `410 ALREADY_USED`.
- ✅ **Expired Link Rejection**: Verifies expired links return `410 EXPIRED`.
- ✅ **Invalid Token Handling**: Verifies non-existent tokens return `404 NOT_FOUND`.
- ✅ **Dashboard Confidentiality**: Ensures `/api/links` never leaks note contents.
- ✅ **Deletion**: Successfully deletes links by ID.

---

## 🔍 Zipkin Distributed Tracing (How-To)

Zipkin tracks latency and request flow across your Node.js/Express backend and database queries using OpenTelemetry spans.

### 1. Start Zipkin
Run Zipkin in background using Docker:
```bash
docker compose up -d zipkin
```

### 2. Access the UI
Open your browser to: **[http://localhost:9411](http://localhost:9411)**

### 3. Generate and Inspect Spans
1. Create or consume a one-time link in the app (`http://localhost:5173` or `http://localhost:3000`).
2. Go to the Zipkin dashboard and click the **"Run Query"** button.
3. You will see recorded spans:
   - `linkService.createLink` / `linkService.consumeLink`
   - Express HTTP route handling duration
   - Prisma / MySQL query execution times
4. Click on any trace row to open the detailed waterfall timeline and view span metadata and errors.

---

## ⚙️ Jenkins CI Pipeline (How-To)

The root [`Jenkinsfile`](./Jenkinsfile) defines an automated 6-stage CI pipeline to test and build both frontend and backend on every code change.

### 1. Prerequisites
- A running Jenkins server (local or cloud)
- Node.js (v18+) and Git plugins installed on Jenkins agent

### 2. Create the Pipeline Job
1. Open Jenkins Dashboard ➔ Click **New Item**.
2. Enter item name (e.g., `one-time-link-ci`) ➔ Select **Pipeline** ➔ Click **OK**.
3. Under the **Pipeline** configuration section:
   - **Definition**: Select `Pipeline script from SCM`
   - **SCM**: Select `Git`
   - **Repository URL**: Paste your repository URL (e.g., `https://github.com/your-username/one-time-link-generator.git`)
   - **Branch Specifier**: `*/main` or `*/master`
   - **Script Path**: `Jenkinsfile`
4. Click **Save**.

### 3. Run the Build
- Click **Build Now** on the left menu.
- Jenkins will execute the 6 stages:
  1. `1. Checkout Source Code` (Clones repository)
  2. `2. Install Dependencies` (`npm ci` for backend and frontend)
  3. `3. Run Backend Tests` (`npx prisma generate` & `npm test` - Vitest)
  4. `4. Build Backend` (`npm run build` - TypeScript compilation)
  5. `5. Build Frontend` (`npm run build` - Vite production bundle)
  6. `6. Pipeline Result Notification` (Success/Failure status)

---

## 🚀 Ansible Remote Deployment (How-To)

The [`ansible/playbook.yml`](./ansible/playbook.yml) automates complete deployment to any remote Linux server (Ubuntu/Debian) over SSH.

### 1. Configure Server Inventory
Copy the example inventory template:
```bash
cp ansible/inventory.ini.example ansible/inventory.ini
```

Edit `ansible/inventory.ini` and specify your server details:
```ini
[app_servers]
webserver1 ansible_host=YOUR_SERVER_PUBLIC_IP ansible_user=ubuntu ansible_ssh_private_key_file=~/.ssh/your_key.pem
```

### 2. Test SSH Connection
Verify that Ansible can communicate with the remote machine:
```bash
ansible -i ansible/inventory.ini app_servers -m ping
```
*Expected output: `SUCCESS => { "ping": "pong" }`*

### 3. Run the Deployment Playbook
Execute the playbook with your cloud database connection URL:
```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml \
  -e "database_url=mysql://avnadmin:YOUR_PASSWORD@your-mysql-host.aivencloud.com:10536/defaultdb?ssl-mode=REQUIRED"
```

### What the Playbook Does Automatically:
1. Installs Docker Engine & Docker Compose plugin on the remote server.
2. Synchronizes frontend, backend, and configuration files to `/opt/one-time-link-generator/`.
3. Sets up a secure `.env` file (`mode: 0600`).
4. Executes `docker compose up -d --build`.
5. Verifies server health at `http://localhost:5000/api/health`.

Once finished, your stack is live at:
- **Frontend App**: `http://<YOUR_SERVER_IP>:3000`
- **Backend API**: `http://<YOUR_SERVER_IP>:5000/api/links`
- **Zipkin UI**: `http://<YOUR_SERVER_IP>:9411`

---

## 📡 REST API Documentation

| Method | Endpoint | Description | Request Body | Response Status |
|---|---|---|---|---|
| `GET` | `/api/health` | Health check & DB status | None | `200 OK` / `503 Service Unavailable` |
| `POST` | `/api/links` | Create a one-time link | `{ content: string, expiresInMinutes?: number }` | `201 Created` |
| `GET` | `/api/links` | List all links (metadata only) | None | `200 OK` |
| `GET` | `/api/links/:id` | Get link metadata by ID | None | `200 OK` / `404 Not Found` |
| `POST` | `/api/links/:token/consume` | Consume and retrieve secret | None | `200 OK` / `410 Gone` / `404 Not Found` |
| `DELETE` | `/api/links/:id` | Delete link by ID | None | `200 OK` / `404 Not Found` |

---

## 🎓 Learning Takeaways
1. **Security**: Never expose secret payloads in metadata or dashboard listing queries.
2. **Concurrency**: Use atomic conditional updates (`WHERE usedAt IS NULL`) rather than separate check-and-update steps to prevent race condition vulnerabilities.
3. **Observability**: Distributed tracing with OpenTelemetry and Zipkin gives instant insight into slow queries and request latency.
4. **DevOps Automation**: Keeping CI testing (Jenkins) and deployment (Ansible) separate promotes modular and maintainable workflows.
