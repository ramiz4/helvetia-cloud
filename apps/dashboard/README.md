# 🖼️ Helvetia Cloud Dashboard

The **Helvetia Cloud Dashboard** is a premium, glassmorphic management interface built with Next.js and Tailwind CSS. It provides a seamless experience for developers to deploy, manage, and monitor their applications.

## ✨ Features

- **Dashboard**: High-level overview of services and system health.
- **Service Management**: Create, configure, and delete services (Docker or Static).
- **Real-time Logs**: Stream live build and runtime logs via SSE.
- **Deployment History**: Track past deployments and rollback if necessary.
- **GitHub Integration**: Integrated repository and branch picker.
- **Settings**: Manage environment variables, custom domains, and resource limits.

## 🛠 Tech Stack

- **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State Management**: React Hooks & Context API
- **Real-time**: SSE (Server-Sent Events)

## 🚀 Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Setup Environment Variables

Create a `.env.local` file with the following:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run Development Server

```bash
pnpm dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000).

## 📁 Structure

- `src/app`: Page components and routing.
- `src/components`: Reusable UI components (ServiceCard, LogViewer, etc.).
- `src/hooks`: Custom React hooks for data fetching and real-time updates.
- `src/lib`: Utility functions and API clients.
