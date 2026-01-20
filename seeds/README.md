# Database Seeds

Este directorio contiene los archivos de seed para poblar la base de datos con datos iniciales.

## Seeds disponibles

### `001_seed_flow_policies.sql`

Crea 3 flow policies por defecto para cada tenant activo:

1. **Early Stage (1-5 days)** - Friendly tone
   - Canales: SMS, Email
   - No permite acuerdos de pago por cuotas
   - Promesas máximas de 7 días

2. **Mid Stage (6-20 days)** - Professional tone
   - Canales: SMS, Email, Call
   - Permite acuerdos de 2-4 cuotas
   - Promesas máximas de 14 días

3. **Late Stage (21+ days)** - Firm tone
   - Canales: SMS, Email, Call, WhatsApp
   - Permite acuerdos de 3-6 cuotas
   - Requiere pago inicial
   - Promesas máximas de 7 días

## Ejecutar seeds

```bash
# Ejecutar seed de flow_policies
psql -U $DB_USER -d $DB_NAME -h $DB_HOST -f seeds/001_seed_flow_policies.sql
```

**Nota:** Los seeds solo crearán políticas si no existen ya para cada tenant, por lo que es seguro ejecutarlos múltiples veces.

## Orden de ejecución

1. Ejecutar todas las migraciones primero
2. Ejecutar los seeds después de crear al menos un tenant

