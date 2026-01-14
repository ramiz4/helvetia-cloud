# 🚀 Deployment Guide

Helvetia Cloud is designed for easy deployment to any Linux VPS using Docker and Docker Compose. We provide an automated setup routine directly within the Admin Dashboard to simplify the process.

## 📋 Prerequisites

- **Server**: A Linux VPS (Ubuntu 22.04 LTS recommended)
- **Resources**: Minimum 2 vCPU, 4GB RAM (8GB recommended for heavier workloads)
- **Network**:
  - Public IP Address
  - Port **80** (HTTP) open
  - Port **443** (HTTPS) open
- **Domain**: A domain name configured with A records pointing to your server IP:
  - `yourdomain.com` (Main Dashboard)
  - `api.yourdomain.com` (API)
  - `monitor.yourdomain.com` (Grafana)

## 🛠️ Automated Deployment (Recommended)

The easiest way to deploy Helvetia Cloud is using the built-in generator in the Admin Dashboard.

### 1. Generate Setup Script

1.  Run Helvetia Cloud locally (`pnpm dev`).
2.  Navigate to **Admin Dashboard** > **Server Setup** (`/admin/server-setup`).
3.  Fill in the configuration details:
    - **Domain Name**: Your production domain (e.g., `helvetia.cloud`).
    - **Email**: Admin email for Let's Encrypt SSL notifications.
    - **Passwords**: Set strong passwords for Postgres and Grafana.
    - **GitHub OAuth**: Client ID and Secret for GitHub authentication.
    - **Secrets**: Generate secure random strings for JWT and Cookie signing.
4.  The generated script will appear on the right. Click **Copy Script**.

### 2. Run on Server

1.  SSH into your VPS:
    ```bash
    ssh user@your-server-ip
    ```
2.  Create the setup file and paste the content:
    ```bash
    nano setup.sh
    # Paste the copied script
    # Save and exit (Ctrl+X, Y, Enter)
    ```
3.  Make the script executable and run it:
    ```bash
    chmod +x setup.sh
    ./setup.sh
    ```

### What the script does:

- Updates system packages.
- Installs Docker and Docker Compose (if missing).
- Clones the Helvetia Cloud repository.
- Creates a `.env` file with your configuration.
- Sets up directory structure for persistent volumes.
- Builds production Docker images.
- Starts the stack using `docker-compose.prod.yml`.

---

## 🔧 Manual Deployment

If you prefer to configure everything manually, follow these steps.

### 1. Install Docker

Ensure Docker and Docker Compose are installed and the user has permission to run Docker commands.

### 2. Clone Repository

```bash
git clone https://github.com/ramizloki/helvetia-cloud.git /opt/helvetia
cd /opt/helvetia
```

### 3. Configure Environment

Create a `.env` file based on the example:

```bash
cp .env.example .env
nano .env
```

**Critical Production Variables:**

- `NODE_ENV=production`
- `DOMAIN_NAME=yourdomain.com`
- `ACME_EMAIL=admin@yourdomain.com` (For SSL)
- `POSTGRES_PASSWORD` (Use a strong password)
- `GRAFANA_PASSWORD` (Use a strong password)

### 4. Start Production Stack

Use the production Compose file to start services:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 🏗️ Production Architecture

The production stack (`docker-compose.prod.yml`) differs from development:

| Service          | Role            | Production Configuration                                                                         |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| **Traefik**      | Reverse Proxy   | Manages **SSL certificates** (Let's Encrypt) and routes traffic to services based on subdomains. |
| **API**          | Backend         | Runs as a built Node.js app (not `tsx watch`). Scalable stateless container.                     |
| **Worker**       | Background Jobs | Runs built worker code. Has valid Docker socket access via **Socket Proxy** for security.        |
| **Dashboard**    | Frontend        | Next.js running in **standalone** mode for optimized performance.                                |
| **Docker Proxy** | Security        | Grants only necessary permissions (start/stop/inspect) to Worker and Traefik.                    |

## 🔍 Verification

After deployment, verify the services are accessible:

- **Dashboard**: `https://yourdomain.com`
- **API**: `https://api.yourdomain.com/health`
- **Monitoring**: `https://monitor.yourdomain.com` (Login with configured Grafana password)

## 🔄 Updates

To update your production instance to the latest version:

```bash
cd /opt/helvetia
git pull
docker compose -f docker-compose.prod.yml up -d --build
```
