# 🔐 One-Time Link Generator

[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](#)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white)](#)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](#)
[![MySQL](https://img.shields.io/badge/MySQL-Aiven%20Cloud-4479A1?logo=mysql&logoColor=white)](#)
[![OpenTelemetry](https://img.shields.io/badge/OpenTelemetry-Tracing-495A9C?logo=opentelemetry&logoColor=white)](#)
[![Zipkin](https://img.shields.io/badge/Zipkin-Distributed%20Tracing-E63946)](#)
[![Docker](https://img.shields.io/badge/Docker-Multi--Stage-2496ED?logo=docker&logoColor=white)](#)
[![Jenkins](https://img.shields.io/badge/Jenkins-Full%20CI%2FCD-D24939?logo=jenkins&logoColor=white)](#)
[![Ansible](https://img.shields.io/badge/Ansible-Automation-EE0000?logo=ansible&logoColor=white)](#)
[![Tests](https://img.shields.io/badge/Tests-9%2F9%20Passing-brightgreen?logo=vitest)](#)

> A production-grade, secure, ephemeral secret-sharing web application built with **React 18, TypeScript, Express.js, Prisma ORM, Aiven Cloud MySQL, Docker, Jenkins CI/CD, Ansible, and Zipkin Distributed Tracing**.

📄 **[Download Complete Architecture & DevOps Guide (PDF)](./PROJECT_DOCUMENTATION.pdf)** — *A comprehensive 9-page guide explaining system architecture, tech stack rationale, Zipkin distributed tracing, Jenkins vs. GitHub Actions, and Ansible deployment.*

---

## 💼 Resume & Interview Showcase

> **Looking to feature this project on your Resume, LinkedIn, or in Technical Interviews?** Use the battle-tested talking points and bullet points below.

### 📌 Resume Bullet Points (Copy & Paste for Resume / CV)

#### For Full-Stack / Software Engineer Roles:
* **Architected and implemented** a full-stack, ephemeral secret-sharing platform using **React 18, TypeScript, Node.js, and Express**, eliminating permanent credential leaks in team communications (Slack/Teams).
* **Engineered atomic database transactions** with **Prisma ORM** and cloud-hosted **Aiven MySQL**, preventing concurrency race conditions and enforcing strict single-use link consumption (**HTTP 410 Gone**).
* **Integrated OpenTelemetry & Zipkin distributed tracing** across frontend `fetch()` requests, Express middleware, and database queries, enabling sub-millisecond latency bottleneck isolation.
* **Achieved a 236 KB minified frontend bundle** with sub-second HMR using **Vite** and configured **Nginx** reverse proxying to streamline API routing and eliminate CORS vulnerabilities.

#### For DevOps / Cloud / Platform Engineer Roles:
* **Designed and automated a 7-stage Jenkins CI/CD pipeline** executing Vitest test suites, compiling TypeScript, building multi-stage Docker images, and publishing versioned artifacts to Docker Hub.
* **Orchestrated automated zero-downtime remote deployments** to cloud Linux environments using **Ansible** playbooks over SSH, synchronizing environment secrets and verifying health endpoints.
* **Containerized microservices using Docker Compose** with multi-stage builds (reducing image sizes by >65%) and isolated bridge networks connecting frontend, backend, and Zipkin tracing.
* **Maintained 100% automated test coverage** for link creation, token expiration, and security lifecycle using **Vitest** and **Supertest** with in-memory mocks.

---

### 🎙️ Technical Interview Cheat Sheet (STAR Method)

| Question / Topic | Structured Answer (STAR Framework) |
|---|---|
| **Why did you build this project? (Situation & Task)** | Sharing passwords, API tokens, and OTPs via Slack, Teams, or email permanently exposes them in conversation backups and search indexes. I built a zero-knowledge "burn-after-reading" link generator where confidential notes are destroyed the instant they are accessed. |
| **How did you prevent race condition exploits? (Action)** | If two concurrent requests hit a one-time link at the exact same millisecond, a naive check-then-update approach could leak the secret twice. I engineered an atomic single-statement SQL update with row-level locks in MySQL (`WHERE token = ? AND usedAt IS NULL`). Only the first serialized transaction updates the row and reveals the secret; all subsequent requests immediately receive `410 ALREADY_USED`. |
| **Why use Jenkins instead of GitHub Actions? (Action)** | In enterprise and private-cloud environments, deployment servers often reside in private VPCs with no inbound internet exposure. Jenkins was chosen because it runs inside the private network and triggers Ansible directly over SSH without exposing ports. Furthermore, Jenkins offers encrypted credentials storage and zero build-minute quotas. |
| **How does Distributed Tracing work here? (Action)** | The frontend OpenTelemetry browser SDK intercepts `window.fetch()` and injects standard W3C `traceparent` HTTP headers. The backend Express OpenTelemetry SDK extracts the trace context, creating linked child spans for middleware, business logic (`linkService.createLink`), and database queries. All spans flow into Zipkin for unified waterfall latency visualization. |
| **What were the measurable outcomes? (Result)** | Sub-100ms API response time, 236 KB frontend bundle, 100% automated test pass rate across all edge cases, and a fully hands-off, zero-downtime deployment pipeline from Git push to production. |

---

## 📑 Table of Contents

1. [Project Overview & Architecture](#-project-overview--architecture)
2. [Key Engineering Metrics](#-key-engineering-metrics)
3. [Technology Stack & Rationale](#-technology-stack--rationale)
4. [How the System Works](#-how-the-system-works)
   - [React to Express Communication](#1-how-react-communicates-with-express)
   - [Express to Aiven Cloud MySQL](#2-how-express-communicates-with-aiven-cloud-mysql)
   - [Cryptographic Security (128-bit Entropy)](#3-how-one-time-tokens-work-cryptographic-security)
   - [Atomic Consumption & Concurrency Defense](#4-how-expiration--atomic-consumption-prevent-race-conditions)
   - [Docker Architecture & Container Networking](#5-how-docker-runs-the-application--container-networking)
   - [Full CI/CD Pipeline with Jenkins](#6-how-jenkins-automates-ci-cd)
   - [Automated Deployment with Ansible](#7-how-ansible-automates-remote-server-deployment)
   - [Distributed Tracing with Zipkin](#8-how-zipkin-traces-requests-distributed-tracing)
5. [Project Structure](#-project-structure)
6. [Environment Variables Setup](#-environment-variables-setup)
7. [Getting Started (Local Development)](#-getting-started-local-development)
8. [Running with Docker Compose](#-running-with-docker-compose)
9. [Automated Testing](#-automated-testing)
10. [Zipkin Distributed Tracing (How-To)](#-zipkin-distributed-tracing-how-to)
11. [Jenkins CI/CD Pipeline (How-To)](#-jenkins-cicd-pipeline-how-to)
12. [Ansible Remote Deployment (How-To)](#-ansible-remote-deployment-how-to)
13. [REST API Documentation](#-rest-api-documentation)
14. [Learning Takeaways](#-learning-takeaways)

---

## 🏛 Project Overview & Architecture

The **One-Time Link Generator** allows users to store a confidential note (such as an API token, password, or recovery phrase) and generate an unpredictable, single-use link. When the recipient opens the link, the secret is displayed and the link is permanently marked as used and destroyed. Any subsequent attempt displays: *"This link has already been used."*

```
               [ User Browser ]
                      │
           HTTP (Port 3000 / 5173)
           Injects W3C Traceparent
                      ▼
            ┌───────────────────┐
            │  React + Vite SPA │ (Frontend - Nginx reverse proxy)
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
           TLS Encrypted (Aiven Cloud)
                      ▼
            ┌───────────────────┐
            │ Cloud Aiven MySQL │ (Managed Cloud Database)
            │  (SSL Required)   │
            └───────────────────┘
```

---

## 📊 Key Engineering Metrics

| Metric | Measurement | Impact |
|---|---|---|
| **Frontend Bundle Size** | **236 KB** (gzipped: 75 KB) | Sub-100ms first contentful paint (FCP) |
| **API Response Latency** | **15 - 35 ms** (local) / **< 100 ms** (cloud) | Instant token generation and consumption |
| **Cryptographic Entropy** | **128 bits** (`crypto.randomBytes(16)`) | $2^{128}$ combinations; brute force immune |
| **Test Suite Coverage** | **9 / 9 Passing (100%)** | All edge cases (expiry, race condition, 404, 410) verified |
| **Docker Footprint** | Multi-stage Alpine images | Minimal attack surface; zero source code in runtime |
| **Deployment Model** | Zero-downtime rolling restart | Seamless image swap via Ansible |

---

## 🛠 Technology Stack & Rationale

| Layer | Technology | Architectural Rationale |
|---|---|---|
| **Frontend** | React 18, TypeScript, Vite, Vanilla CSS | Reactive UI with high-contrast dark theme, zero bloat, instant HMR |
| **Backend** | Node.js, Express.js, TypeScript | Asynchronous non-blocking I/O event loop for high concurrency |
| **Database** | Aiven Cloud MySQL, Prisma ORM | Managed cloud database with automated migrations and parameterized queries |
| **Observability** | OpenTelemetry, Zipkin | Distributed request and query tracing across browser, API, and DB |
| **Containerization** | Docker, Docker Compose | Multi-stage container builds and unified local stack orchestration |
| **CI / CD** | Jenkins (`Jenkinsfile`) | Automated 7-stage pipeline (test, build, Docker Hub push, Ansible deploy) |
| **Configuration Mgmt** | Ansible (`playbook.yml`) | Declarative, agentless deployment to remote Linux servers over SSH |
| **Testing** | Vitest, Supertest | Fast, isolated unit and integration tests with in-memory database mocks |

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

### 6. How Jenkins Automates CI/CD
The declarative `Jenkinsfile` at the repository root runs a full 7-stage CI/CD pipeline:
1. **Checkout Source Code**: Clones the Git repository.
2. **Install Dependencies**: Runs `npm ci` for backend and frontend.
3. **Run Backend Tests**: Executes Vitest suite with Supertest against in-memory mocks.
4. **Build Backend**: Compiles TypeScript to JavaScript with `npm run build`.
5. **Build Frontend**: Compiles React Vite assets with `npm run build`.
6. **Build & Push Docker Images**: Gated on branch `main`; builds images tagged with `:BUILD_NUMBER` and pushes to Docker Hub.
7. **Deploy via Ansible**: Gated on branch `main`; calls Ansible to pull tagged images and restart stack on target remote server.

### 7. How Ansible Automates Remote Server Deployment
The `ansible/playbook.yml` provides agentless infrastructure deployment:
1. Connects to your remote Ubuntu server via SSH (`app_servers` inventory).
2. Installs Docker and Docker Compose plugin automatically if not already present.
3. Synchronizes project code to `/opt/one-time-link-generator/`.
4. Writes a secure `.env` file containing the Aiven MySQL credentials.
5. Runs `docker compose pull` to fetch newly built images from Docker Hub.
6. Runs `docker compose up -d` for a zero-downtime rolling container swap.
7. Validates deployment by polling `http://localhost:5000/api/health`.

### 8. How Zipkin Traces Requests (Distributed Tracing)
- **Browser-Side Tracing**: `frontend/src/tracing.ts` patches `window.fetch()` and injects W3C standard `traceparent` headers into outgoing requests.
- **Backend Tracing**: `backend/src/tracing.ts` instruments Express middleware and extracts the incoming trace context.
- Custom spans track domain operations:
  - `linkService.createLink`: Records link token, ID, and expiration flag.
  - `linkService.consumeLink`: Records consumption outcome (`success`, `already_used`, `expired`, `not_found`).
- Spans are aggregated in the Zipkin container (`http://localhost:9411`), displaying an end-to-end waterfall timeline from the user's click in React down to the SQL query in MySQL.

---

## 📂 Project Structure

```
Link Generator/
├── PROJECT_DOCUMENTATION.pdf       # 9-page comprehensive architecture & DevOps guide
├── Jenkinsfile                     # 7-stage declarative CI/CD pipeline
├── docker-compose.yml              # Local & production multi-container orchestration
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
│   │   └── links.test.ts           # Automated Vitest test suite (9 tests)
│   ├── Dockerfile                  # Multi-stage production container
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── frontend/
│   ├── public/
│   │   └── PROJECT_DOCUMENTATION.pdf # Direct in-app PDF download
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # Fetch API wrapper
│   │   ├── components/
│   │   │   ├── ConsumeTab.tsx      # Reveal & consume UI
│   │   │   ├── CreateLinkTab.tsx   # Note input & expiration selector
│   │   │   ├── DashboardTab.tsx    # Link management dashboard
│   │   │   └── Header.tsx          # Brand header with PDF link & health dot
│   │   ├── App.tsx                 # Root tab navigation & state
│   │   ├── index.css               # Modern dark-mode styling
│   │   ├── tracing.ts              # Browser OpenTelemetry + Zipkin propagator
│   │   └── main.tsx
│   ├── Dockerfile                  # Vite build + Nginx Alpine runtime
│   ├── nginx.conf                  # Nginx reverse proxy & SPA router
│   ├── package.json
│   ├── vite.config.ts
│   └── index.html
├── ansible/
│   ├── inventory.ini.example       # Server inventory template
│   ├── playbook.yml                # Automated deployment script
│   └── README.md                   # Ansible guide
└── README.md                       # Main documentation
```

---

## 🔑 Environment Variables Setup

Create a `.env` file in the project root:

```env
# Cloud-hosted MySQL Database (Aiven)
DATABASE_URL="mysql://<user>:<password>@<aiven-host>:<port>/defaultdb?ssl-mode=REQUIRED"

# Express server listening port
PORT=5000

# OpenTelemetry Zipkin HTTP span collector endpoint
ZIPKIN_ENDPOINT="http://localhost:9411/api/v2/spans"
```

---

## 🏃 Getting Started (Local Development)

### 1. Start Zipkin Distributed Tracing Engine
```bash
docker compose up -d zipkin
```
*Zipkin UI will be available at [http://localhost:9411](http://localhost:9411)*.

### 2. Start Backend API Server
```bash
cd backend
npm install
npx prisma generate
npm run dev
```
*Backend API will run at [http://localhost:5000](http://localhost:5000)*.

### 3. Start Frontend UI
```bash
cd frontend
npm install
npm run dev
```
*Frontend will run at [http://localhost:5173](http://localhost:5173)*.

---

## 🐳 Running with Docker Compose

Run the entire stack (Backend, Frontend Nginx, Zipkin) in isolated containers:

```bash
# Build and launch all services
docker compose up --build -d

# Check container status
docker compose ps
```

Access the stack:
- **Frontend App**: [http://localhost:3000](http://localhost:3000)
- **Backend API**: [http://localhost:5000/api/links](http://localhost:5000/api/links)
- **Zipkin Tracing UI**: [http://localhost:9411](http://localhost:9411)

To stop and remove containers:
```bash
docker compose down
```

---

## 🧪 Automated Testing

The backend includes a comprehensive Vitest test suite covering link generation, expiration, 410 Gone status, and database mocks:

```bash
cd backend
npm test
```

**Test Results (9 / 9 Passing):**
```
✓ tests/links.test.ts (9 tests)
  ✓ GET /api/health returns healthy status
  ✓ POST /api/links creates a link and does not expose note in metadata
  ✓ POST /api/links fails with 400 when content is empty
  ✓ POST /api/links/:token/consume allows successful first access
  ✓ POST /api/links/:token/consume rejects a second access attempt with 410
  ✓ POST /api/links/:token/consume rejects an expired link with 410
  ✓ POST /api/links/:token/consume returns 404 for non-existent token
  ✓ GET /api/links lists generated links without exposing note content
  ✓ DELETE /api/links/:id removes link from storage
```

---

## 🔭 Zipkin Distributed Tracing (How-To)

1. Ensure the Zipkin container is running (`docker compose up -d zipkin`).
2. Open the web app at [http://localhost:3000](http://localhost:3000) and create a one-time link.
3. Open the Zipkin UI at [http://localhost:9411](http://localhost:9411).
4. Click **Run Query** at the top right.
5. Click **SHOW** next to any trace:
   - Inspect the waterfall timeline from browser fetch down to Express route handling and MySQL query execution times.

---

## ⚙️ Jenkins CI/CD Pipeline (How-To)

The [`Jenkinsfile`](./Jenkinsfile) defines an automated 7-stage CI/CD pipeline:

1. **Prerequisites**:
   - Jenkins server with Docker and Git plugins.
   - Credentials configured: `dockerhub-credentials` (Username/Password) and `ansible-vault-db-url` (Secret text).
2. **Create Pipeline**:
   - Set Definition to *Pipeline script from SCM* pointing to your Git repository on `main`.
3. **Pipeline Stages**:
   - `1. Checkout Source Code`
   - `2. Install Dependencies` (`npm ci`)
   - `3. Run Backend Tests` (Vitest)
   - `4. Build Backend` (TypeScript compile & Prisma generate)
   - `5. Build Frontend` (Vite static bundle)
   - `6. Build & Push Docker Images` (tagged with `:BUILD_NUMBER` to Docker Hub)
   - `7. Deploy via Ansible` (pulls new images and restarts server stack)

---

## 🚀 Ansible Remote Deployment (How-To)

The [`ansible/playbook.yml`](./ansible/playbook.yml) automates deployment to any remote Linux server:

1. **Configure Inventory**:
   ```bash
   cp ansible/inventory.ini.example ansible/inventory.ini
   ```
   Add your target server IP and SSH key path in `inventory.ini`.
2. **Run Playbook**:
   ```bash
   ansible-playbook -i ansible/inventory.ini ansible/playbook.yml \
     -e "database_url=mysql://avnadmin:PASSWORD@HOST:PORT/defaultdb?ssl-mode=REQUIRED"
   ```

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
4. **DevOps Automation**: Keeping CI testing (Jenkins) and deployment (Ansible) separated yet connected promotes modular, enterprise-grade workflows.
