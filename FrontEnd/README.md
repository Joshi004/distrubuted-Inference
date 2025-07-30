# Inference UI

A simple React application with Material UI that allows you to send queries to an AI model and display the responses.

## Features

- Clean, modern UI using Material UI
- Text input for queries
- Real-time loading states
- Error handling
- Response display with proper formatting

## Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

1. Start the React development server:
```bash
npm start
```

2. Open your browser and navigate to `http://localhost:3000` (or the port shown in your terminal)

3. Make sure your inference API is running on `http://localhost:3000/inference`

## Usage

1. Enter your query in the text field
2. Click "Send Query" to submit
3. The response will appear below the input form
4. Use "Clear" to reset the form

## API Requirements

The application expects a POST endpoint at `http://localhost:3000/inference` that:
- Accepts JSON with a `query` field
- Returns JSON with a `response` field (or the response directly)

Example API response format:
```json
{
  "response": "Your model's response here"
}
``` 