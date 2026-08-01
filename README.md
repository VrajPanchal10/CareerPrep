<div align="center">

# 🚀 CareerPrep

**AI-powered placement readiness platform — ATS resume matching, voice-to-voice mock interviews, and GitHub project defense in a single workspace.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb)](https://www.mongodb.com/atlas)
[![Gemini](https://img.shields.io/badge/Google-Gemini_AI-4285F4?style=flat-square&logo=google)](https://deepmind.google/technologies/gemini/)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-000000?style=flat-square&logo=vercel)](https://careerprep-platform.vercel.app)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7?style=flat-square&logo=render)](https://careerprep-sbm1.onrender.com)

[🌐 Web App (Vercel)](https://careerprep-platform.vercel.app) • [⚙️ Backend API (Render)](https://careerprep-sbm1.onrender.com)

---

</div>

## 📌 Quick Navigation

- [Overview](#-what-is-careerprep)
- [Why This Project Stands Out](#-why-this-project-stands-out)
- [Key Features](#-key-features)
- [AI Architecture & Gateway](#-ai-architecture--gateway)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Project Architecture](#-project-structure)
- [Database Overview](#-database-overview)
- [Security & Hardening](#-security--enterprise-hardening)
- [Performance Optimizations](#-performance-optimizations)
- [Installation & Local Setup](#-installation--local-setup)
- [Cloud Deployment](#-cloud-deployment)
- [Future Roadmap](#-future-roadmap)
- [Author](#-author)

---

## 💡 What is CareerPrep?

Most interview prep tools solve one problem in isolation. CareerPrep thread-connects candidate resumes, target Job Descriptions (JD), verbal communication skills, and real GitHub software codebases into an end-to-end placement readiness platform.

Upload your resume, paste a target job description, and CareerPrep provides an **ATS compatibility score**, a **tailored mock interview plan**, a **voice-to-voice verbal simulation**, and an **architectural defense of your actual GitHub repositories**. Everything aggregates into a unified performance dashboard and downloads as a multi-page A4 PDF scorecard.

---

## ⭐ Why This Project Stands Out

- **🤖 Multi-LLM AI Gateway:** Automatic provider failover across Gemini, Groq, and OpenRouter with built-in circuit breaking and SHA-256 prompt caching.
- **🛡️ GitHub Project Defense:** A unique feature that audits actual GitHub codebases and subjects candidates to a senior-level architectural defense.
- **🎤 Native Indian Voice AI:** Integrated Sarvam AI (`saaras:v3` STT & `bulbul:v3` TTS) for natural voice-to-voice verbal mock interviews.
- **📄 Interactive ATS Heatmaps:** Detailed side-by-side gap comparison tables matching candidate skills, projects, and work experience against JDs.
- **🔒 Enterprise Security:** Stateless CSRF header verification, AES-256-GCM OAuth token encryption, dynamic CSP nonces, and JWT in httpOnly cookies.
- **📑 Server-Side A4 PDF Exports:** Polished multi-page PDF performance scorecards compiled server-side via Puppeteer.
- **🌐 Full Production Deployment:** Live frontend on Vercel, backend on Render, and database on MongoDB Atlas.

---

## ✨ Key Features

### 📄 ATS Resume Analysis
- Parses PDF resumes and compares them against target job descriptions.
- Calculates an overall ATS match score (0–100%) broken down by technical skills, experience alignment, education, project relevance, and keyword density.
- Interactive keyword heatmap — Matched, Missing, and Extra keywords at a glance.
- Side-by-side gap comparison tables for Skills, Projects, and Work Experience.
- Generates a downloadable ATS-optimized resume PDF via server-side Puppeteer rendering.

### 🎯 Mock Interview Coach
- AI-generates technical and behavioral questions derived directly from resume + job description.
- Outlines interviewer intent behind each question alongside senior-level model answer guides.
- Grades candidate text answers on accuracy, technical depth, clarity, and conceptual coverage.
- Produces a structured day-by-day preparation roadmap targeting identified skill gaps.

### 🎤 Voice Interview Simulator (Verbal Mock)
- Full voice-to-voice interview environment directly in the browser.
- Speech-to-text via Sarvam AI (`saaras:v3`), text-to-speech via Sarvam AI (`bulbul:v3`) with dynamic Indian voice profiles (`shubh`, `shreya`).
- Evaluates verbal fluency, grammar, filler word count ("um", "basically", "like"), STAR framework structure, and response time utilization.
- Generates contextual follow-up questions from the candidate's live transcript.

### 🛡️ GitHub Project Defense
- Connects via GitHub OAuth to audit any selected repository.
- Inspects folder structure, dependency manifests (`package.json`, `requirements.txt`), and source code files to build a project knowledge graph.
- Generates a Codebase Health Report covering architectural strengths, security gaps, scalability bottlenecks, and engineering practices.
- Interactive Defense Room: AI interviewer challenges design choices, evaluates responses on accuracy, depth, and justification, asks follow-ups, and compiles a Project Mastery Scorecard.
- Zero-Empty-Card Guarantee: Sanitizes AI outputs with context-aware fallback data structures so UI components are never blank.

### 📊 Performance Analytics & PDF Exports
- Aggregates ATS scores, mock interview grades, verbal ratings, and GitHub defense masteries into a global placement readiness metric.
- Multi-page A4 PDF reports generated server-side via Puppeteer.
- Individual PDF exports for ATS audits, mock interview sessions, and GitHub defense scorecards.

---

## 🤖 AI Architecture & Gateway

CareerPrep runs a custom multi-LLM AI gateway (`Backend/src/services/aiGateway.service.js`) with circuit breaking, retry logic, and automated provider fallbacks — ensuring continuous platform uptime if any single provider experiences downtime.

```
                  ┌───────────────────────────────┐
                  │       Client User Request     │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │       AI Gateway Router       │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │   SHA-256 Response Cache?     │
                  └───────┬───────────────┬───────┘
                     HIT  │               │ MISS
                          ▼               ▼
                   [Return Cached]  ┌───────────────────────────┐
                                    │ Circuit Breaker Checked?  │
                                    └─────────────┬─────────────┘
                                                  │
                 ┌────────────────────────────────┼────────────────────────────────┐
                 │ (Structured LLM Tasks)         │ (Low-Latency Voice Tasks)      │ (Native Voice Audio)
                 ▼                                ▼                                ▼
   ┌───────────────────────────┐    ┌───────────────────────────┐    ┌───────────────────────────┐
   │ Primary: Gemini 2.5 Flash │    │ Primary: Groq Llama 3.3   │    │ Primary: Sarvam AI        │
   └─────────────┬─────────────┘    └─────────────┬─────────────┘    └───────────────────────────┘
                 │ (On Failure)                   │ (On Failure)
                 ▼                                ▼
   ┌───────────────────────────┐    ┌───────────────────────────┐
   │ Fallback 1: OpenRouter    │    │ Fallback 1: Gemini 2.5    │
   └─────────────┬─────────────┘    └───────────────────────────┘
                 │ (On Failure)
                 ▼
   ┌───────────────────────────┐
   │ Fallback 2: Groq Llama    │
   └───────────────────────────┘
```

| Layer | Provider | Model / Endpoint | Role |
| :--- | :--- | :--- | :--- |
| **Primary LLM** | Google Gemini | `gemini-2.5-flash`, `gemini-2.5-flash-lite` | Structured reasoning, ATS parsing, GitHub audits |
| **Fallback LLM** | OpenRouter | `claude-3.5-sonnet`, `deepseek-chat`, `qwen-2.5-72b`, `llama-3.3-70b` | Tertiary multi-model fallback chain |
| **Voice Interactivity** | Groq | `llama-3.3-70b-versatile` | Low-latency voice evaluation & follow-ups |
| **Speech-to-Text** | Sarvam AI | `saaras:v3` | High-accuracy Indian English speech recognition |
| **Text-to-Speech** | Sarvam AI | `bulbul:v3` | Natural Indian voice synthesis (`shubh`, `shreya`) |

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router 7 (Lazy-loaded route splitting) |
| **Styling** | SCSS / Vanilla CSS (Variables, mixins, glassmorphism design tokens) |
| **Data Viz & Icons** | Chart.js, React-Chartjs-2, Lucide React |
| **Backend** | Node.js, Express, Mongoose (MongoDB ODM) |
| **AI Gateway** | `@google/genai` (Official Gemini SDK), Groq REST, OpenRouter REST |
| **Voice AI** | Sarvam AI REST API (`saaras:v3` STT & `bulbul:v3` TTS) |
| **PDF Rendering** | Puppeteer (Server-side headless Chrome pool) |
| **Security & Auth** | JWT, bcryptjs, AES-256-GCM encryption, Helmet, CSRF Middleware, Zod |

---

## 🗄️ Database Overview

CareerPrep uses MongoDB Atlas with optimized indexes across 7 primary collections:

- `users`: User profiles, hashed credentials, connected GitHub OAuth accounts.
- `atsreports`: Uploaded resume text layers, job description match scores, keyword heatmaps, and comparison arrays.
- `interviewreports`: Tailored technical and behavioral question banks, interviewer intentions, and model answers.
- `interviewsessions`: Candidate mock session progress, submitted answers, and evaluation scores.
- `voicesessions`: Audio transcripts, Sarvam AI audio tracks, verbal fluency metrics, and filler word analytics.
- `repositoryanalyses` & `repositoryinterviews`: Knowledge graphs, codebase health reports, project defense questions, and final mastery scorecards.
- `blacklists`: Invalidated JWT tokens for stateless session revocation.

---

## 🔒 Security & Enterprise Hardening

| Feature | Implementation |
| :--- | :--- |
| **JWT Cookie Security** | Stored in `httpOnly`, `SameSite=Lax` secure cookies — prevents XSS token theft. |
| **Stateless CSRF Protection** | Double-submit cookie pattern verified via `X-CSRF-Token` headers. |
| **GitHub Token Encryption** | OAuth access tokens encrypted at rest using AES-256-GCM (`crypto`). |
| **Security Headers** | Helmet middleware configured with per-request dynamic CSP nonces. |
| **Rate Limiting** | Reverse-proxy aware IP rate limiting (`express-rate-limit`). |
| **Request Tracing** | Correlation ID assigned to every HTTP request and logged in stack traces. |

---

## ⚡ Performance Optimizations

- **Route Code-Splitting:** React 19 lazy loading across all page components reduces initial bundle payload.
- **Circuit Breaker Pattern:** Automatically bypasses primary AI models when threshold failures occur (<5ms failover).
- **SHA-256 Prompt Caching:** Caches non-conversational AI results for 1 hour using SHA-256 prompt hashes.
- **Zod Response Validation:** Enforces strict JSON schema parsing before state updates.
- **Singleton Puppeteer Pool:** Reusable headless Chrome browser instance for server-side PDF generation.
- **MongoDB Connection Pooling:** Persistent connection pool across API handlers.

---

## 🏗️ Project Structure

```
CareerPrep/
├── Backend/
│   ├── server.js                   # Entry point, DB connection, signal handlers
│   └── src/
│       ├── app.js                  # Express setup, middleware stack, route mounts
│       ├── config/                 # Database, Security, AI Gateway, & GitHub OAuth configs
│       ├── controllers/            # API request handlers (auth, ats, interview, voice, repository, settings)
│       ├── middlewares/            # Auth, CSRF, Nonce, CSP, & Request Logger middlewares
│       ├── models/                 # Mongoose database schemas
│       ├── prompts/                # Centralized AI prompt templates
│       ├── routes/                 # Express API routes
│       ├── services/               # Core business logic, AI Gateway, & provider adapters
│       │   └── providers/          # Gemini, Groq, OpenRouter, & Sarvam adapters
│       └── templates/pdf/          # EJS templates for Puppeteer PDF rendering
│
└── Frontend/
    ├── index.html                  # HTML template
    └── src/
        ├── app.routes.jsx          # React Router 7 lazy route definitions
        ├── style.scss              # Centralized SCSS design tokens
        ├── components/             # Shared Layouts & UI components
        └── features/               # Domain modules (ats, auth, githubDefense, interview, voiceInterview, analytics, settings)
```

---

## 💻 Installation & Local Setup

### Prerequisites
- Node.js v18+
- MongoDB instance (Local or Atlas)
- Google Gemini API Key

<details>
<summary><b>1. Backend Setup Instructions</b></summary>

```bash
cd Backend
npm install
```

Create a `.env` file inside `Backend/` (see `Backend/.env.example` for reference):
```env
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/careerprep
JWT_SECRET=your_jwt_secret_key

# AI Gateway Keys
GOOGLE_GENAI_API_KEY=your_gemini_api_key
Groq_API_KEY=your_groq_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
SARVAM_API_KEY=your_sarvam_api_key

# GitHub OAuth (Local Development)
LOCAL_GITHUB_CLIENT_ID=your_local_github_client_id
LOCAL_GITHUB_CLIENT_SECRET=your_local_github_client_secret
LOCAL_GITHUB_OAUTH_REDIRECT_URI=http://localhost:3000/api/github-oauth/callback
LOCAL_FRONTEND_GITHUB_REDIRECT=http://localhost:5173/github-defense
GITHUB_TOKEN_ENCRYPTION_KEY=32_byte_hex_encryption_key_here
```

Start the backend server:
```bash
npm run dev
```
</details>

<details>
<summary><b>2. Frontend Setup Instructions</b></summary>

```bash
cd Frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.
</details>

---

## 🌐 Cloud Deployment

```
   ┌──────────────────────┐          ┌──────────────────────┐          ┌──────────────────────┐
   │   React 19 Frontend  │  ──────► │   Express Backend    │  ──────► │    MongoDB Atlas     │
   │      (Vercel)        │          │      (Render)        │          │      (Database)      │
   └──────────────────────┘          └──────────────────────┘          └──────────────────────┘
```

- **Frontend:** Deployed on **Vercel** (`https://careerprep-platform.vercel.app`) with automatic SPA route rewrites.
- **Backend:** Deployed on **Render** (`https://careerprep-sbm1.onrender.com`) running Node.js runtime environment.
- **Database:** Hosted on **MongoDB Atlas** with SSL encryption and IP whitelisting.

---

## 🚀 Future Roadmap

- [ ] **Recruiter Dashboard:** Candidate talent pools and shareable placement readiness scorecards.
- [ ] **Real-Time Peer Lobbies:** Free peer-to-peer mock interview rooms with live audio/video.
- [ ] **Resume Version Control:** Historical version comparison and multi-target JD resume tracking.
- [ ] **Direct Anthropic Integration:** Direct Claude 3.5 Sonnet API integration alongside OpenRouter.
- [ ] **Progressive Web App (PWA):** Offline mobile support for preparation study guides.

---

## 👨‍💻 Author

**Vraj Panchal**
- **GitHub:** [@VrajPanchal10](https://github.com/VrajPanchal10)
- **LinkedIn:** [Vraj Panchal](https://www.linkedin.com/in/vraj-panchal-a9a104337/)
- **Email:** [vraj100106@gmail.com](mailto:vraj100106@gmail.com)

---

<div align="center">
  <sub>Built with React, Node.js, Express, MongoDB, and Multi-LLM AI Services.</sub>
</div>
