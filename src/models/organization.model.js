import { DataTypes, Op } from 'sequelize';

export const defineOrganizationModel = (sequelize) => {
  const Organization = sequelize.define(
    'Organization',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      
      // Basic organization info
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          len: [2, 255],
          notEmpty: true,
        },
        comment: 'Organization display name',
      },
      
      // URL-friendly identifier
      slug: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          is: /^[a-z0-9-]+$/,
          len: [2, 50],
        },
        comment: 'URL-friendly identifier for the organization',
      },
      
      // Physical identification (different from table ID)
      identificacionFisica: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true,
        validate: {
          len: [1, 100],
        },
        comment: 'Physical identification number (NIT, RUC, Tax ID, etc.) - different from table ID',
      },
      
      // Hierarchy support: organization can have parent organization
      parentId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'organizations',
          key: 'id'
        },
        comment: 'Parent organization ID for hierarchy support',
      },
      
      // Contact information - direct fields
      telefono: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          len: [1, 50],
        },
        comment: 'Organization phone number',
      },
      
      direccion: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Organization physical address',
      },
      
      // Branding
      primaryColor: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          is: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        },
        defaultValue: '#007bff',
        comment: 'Primary brand color (hex format)',
      },
      
      secondaryColor: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          is: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
        },
        comment: 'Secondary brand color (hex format)',
      },
      
      logoUrl: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: {
          isUrl: true,
        },
        comment: 'URL to organization logo image',
      },
      
      // Status and control
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Organization active status',
      },
      
      // Subscription/plan info (for future use)
      planType: {
        type: DataTypes.ENUM('free', 'basic', 'premium', 'enterprise'),
        allowNull: false,
        defaultValue: 'free',
        comment: 'Subscription plan type',
      },
      
      // Metadata for extensibility
      metadata: {
        type: DataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
        comment: 'Additional metadata for future extensibility',
      },
    },
    {
      // Table options
      tableName: 'organizations',
      paranoid: true, // Soft delete support
      timestamps: true,
      
      // Indexes for performance
      indexes: [
        {
          unique: true,
          fields: ['slug'],
        },
        {
          unique: true,
          fields: ['identificacionFisica'],
          name: 'organizations_identificacion_fisica_unique',
          where: {
            identificacionFisica: {
              [Op.ne]: null
            }
          }
        },
        {
          fields: ['parentId'],
        },
        {
          fields: ['isActive'],
        },
        {
          fields: ['planType'],
        },
        {
          fields: ['createdAt'],
        },
      ],
    }
  );

  // Instance methods
  Organization.prototype.getFullHierarchy = async function() {
    const hierarchy = [];
    let current = this;
    
    while (current) {
      hierarchy.unshift({
        id: current.id,
        name: current.name,
        slug: current.slug,
      });
      
      if (current.parentId) {
        current = await Organization.findByPk(current.parentId);
      } else {
        current = null;
      }
    }
    
    return hierarchy;
  };

  Organization.prototype.getSubOrganizations = async function(includeInactive = false) {
    const where = { parentId: this.id };
    if (!includeInactive) {
      where.isActive = true;
    }
    
    return await Organization.findAll({
      where,
      order: [['name', 'ASC']],
    });
  };

  Organization.prototype.getAllDescendants = async function() {
    const descendants = [];
    const queue = [this.id];
    
    while (queue.length > 0) {
      const parentId = queue.shift();
      const children = await Organization.findAll({
        where: { parentId, isActive: true },
      });
      
      for (const child of children) {
        descendants.push(child);
        queue.push(child.id);
      }
    }
    
    return descendants;
  };

  Organization.prototype.isDescendantOf = async function(ancestorId) {
    let current = this;
    
    while (current && current.parentId) {
      if (current.parentId === ancestorId) {
        return true;
      }
      current = await Organization.findByPk(current.parentId);
    }
    
    return false;
  };


  // Static methods
  Organization.findBySlug = async function(slug) {
    return await this.findOne({
      where: { slug, isActive: true },
    });
  };

  Organization.findRootOrganizations = async function() {
    return await this.findAll({
      where: { 
        parentId: null, 
        isActive: true 
      },
      order: [['name', 'ASC']],
    });
  };

  Organization.validateHierarchy = async function(parentId, childId) {
    if (!parentId || !childId || parentId === childId) {
      return false;
    }
    
    // Check if parent would create a circular reference
    const parent = await this.findByPk(parentId);
    if (!parent) {
      return false;
    }
    
    return !(await parent.isDescendantOf(childId));
  };

  // Hooks
  Organization.addHook('beforeValidate', (organization) => {
    // Auto-generate slug from name if not provided
    if (!organization.slug && organization.name) {
      organization.slug = organization.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');
    }
  });

  Organization.addHook('beforeCreate', async (organization) => {
    // Ensure slug uniqueness
    let baseSlug = organization.slug;
    let counter = 1;
    
    while (await Organization.findOne({ where: { slug: organization.slug } })) {
      organization.slug = `${baseSlug}-${counter}`;
      counter++;
    }
  });

  Organization.addHook('beforeDestroy', async (organization) => {
    // Soft delete all sub-organizations
    await Organization.destroy({
      where: { parentId: organization.id },
    });
  });

  return Organization;
};
