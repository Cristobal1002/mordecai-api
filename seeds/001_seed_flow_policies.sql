-- Seed: Create default flow_policies for each tenant
-- Description: Crea 3 flow_policies por defecto para cada tenant (1-5, 6-20, 21+ días)

-- Function to seed flow policies for all existing tenants
-- This function can be called after tenants are created

DO $$
DECLARE
    tenant_record RECORD;
    policy_id UUID;
BEGIN
    -- Loop through all active tenants
    FOR tenant_record IN SELECT id FROM tenants WHERE status = 'active' LOOP
        -- Skip if flow policies already exist for this tenant
        IF EXISTS (SELECT 1 FROM flow_policies WHERE tenant_id = tenant_record.id LIMIT 1) THEN
            CONTINUE;
        END IF;

        -- Policy 1: 1-5 days past due (Early stage - Friendly)
        INSERT INTO flow_policies (
            id,
            tenant_id,
            name,
            min_days_past_due,
            max_days_past_due,
            channels,
            tone,
            rules,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            tenant_record.id,
            'Early Stage (1-5 days)',
            1,
            5,
            '{"sms": true, "email": true, "call": false, "whatsapp": false}'::jsonb,
            'friendly',
            '{"max_promise_days": 7, "allow_installments": false}'::jsonb,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        -- Policy 2: 6-20 days past due (Mid stage - Professional)
        INSERT INTO flow_policies (
            id,
            tenant_id,
            name,
            min_days_past_due,
            max_days_past_due,
            channels,
            tone,
            rules,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            tenant_record.id,
            'Mid Stage (6-20 days)',
            6,
            20,
            '{"sms": true, "email": true, "call": true, "whatsapp": false}'::jsonb,
            'professional',
            '{"max_promise_days": 14, "allow_installments": true, "min_installments": 2, "max_installments": 4}'::jsonb,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        -- Policy 3: 21+ days past due (Late stage - Firm)
        INSERT INTO flow_policies (
            id,
            tenant_id,
            name,
            min_days_past_due,
            max_days_past_due,
            channels,
            tone,
            rules,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            tenant_record.id,
            'Late Stage (21+ days)',
            21,
            NULL, -- Open-ended
            '{"sms": true, "email": true, "call": true, "whatsapp": true}'::jsonb,
            'firm',
            '{"max_promise_days": 7, "allow_installments": true, "min_installments": 3, "max_installments": 6, "require_down_payment": true}'::jsonb,
            true,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        RAISE NOTICE 'Created flow policies for tenant: %', tenant_record.id;
    END LOOP;
END $$;

