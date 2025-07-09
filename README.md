# Jiggar: AI-Powered Candidate Assessment

This is a Next.js application built in Firebase Studio that helps you analyze job descriptions and candidate CVs using AI.

## Getting the Code

To get this project on your local machine, you have two main options:

1.  **Export as ZIP:** Use the "Export" feature in Firebase Studio to download the entire project as a `.zip` file. Unzip it on your computer to get the source code.
2.  **Connect to GitHub:** Connect this project to a new or existing GitHub repository from within Firebase Studio. Once connected, you can clone the repository to your local machine using `git`.

    ```bash
    # Replace with your actual repository URL
    git clone https://github.com/your-username/your-repository-name.git

    # Navigate into the project directory
    cd your-repository-name
    ```

After you have the code on your machine, follow the steps below to run the application.

## Running Locally

To run this application on your local machine, follow these steps:

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (version 20 or later)
- `npm` (which comes with Node.js)

### 2. Set up Environment Variables

This project uses Genkit to connect to Google's Generative AI models. You'll need a Google AI API key.

1.  In the root of the project, you will find a file named `.env`.
2.  Add your API key to this file:

    ```
    GOOGLE_API_KEY="your_api_key_here"
    ```

    You can get a free key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### 3. Install Dependencies

Open a terminal in the project's root directory and run:

```bash
npm install
```

This will install all the necessary packages for both the frontend and the AI server.

### 4. Run the Development Servers

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

This starts the Genkit development server, which handles the AI-powered features.

Once both servers are running, you can open `http://localhost:3000` in your browser to use the application.
