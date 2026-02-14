# Variables de entorno

## REDIS_URL

Required for on-demand PMS sync. The API enqueues sync jobs to Redis; the worker (mordecai-workers) processes them.

**Example:** `redis://localhost:6379` or your Upstash/Redis URL.

If not set, `POST .../pms-connections/:id/sync` will return an error asking to set REDIS_URL.

---

## CREDENTIALS_ENCRYPTION_KEY

Obligatoria para crear o usar conexiones PMS (connectors). Las credenciales se guardan encriptadas en la base de datos con AES-256-GCM.

**Formato:** clave de 32 bytes codificada en **base64**.

**Generar una clave:**

```bash
openssl rand -base64 32
```

O con Node:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Ejemplo en `.env`:**

```
CREDENTIALS_ENCRYPTION_KEY=K7gNU3sdo+OL0wNhqoVWhr3g6s1xYv72ol/pe/Unols=
```

También se acepta la misma clave en **hex** (64 caracteres), pero base64 es lo recomendado.

Si no defines esta variable, la API arranca igual; al intentar crear, actualizar o probar una conexión PMS fallará con un error indicando que falta la clave.
