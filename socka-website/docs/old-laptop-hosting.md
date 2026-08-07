# Hosting Socka on an old Linux laptop

The public website must run the built Astro Node server. `npm run dev` is only for development and should not be used as an always-on production process.

## 1. Prepare the laptop

Install Git, Node.js 22 or newer, npm and `cloudflared`. Prefer a system-wide Node installation so `systemd` can use `/usr/bin/npm` without loading an interactive shell.

Verify the installation:

```bash
node --version
npm --version
command -v npm
```

If `command -v npm` does not return `/usr/bin/npm`, update `ExecStart` in the service file below to the returned absolute path.

## 2. Install and build the website

Clone or copy the repository to the laptop. Do not copy `node_modules`; install dependencies on the laptop instead.

Create `/home/YOUR_USER/socka-website/.env` with the production values before building. At minimum, verify that `PUBLIC_SITE_URL=https://socka.hr` and that all live Stripe, webhook, Customer Portal and bank-payment variables are present. Never commit this file. Astro compiles public environment values during the build, so rebuild after changing them.

```bash
cd /home/YOUR_USER/socka-website
npm ci
npm run check
npm test
npm run build
```

Test the production server locally:

```bash
HOST=127.0.0.1 PORT=4321 npm start
```

In another terminal:

```bash
curl --fail --head http://127.0.0.1:4321/
```

Stop the temporary server with `Ctrl+C` after the check succeeds.

## 3. Start the website automatically

Copy the supplied service template and replace every `CHANGE_ME` with the Linux username. Also adjust the repository path or npm path if they differ.

```bash
sudo cp deploy/systemd/socka-website.service.example /etc/systemd/system/socka-website.service
sudo nano /etc/systemd/system/socka-website.service
sudo systemctl daemon-reload
sudo systemctl enable --now socka-website
```

Verify the service and follow its logs:

```bash
sudo systemctl status socka-website
sudo journalctl -u socka-website -f
```

The service binds only to `127.0.0.1:4321`. This keeps the Node server private while Cloudflare Tunnel provides the public HTTPS connection.

## 4. Connect Cloudflare Tunnel

In Cloudflare, create or open a remotely managed tunnel and add these public hostnames:

- `socka.hr` to `http://localhost:4321`
- `www.socka.hr` to `http://localhost:4321`, or redirect `www` to `https://socka.hr`

On the laptop, copy the Linux installation command shown by Cloudflare. It has this form:

```bash
sudo cloudflared service install YOUR_TUNNEL_TOKEN
```

The token is a secret. Do not put it in the repository, screenshots or shell history that other users can read.

Verify that the tunnel starts at boot:

```bash
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared
```

No router port forwarding is required for Cloudflare Tunnel.

## 5. Configure Stripe for the public domain

Before accepting live donations, confirm all of the following:

- Stripe Checkout success and cancel URLs use `https://socka.hr`.
- The live webhook endpoint is `https://socka.hr/api/stripe/webhook`.
- `STRIPE_WEBHOOK_SECRET` belongs to that live webhook endpoint.
- Live Stripe keys are paired with live Product and Price IDs.
- The Customer Portal URL comes from the same live Stripe account.

Run a real low-value payment and a monthly subscription test, then verify the Checkout redirect, webhook delivery, thank-you page, receipt and Customer Portal cancellation flow.

## 6. Deploy later updates

After pulling new code, rebuild before restarting the service:

```bash
cd /home/YOUR_USER/socka-website
git pull --ff-only
npm ci
npm run check
npm test
npm run build
sudo systemctl restart socka-website
sudo systemctl status socka-website
```

The built `dist/` directory is what the production service runs. Editing source files without rebuilding does not update the live site.

## 7. Keep the laptop available

- Disable automatic suspend while connected to power.
- Configure lid-close behavior to do nothing if the laptop will run closed.
- Use Ethernet when possible.
- In BIOS/UEFI, enable power-on or restore after AC power loss if available.
- Keep the laptop ventilated and remove a swollen or unsafe battery.
- Enable Cloudflare tunnel health notifications and monitor the website externally.

Reboot once before launch and verify both services recover without logging in:

```bash
sudo reboot
```

After the laptop returns, check `https://socka.hr`, then inspect:

```bash
systemctl status socka-website cloudflared
```
