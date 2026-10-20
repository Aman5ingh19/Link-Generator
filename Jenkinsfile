// =============================================================================
// Jenkinsfile: Full CI/CD Pipeline for One-Time Link Generator
// =============================================================================
// Purpose:
//   This beginner-friendly Jenkins pipeline automates testing, building, and
//   deploying both the Node.js/Express backend and the React/Vite frontend
//   on every push to the main branch.
//
// CI Pipeline Stages (always run):
//   1. Checkout Source Code
//   2. Install Dependencies (Backend & Frontend)
//   3. Run Backend Tests (Vitest & Supertest)
//   4. Build Backend (TypeScript compilation & Prisma client generation)
//   5. Build Frontend (Vite static bundle generation)
//
// CD Pipeline Stages (run only on 'main'/'master' branch):
//   6. Build & Push Docker Images (Backend + Frontend to Docker Hub)
//   7. Deploy via Ansible (pulls new images and restarts stack on remote server)
//
// Jenkins Setup Requirements:
//   - Credential ID 'dockerhub-credentials': Docker Hub username/password pair
//   - Credential ID 'ansible-vault-db-url': Secret text containing Aiven DATABASE_URL
//   - Docker plugin installed on Jenkins (for docker.build / docker.withRegistry)
//   - Ansible installed on Jenkins agent (for ansible-playbook command)
//   - ansible/inventory.ini configured with your server IP and SSH key path
// =============================================================================

pipeline {
    agent any

    // -------------------------------------------------------------------------
    // Global Environment Variables
    // -------------------------------------------------------------------------
    environment {
        CI       = 'true'
        NODE_ENV = 'test'

        // --- Docker Hub Settings ---
        // IMPORTANT: Replace 'your-dockerhub-username' with your Docker Hub username
        DOCKER_USER           = 'your-dockerhub-username'
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'

        BACKEND_IMAGE  = "${DOCKER_USER}/link-generator-backend"
        FRONTEND_IMAGE = "${DOCKER_USER}/link-generator-frontend"

        // --- Ansible Credential ---
        // Jenkins secret text credential ID holding the full Aiven MySQL connection string
        ANSIBLE_DB_URL_CRED_ID = 'ansible-vault-db-url'
    }

    stages {

        // =====================================================================
        // STAGE 1 — Checkout Source Code
        // =====================================================================
        stage('1. Checkout Source Code') {
            steps {
                echo '===> [Stage 1] Checking out source repository...'
                checkout scm
            }
        }

        // =====================================================================
        // STAGE 2 — Install Dependencies
        // =====================================================================
        stage('2. Install Dependencies') {
            steps {
                echo '===> [Stage 2] Installing backend and frontend npm dependencies...'
                dir('backend') {
                    sh 'npm ci'
                }
                dir('frontend') {
                    sh 'npm ci'
                }
            }
        }

        // =====================================================================
        // STAGE 3 — Run Backend Tests (Vitest + Supertest)
        // =====================================================================
        stage('3. Run Backend Tests') {
            steps {
                echo '===> [Stage 3] Executing automated backend tests...'
                dir('backend') {
                    // Generate Prisma client types (needed even for in-memory mocked tests)
                    sh 'npx prisma generate'
                    // Run the Vitest suite (9 tests, all in-memory - no live DB needed)
                    sh 'npm test'
                }
            }
        }

        // =====================================================================
        // STAGE 4 — Build Backend (TypeScript to JavaScript)
        // =====================================================================
        stage('4. Build Backend') {
            steps {
                echo '===> [Stage 4] Compiling Backend TypeScript to JavaScript...'
                dir('backend') {
                    sh 'npm run build'
                }
            }
        }

        // =====================================================================
        // STAGE 5 — Build Frontend (React + Vite bundle)
        // =====================================================================
        stage('5. Build Frontend') {
            steps {
                echo '===> [Stage 5] Bundling Frontend React application with Vite...'
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        // =====================================================================
        // STAGE 6 — Build & Push Docker Images  [CD - main branch only]
        // =====================================================================
        // Why this runs only on main: Feature branches should not auto-deploy to
        // production. The 'when' block acts as a gate.
        //
        // What happens here:
        //   1. docker.withRegistry() authenticates to Docker Hub using the
        //      stored 'dockerhub-credentials' Jenkins credential.
        //   2. docker.build() runs `docker build -t <image>:<tag> ./backend`
        //      and `docker build -t <image>:<tag> ./frontend` using each
        //      tier's respective multi-stage Dockerfile.
        //   3. img.push(BUILD_NUMBER) pushes a versioned tag (e.g., ':42').
        //      This pinned tag enables rollback: if build 43 is broken, you
        //      can redeploy ':42' instantly.
        //   4. img.push('latest') updates the ':latest' alias so docker-compose
        //      on the server always pulls the newest stable image by default.
        // =====================================================================
        stage('6. Build & Push Docker Images') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo '===> [Stage 6] Building and pushing Docker images to Docker Hub...'
                script {
                    docker.withRegistry('https://index.docker.io/v1/', "${DOCKER_CREDENTIALS_ID}") {

                        // --- Backend Image ---
                        echo "Building: ${BACKEND_IMAGE}:${env.BUILD_NUMBER}"
                        def backendImg = docker.build("${BACKEND_IMAGE}:${env.BUILD_NUMBER}", "./backend")
                        backendImg.push()          // push versioned tag, e.g. :42
                        backendImg.push('latest')  // update :latest alias
                        echo "Pushed: ${BACKEND_IMAGE}:${env.BUILD_NUMBER} + :latest"

                        // --- Frontend Image ---
                        echo "Building: ${FRONTEND_IMAGE}:${env.BUILD_NUMBER}"
                        def frontendImg = docker.build("${FRONTEND_IMAGE}:${env.BUILD_NUMBER}", "./frontend")
                        frontendImg.push()         // push versioned tag
                        frontendImg.push('latest') // update :latest alias
                        echo "Pushed: ${FRONTEND_IMAGE}:${env.BUILD_NUMBER} + :latest"
                    }
                }
            }
        }

        // =====================================================================
        // STAGE 7 — Deploy via Ansible  [CD - main branch only]
        // =====================================================================
        // Why: After Docker images land on Docker Hub, we need to apply them
        //      to the running production server. Ansible handles this declaratively
        //      via SSH without needing to log into the server manually.
        //
        // What happens here:
        //   1. withCredentials() pulls the Aiven DATABASE_URL from Jenkins secrets
        //      and injects it as an environment variable — it never appears in logs.
        //   2. `ansible-playbook` connects to the server defined in inventory.ini.
        //   3. The -e flags pass the exact image tags to use (versioned, not :latest)
        //      so the server deploys precisely the image that passed CI.
        //   4. The playbook runs `docker compose pull` then `docker compose up -d`
        //      and verifies the health endpoint responds before declaring success.
        //
        // Rollback: To revert to a previous version, re-run the pipeline for
        //           a previous build or manually run `ansible-playbook -e
        //           "backend_image=your-user/link-generator-backend:41"`.
        // =====================================================================
        stage('7. Deploy via Ansible') {
            when {
                anyOf {
                    branch 'main'
                    branch 'master'
                }
            }
            steps {
                echo '===> [Stage 7] Deploying to remote server via Ansible...'
                withCredentials([string(credentialsId: "${ANSIBLE_DB_URL_CRED_ID}", variable: 'DATABASE_URL')]) {
                    dir('ansible') {
                        sh """
                            ansible-playbook \\
                                -i inventory.ini \\
                                playbook.yml \\
                                -e "database_url=\${DATABASE_URL}" \\
                                -e "backend_image=${BACKEND_IMAGE}:${env.BUILD_NUMBER}" \\
                                -e "frontend_image=${FRONTEND_IMAGE}:${env.BUILD_NUMBER}"
                        """
                    }
                }
                echo 'Deployment complete. Server is running the latest images.'
            }
        }
    }

    // -------------------------------------------------------------------------
    // Post: Report pipeline outcome and clean up build agent disk space
    // -------------------------------------------------------------------------
    post {
        success {
            echo '====================================================='
            echo '🎉 PIPELINE SUCCEEDED!'
            echo 'CI: All tests passed and build artifacts generated cleanly.'
            echo 'CD: Docker images pushed and server deployed (main branch only).'
            echo '====================================================='
        }
        failure {
            echo '====================================================='
            echo '❌ PIPELINE FAILED!'
            echo 'One or more stages failed. Review the console logs above.'
            echo '====================================================='
        }
        always {
            // Prune dangling/untagged Docker images from the Jenkins agent
            // to prevent disk exhaustion after many builds
            sh 'docker image prune -f || true'
            echo 'Pipeline execution complete.'
        }
    }
}
