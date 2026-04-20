# Hetzner VPS Setup

Date: 2026-04-20
Platform: Hetzner Cloud VPS
Purpose: Autonomous Organization production compute

## Position

Hetzner VPS is the approved production compute surface in the brand spec. This document replaces generic deployment assumptions for Local No. 001.

Do not put private keys, live secrets, webhook URLs, or database passwords in Git.

## Local Inputs

The local `.env` fields are:

```bash
HETZNER_SERVER_IP=203.0.113.10
SSH_DEPLOY_USER=ao_deploy
```

`203.0.113.10` is a documentation placeholder. Replace it with the real IPv4 address from the Hetzner server details page before testing SSH.

## SSH Key

Use a dedicated production SSH key instead of reusing personal/default keys:

```bash
ssh-keygen -t ed25519 -a 100 -f ~/.ssh/ao_hetzner_ed25519 -C "ao-hetzner-production-2026-04-20"
chmod 700 ~/.ssh
chmod 600 ~/.ssh/ao_hetzner_ed25519
chmod 644 ~/.ssh/ao_hetzner_ed25519.pub
```

Print the public key:

```bash
cat ~/.ssh/ao_hetzner_ed25519.pub
```

Copy only the `.pub` output into Hetzner Cloud. Never copy or paste the private key.

## Hetzner Console

In Hetzner Cloud Console:

1. Open the Autonomous Organization project.
2. Go to `Security` or `SSH Keys`.
3. Add the public key from `~/.ssh/ao_hetzner_ed25519.pub`.
4. Name it `ao-hetzner-production-2026-04-20`.
5. Create a firewall named `ao-production-firewall`.
6. Add inbound rules:
   - TCP `22` from your current IP only while provisioning
   - TCP `80` from `0.0.0.0/0` and `::/0`
   - TCP `443` from `0.0.0.0/0` and `::/0`
7. Leave outbound unrestricted unless a later hardening pass adds explicit egress rules.
8. Create a server:
   - Image: Ubuntu 24.04 LTS
   - Type: start with CX22 or better
   - SSH key: `ao-hetzner-production-2026-04-20`
   - Firewall: `ao-production-firewall`
   - Name: `ao-production-001`
9. Copy the server IPv4 address into `.env` as `HETZNER_SERVER_IP`.

Hetzner adds selected SSH keys during server creation. If a key is added only after the server already exists, it must be added to `authorized_keys` manually.

## Local SSH Config

Add this to `~/.ssh/config`, replacing the host name with the real server IP or domain:

```sshconfig
Host ao-production
  HostName 203.0.113.10
  User root
  IdentityFile ~/.ssh/ao_hetzner_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Secure the config:

```bash
chmod 600 ~/.ssh/config
```

First connection:

```bash
ssh ao-production
```

Read the host fingerprint prompt. If the host key changes unexpectedly later, stop and investigate before accepting it.

## First Server Hardening

Run as `root` on the fresh server:

```bash
apt update
apt upgrade -y
apt install -y ufw fail2ban git curl ca-certificates gnupg unattended-upgrades
adduser --disabled-password --gecos "" ao_deploy
usermod -aG sudo ao_deploy
install -d -m 700 -o ao_deploy -g ao_deploy /home/ao_deploy/.ssh
cp /root/.ssh/authorized_keys /home/ao_deploy/.ssh/authorized_keys
chown ao_deploy:ao_deploy /home/ao_deploy/.ssh/authorized_keys
chmod 600 /home/ao_deploy/.ssh/authorized_keys
```

Keep the root SSH session open. In a second local terminal, test deploy-user SSH:

```bash
ssh -i ~/.ssh/ao_hetzner_ed25519 ao_deploy@YOUR_SERVER_IP
```

Only after `ao_deploy` login works, harden SSH:

```bash
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
printf '%s\n' \
  'PermitRootLogin prohibit-password' \
  'PasswordAuthentication no' \
  'KbdInteractiveAuthentication no' \
  'PubkeyAuthentication yes' \
  'X11Forwarding no' \
  'AllowUsers ao_deploy root' \
  > /etc/ssh/sshd_config.d/99-ao-hardening.conf
sshd -t
systemctl reload ssh
```

Configure host firewall:

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
ufw status verbose
```

## Local SSH Config After Deploy User

After `ao_deploy` works, update `~/.ssh/config`:

```sshconfig
Host ao-production
  HostName YOUR_SERVER_IP
  User ao_deploy
  IdentityFile ~/.ssh/ao_hetzner_ed25519
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3
```

Test:

```bash
ssh ao-production 'whoami && hostname && uptime'
```

Expected user:

```text
ao_deploy
```

## Production App Stack

Recommended first production stack on the VPS:

- Ubuntu 24.04 LTS
- Docker Engine and Docker Compose plugin
- Caddy for HTTPS reverse proxy
- Postgres in Docker volume or a separate managed database
- Next.js app as a Docker service
- systemd only for Docker/Caddy service supervision

Repo deployment files:

- `Dockerfile`
- `docker-compose.production.yml`
- `deploy/production.env.example`
- `deploy/Caddyfile.example`
- `deploy/Caddyfile.ip-smoke.example`
- `app/api/health/route.ts`

Server paths:

```text
/srv/autonomous-organization/app
/srv/autonomous-organization/app/.env.production
/etc/caddy/Caddyfile
```

Production compose commands must include the production env file:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml build
docker compose --env-file .env.production -f docker-compose.production.yml up -d
```

Caddy should reverse proxy the public HTTPS domain to:

```text
127.0.0.1:3000
```

Before DNS is ready, the server may temporarily use `deploy/Caddyfile.ip-smoke.example` to expose the locked app over plain HTTP by IP. This is only for smoke testing. Replace it with the production domain Caddyfile before opening checkout.

Do not open checkout until:

```bash
npm run launch:preflight -- --mode=launch
```

passes on the VPS or against the production environment.

Initial database setup inside Docker:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml run --rm app npx prisma migrate deploy
docker compose --env-file .env.production -f docker-compose.production.yml run --rm app npm run seed:production
```

## Server Stack Install

Install the stack on the VPS:

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-v2 caddy
sudo systemctl enable --now docker
sudo systemctl enable --now caddy
sudo usermod -aG docker ao_deploy
```

Open a fresh SSH session after adding `ao_deploy` to the `docker` group.

Verify:

```bash
docker --version
docker compose version
caddy version
docker ps
systemctl is-active docker
systemctl is-active caddy
```

## Current VPS State

As of 2026-04-20, the production VPS is:

- Host: `ao-production-001`
- IPv4: `62.238.9.164`
- Deploy user: `ao_deploy`
- App path: `/srv/autonomous-organization/app`
- App commit: `87b6526`
- Runtime: Docker Compose
- Reverse proxy: Caddy, currently in HTTP IP-smoke mode
- App health: healthy on `127.0.0.1:3000`
- Postgres health: healthy in Docker
- Local No. 001 production seed: `100` units, `20` each for `S`, `M`, `L`, `XL`, and `XXL`
- Public ingress: blocked until the Hetzner cloud firewall allows inbound `80/tcp` and `443/tcp`

## Immediate Next Checklist

1. Create or confirm `~/.ssh/ao_hetzner_ed25519`.
2. Add `~/.ssh/ao_hetzner_ed25519.pub` to Hetzner.
3. Create the firewall.
4. Create the VPS with the SSH key selected during server creation.
5. Replace `HETZNER_SERVER_IP` with the real IPv4.
6. Add the `ao-production` SSH config.
7. SSH as root.
8. Create `ao_deploy`.
9. Test `ao_deploy`.
10. Harden SSH and firewall.

## References

- Hetzner firewall docs: https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall/
- Hetzner server SSH-key FAQ: https://docs.hetzner.com/cloud/servers/faq/
- Hetzner SSH docs: https://docs.hetzner.com/robot/dedicated-server/security/ssh/
