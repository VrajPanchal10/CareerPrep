# CareerPrep

### *Prepare. Practice. Perform.*

**CareerPrep** is an advanced AI-powered career preparation platform designed to help candidates analyze resumes, practice interview questions, evaluate coding skills, defend GitHub project portfolios, and track overall placement readiness.

---

## 🚀 Live Demo

🔗 **[View Live Demo](https://careerprep-platform.vercel.app/)**

---


## 🚀 Core Features

- **ATS Resume Analysis & Feedback**: Scans resume text layers, compares with job descriptions, evaluates keyword densities, and recommends optimizations.
- **Weakness Heatmap & Topic Breakdown**: Interactive metrics dashboard mapping candidate skill gaps and strength categories.
- **Monaco Coding Workspace**: Fully interactive code editor supporting multiple languages (JavaScript, TypeScript, Python, Java, C++, C) and delivering semantic complexity evaluations.
- **Voice-to-Voice Mock Interview Simulator**: Speaks mock questions, records transcriptions, and evaluates answers based on communication flow and the STAR framework.
- **GitHub Repository Defense Interviewing**: Recursively audits repository trees, analyzes configuration and manifest structures, generates a Codebase Health report, and triggers mock defense sessions challenging architectural tradeoffs.
- **Security Hardening**: Stateless CSRF tokens, Helmet security headers, rate-limiting, and blacklisted JWT cookie verifications.
- **PDF Performance Reports**: Generates polished multi-page A4 scorecards compiling resume matches, readiness statistics, and Project Mastery results.

---

## 🛠️ Tech Stack

### Frontend
- **React 19** & **Vite**
- **SCSS (Sass)** variables styling
- **Monaco Editor** (`@monaco-editor/react`)
- **React Router 7**

### Backend
- **Node.js** & **Express**
- **Mongoose / MongoDB**
- **Google Gen AI SDK** (`@google/genai` with Gemini models)
- **Puppeteer** (PDF compilation)
- **express-rate-limit** & **helmet**

---

## 📦 Installation & Setup

### Prerequisites
- Node.js (v18+)
- MongoDB connection string
- Gemini API Key

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file:
   ```env
   PORT=3000
   MONGO_URI=mongodb://localhost:27017/careerprep
   JWT_SECRET=your_jwt_secret_key
   GOOGLE_GENAI_API_KEY=your_gemini_api_key
   ```
4. Start development server:
   ```bash
   npm run dev
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏛️ System Architecture

```
                       ┌─────────────────────────┐
                       │      React Frontend     │
                       └────────────┬────────────┘
                                    │
                                    ▼ (Axios API Calls)
                       ┌─────────────────────────┐
                       │     Express Backend     │
                       └────────────┬────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                       ▼                       ▼
┌───────────────────────┐ ┌───────────────────────┐ ┌───────────────────────┐
│     MongoDB Atlas     │ │     Gemini API        │ │      Puppeteer        │
│   (User, Analytics,   │ │ (Model Schema Grading)│ │   (PDF Performance)   │
│    Repo Analysis)     │ │                       │ │                       │
└───────────────────────┘ └───────────────────────┘ └───────────────────────┘
```

---

## 🗺️ Future Roadmap
- Integrated Voice-to-Voice AI simulator for GitHub Project Defense.
- Multi-user peer-review mock lobbies.
- Direct OAuth integrations with private repository trees.
