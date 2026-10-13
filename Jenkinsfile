// =============================================================================
// Jenkinsfile: Continuous Integration (CI) Pipeline for One-Time Link Generator
// =============================================================================
// Purpose:
//   This beginner-friendly Jenkins pipeline automates testing and building both
//   the Node.js/Express backend and the React/Vite frontend whenever code changes.
//
// Pipeline Stages:
//   1. Checkout Source Code
//   2. Install Dependencies (Backend & Frontend)
//   3. Run Backend Tests (Vitest & Supertest)
//   4. Build Backend (TypeScript compilation & Prisma client generation)
//   5. Build Frontend (Vite static bundle generation)
//   6. Pipeline Result Notification (Success/Failure status)
// =============================================================================

pipeline {
    agent any

    environment {
        CI = 'true'
        NODE_ENV = 'test'
    }

    stages {
        // Stage 1: Checkout source repository
        stage('1. Checkout Source Code') {
            steps {
                echo '===> [Stage 1] Checking out source repository...'
                checkout scm
            }
        }

        // Stage 2: Install dependencies for both tiers
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

        // Stage 3: Run backend unit and integration tests
        stage('3. Run Backend Tests') {
            steps {
                echo '===> [Stage 3] Executing automated backend tests...'
                dir('backend') {
                    // Generates Prisma mock types and runs vitest test suite
                    sh 'npx prisma generate'
                    sh 'npm test'
                }
            }
        }

        // Stage 4: Compile backend TypeScript code
        stage('4. Build Backend') {
            steps {
                echo '===> [Stage 4] Compiling Backend TypeScript to JavaScript...'
                dir('backend') {
                    sh 'npm run build'
                }
            }
        }

        // Stage 5: Build frontend static distribution
        stage('5. Build Frontend') {
            steps {
                echo '===> [Stage 5] Bundling Frontend React application with Vite...'
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }
    }

    // Stage 6 / Post conditions: Report pipeline outcome
    post {
        success {
            echo '====================================================='
            echo '🎉 CI PIPELINE SUCCEEDED!'
            echo 'All tests passed and build artifacts generated cleanly.'
            echo 'Ready for Docker containerization or Ansible deployment.'
            echo '====================================================='
        }
        failure {
            echo '====================================================='
            echo '❌ CI PIPELINE FAILED!'
            echo 'One or more stages (dependencies, tests, or builds) failed.'
            echo 'Please review the stage console logs above for errors.'
            echo '====================================================='
        }
        always {
            echo 'Pipeline execution complete.'
        }
    }
}
