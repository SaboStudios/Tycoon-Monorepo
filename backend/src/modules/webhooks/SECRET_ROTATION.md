# Webhook Secret Rotation Playbook

To maintain security, webhook secrets should be rotated periodically or in case of a suspected breach.

## Steps to Rotate

1. **Generate New Secret**: Generate a new cryptographically strong secret.
   ```bash
   openssl rand -hex 32
   ```

2. **Update Environment Variable**: Update `WEBHOOK_SECRET` in the production environment settings.
   - If using a secret manager (AWS Secrets Manager, Vault), update the secret value.
   - If using `.env` files, update the value and restart the service.

3. **Update External Provider**: Log in to the external provider's dashboard (e.g., Stripe, PayPal) and update the webhook secret there.

4. **Verify**: Send a test webhook to ensure the new secret is working correctly.

## Grace Period (Optional)
For zero-downtime rotation, the service can be updated to support two secrets during the transition period.
Currently, this implementation only supports one secret. If zero-downtime is required, update `WebhooksService` to accept an array of secrets and check each one.
