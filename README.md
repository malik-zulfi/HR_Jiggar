# Jiggar: AI-Powered Candidate Assessment

Jiggar is an intelligent recruitment assistant built with Next.js and Google's Genkit. It streamlines the hiring process by providing AI-powered analysis of Job Descriptions (JDs) and candidate CVs, helping you make faster, more informed hiring decisions.

## Core Features

- **Job Description Analysis**: Upload a JD, and the AI will deconstruct it into a structured format, identifying key responsibilities, skills (technical and soft), experience, education, and certifications. It automatically categorizes each requirement as "MUST-HAVE" or "NICE-TO-HAVE". You can even edit the extracted requirements and their weights to fine-tune the assessment criteria.

- **Automated CV Assessment**: Assess multiple candidates simultaneously against a structured JD. The AI provides a detailed alignment score, a summary of strengths and weaknesses, and targeted interview questions for each candidate.

- **Centralized Candidate Database**: All uploaded CVs are parsed and stored in a central database, automatically tagged with a job code. This allows you to easily search, filter, and manage your talent pool.

- **Automated Suitability Matching**: The system automatically checks candidates in your database against new job openings that share the same job code, notifying you of potential matches you might have missed.

- **Comprehensive Dashboard**: Get a high-level overview of your recruitment pipeline with data visualizations for candidate distribution, top performers, and recent assessment activities.

- **Data Portability**: Easily export all your application data (assessments, candidate database, etc.) to a JSON file for backup or migration, and import it back when needed.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router)
- **Generative AI**: [Google Genkit](https://firebase.google.com/docs/genkit) with Gemini models
- **UI**: [React](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [ShadCN UI](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
- **State Management**: React Context with `localStorage` for persistence.

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### 1. Get the Code

You can either export the project as a ZIP file from Firebase Studio or connect it to a GitHub repository and clone it.

```bash
# Replace with your repository URL
git clone https://github.com/your-username/your-repository-name.git
cd your-repository-name
```

### 2. Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later recommended)
- `npm` (which comes with Node.js)

### 3. Set Up Environment Variables

This project uses Genkit to connect to Google's Generative AI models. You'll need a Google AI API key.

1.  In the root of the project, create a file named `.env.local` by copying the `.env` file.
2.  Add your API key to this file:

    ```
    GOOGLE_API_KEY="your_api_key_here"
    ```

    You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 4. Install Dependencies

Open a terminal in the project's root directory and run:

```bash
npm install
```

This will install all the necessary packages for the application.

### 5. Run the Development Servers

For the application to work correctly, you need to run two separate processes in two different terminals from the project root.

**Terminal 1: Start the Next.js Frontend**

```bash
npm run dev
```

This will start the Next.js application, usually on `http://localhost:3000`.

**Terminal 2: Start the Genkit AI Server**

```bash
npm run genkit:dev
```

This starts the Genkit development server, which handles the AI-powered features. It provides a development UI, typically on `http://localhost:4000`, where you can inspect your AI flows.

Once both servers are running, you can open `http://localhost:3000` in your browser to use the application.

## Project Structure

Here is an overview of the key directories and files in the project:

```
.
├── src
│   ├── app/                # Next.js App Router pages (UI for each main view)
│   │   ├── assessment/
│   │   ├── cv-database/
│   │   ├── notifications/
│   │   ├── layout.tsx
│   │   └── page.tsx        # Dashboard page
│   │
│   ├── components/         # Reusable React components
│   │   ├── ui/             # ShadCN UI components
│   │   ├── client-provider.tsx # Global state management (Context)
│   │   └── ...
│   │
│   ├── ai/                 # All Genkit-related code
│   │   ├── flows/          # Individual AI agent flows (e.g., CV parsing, JD analysis)
│   │   └── genkit.ts       # Genkit initialization and configuration
│   │
│   ├── lib/                # Shared utilities and types
│   │   ├── types.ts        # Zod schemas and TypeScript types for all data structures
│   │   ├── utils.ts        # General utility functions (e.g., cn for classnames)
│   │   └── retry.ts        # `withRetry` utility for robust AI calls
│   │
│   └── hooks/              # Custom React hooks
│       └── use-toast.ts
│
├── public/                 # Static assets
└── ...                     # Configuration files (next.config.ts, tailwind.config.ts, etc.)
```

This should give you a complete picture of the project and how to get started. Let me know if you have any other questions!
