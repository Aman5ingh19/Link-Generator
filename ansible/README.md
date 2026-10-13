# Ansible Deployment Automation

This directory contains automated provisioning and deployment scripts for deploying the **One-Time Link Generator** to any remote Ubuntu/Debian Linux server (such as an AWS EC2 instance, DigitalOcean Droplet, Hetzner VPS, or Linode instance).

---

## What is Ansible?

Ansible is an open-source IT automation engine. It uses simple **YAML** files (called *Playbooks*) to describe the desired state of a server. Unlike traditional deployment scripts, Ansible is:

1. **Agentless**: You do not need to install software on the remote server; Ansible talks over standard SSH.
2. **Idempotent**: Running the playbook multiple times produces the same desired state without duplicating resources or breaking existing configurations.
3. **Declarative**: You declare *what* state you want (e.g., "Docker must be installed", "directory must exist"), not how to script every bash step.

---

## Files in this Directory

- `inventory.ini.example`: Template defining remote server addresses and SSH authentication settings.
- `playbook.yml`: The deployment script that provisions Docker, copies files, configures `.env`, and launches containers with `docker compose up -d`.

---

## Step-by-Step Deployment Instructions

### 1. Prerequisites on your local machine / control node

Install Ansible on your machine:
```bash
# Ubuntu / Debian
sudo apt update && sudo apt install -y ansible

# macOS
brew install ansible

# Python Pip
pip install ansible
```

### 2. Configure Your Inventory

Copy the example inventory:
```bash
cp ansible/inventory.ini.example ansible/inventory.ini
```

Edit `ansible/inventory.ini` and replace:
- `203.0.113.10` with your remote server's public IP address.
- `ubuntu` with your remote SSH username.
- `~/.ssh/id_rsa` with the path to your private SSH key.

### 3. Test SSH Connectivity

Run an Ansible "ping" module to verify your credentials:
```bash
ansible -i ansible/inventory.ini app_servers -m ping
```
You should see:
```json
webserver1 | SUCCESS => {
    "changed": false,
    "ping": "pong"
}
```

### 4. Run the Playbook

Execute the deployment playbook and pass your cloud Aiven MySQL connection string:

```bash
ansible-playbook -i ansible/inventory.ini ansible/playbook.yml \
  -e "database_url=mysql://avnadmin:YOUR_PASSWORD@your-mysql-host.aivencloud.com:12345/defaultdb?ssl-mode=REQUIRED"
```

### 5. What the Playbook Does

1. **System Updates**: Updates `apt` cache and installs prerequisites (`curl`, `ca-certificates`, `rsync`).
2. **Docker Installation**: Automatically installs Docker Engine and Docker Compose if missing, then starts the Docker service.
3. **Directory Creation**: Creates `/opt/one-time-link-generator` on the server.
4. **Code Synchronization**: Uses `rsync` to synchronize your frontend, backend, and Docker configs.
5. **Secure Configuration**: Writes `/opt/one-time-link-generator/.env` with strict `0600` permissions.
6. **Container Launch**: Executes `docker compose up -d --build` to run the stack.
7. **Health Verification**: Queries `http://localhost:5000/api/health` to confirm the backend came online.

### 6. Accessing Your Deployed App

- **Frontend Web App**: `http://<SERVER_IP>:3000`
- **Backend REST API**: `http://<SERVER_IP>:5000/api/links`
- **Zipkin Tracing UI**: `http://<SERVER_IP>:9411`
