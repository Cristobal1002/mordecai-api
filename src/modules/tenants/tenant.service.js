
import { tenantRepository } from './tenant.repository.js';
import { sequelize } from '../../config/database.js';
import { FlowPolicy, TenantUser } from '../../models/index.js';
import { logger } from '../../utils/logger.js';
import { getAuthIdentity } from '../../utils/auth-identity.js';
import { userService } from '../users/user.service.js';
import { BadRequestError, ConflictError, ForbiddenError } from '../../errors/index.js';

const enforceSingleTenant = process.env.ENFORCE_SINGLE_TENANT !== 'false';

export const tenantService = {
    create: async (data, req) => {
        const identity = getAuthIdentity(req);
        if (!identity.sub || !identity.email) {
            throw new ForbiddenError('Unauthorized');
        }

        return await sequelize.transaction(async (transaction) => {
            const user = await userService.ensureUserFromAuth(identity, transaction);

            if (enforceSingleTenant) {
                const existing = await userService.countActiveMemberships(user.id, transaction);
                if (existing > 0) {
                    throw new ConflictError('User already belongs to a tenant.');
                }
            }

            const tenant = await tenantRepository.create(
                {
                    ...data,
                    status: 'active',
                },
                transaction
            );

            await TenantUser.create(
                {
                    tenantId: tenant.id,
                    userId: user.id,
                    role: 'owner',
                    status: 'active',
                },
                { transaction }
            );

            await seedDefaultFlowPolicies(tenant.id, transaction);

            return tenant;
        });
    },
};

const seedDefaultFlowPolicies = async (tenantId, transaction) => {
    const existing = await FlowPolicy.count({
        where: { tenantId },
        transaction,
    });

    if (existing > 0) {
        return { created: 0, skipped: true };
    }

    const defaults = [
        {
            tenantId,
            name: 'Early Stage (1-5 days)',
            minDaysPastDue: 1,
            maxDaysPastDue: 5,
            channels: { sms: true, email: true, call: false, whatsapp: false },
            tone: 'friendly',
            rules: { max_promise_days: 7, allow_installments: false },
            isActive: true,
        },
        {
            tenantId,
            name: 'Mid Stage (6-20 days)',
            minDaysPastDue: 6,
            maxDaysPastDue: 20,
            channels: { sms: true, email: true, call: true, whatsapp: false },
            tone: 'professional',
            rules: {
                max_promise_days: 14,
                allow_installments: true,
                min_installments: 2,
                max_installments: 4,
            },
            isActive: true,
        },
        {
            tenantId,
            name: 'Late Stage (21+ days)',
            minDaysPastDue: 21,
            maxDaysPastDue: null,
            channels: { sms: true, email: true, call: true, whatsapp: true },
            tone: 'firm',
            rules: {
                max_promise_days: 7,
                allow_installments: true,
                min_installments: 3,
                max_installments: 6,
                require_down_payment: true,
            },
            isActive: true,
        },
    ];

    await FlowPolicy.bulkCreate(defaults, { transaction });
    logger.info({ tenantId }, 'Default flow policies created');
    return { created: defaults.length, skipped: false };
};
