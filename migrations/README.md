# Database Migrations

Este directorio contiene las migraciones SQL para crear el esquema de la base de datos.

## Orden de ejecución

Las migraciones deben ejecutarse en el siguiente orden:

1. `001_create_tenants.sql` - Tabla base de tenants (multi-tenant)
2. `002_create_debtors.sql` - Deudores/Cartera
3. `003_create_flow_policies.sql` - Reglas de cobranza
4. `004_create_import_batches.sql` - Auditoría de importaciones XLSX
5. `005_create_debt_cases.sql` - Casos de cobranza (core)
6. `006_create_payment_agreements.sql` - Acuerdos de pago
7. `007_create_interaction_logs.sql` - Registro de interacciones omnicanal

## Ejecutar migraciones

### Usando psql:

```bash
# Conectar a la base de datos
psql -U $DB_USER -d $DB_NAME -h $DB_HOST

# Ejecutar migraciones en orden
\i migrations/001_create_tenants.sql
\i migrations/002_create_debtors.sql
\i migrations/003_create_flow_policies.sql
\i migrations/004_create_import_batches.sql
\i migrations/005_create_debt_cases.sql
\i migrations/006_create_payment_agreements.sql
\i migrations/007_create_interaction_logs.sql
```

### Usando un script:

```bash
for file in migrations/*.sql; do
    psql -U $DB_USER -d $DB_NAME -h $DB_HOST -f "$file"
done
```

## Rollback

Para hacer rollback, ejecutar en orden inverso los DROP statements correspondientes. Los tipos ENUM se pueden eliminar con `DROP TYPE IF EXISTS <type_name> CASCADE;`

