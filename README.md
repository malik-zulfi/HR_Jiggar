# Firebase Studio

This is a NextJS starter in Firebase Studio.

To get started, take a look at src/app/page.tsx.

## Running Locally

To run this application on your local machine, follow these steps:

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later)
- npm (usually comes with Node.js)

### 2. Set up Environment Variables

This project uses Genkit to connect to Google's Generative AI models. You'll need a Google AI API key.

1.  Open the `.env` file in the root of the project.
2.  Add your API key to the file like this:

    ```
    GOOGLE_API_KEY="your_api_key_here"
    ```

    You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Install Dependencies

Open your terminal in the project root and run:

```bash
npm install
```

### 4. Run the Development Servers

You need to run two separate processes in two different terminal windows from the project root.

**Terminal 1: Start the Next.js Frontend**

```bash
npm run dev
```

This will start the Next.js application, usually on `http://localhost:3000`.

**Terminal 2: Start the Genkit AI Server**

```bash
npm run genkit:dev
```

This starts the Genkit development server, which handles the AI-powered features.

Once both servers are running, you can open `http://localhost:3000` in your browser to use the application.
