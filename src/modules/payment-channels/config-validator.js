/**
 * Validates tenant config against configSchema.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateConfigAgainstSchema(config, schema) {
  const errors = [];
  const fields = schema?.fields ?? [];

  for (const field of fields) {
    if (field.type === 'array') {
      const arr = config?.[field.key];
      const itemFields = field.itemFields ?? [];
      const minItems = field.minItems ?? (field.required ? 1 : 0);

      if (field.required && (!Array.isArray(arr) || arr.length === 0)) {
        errors.push(`${field.label} is required`);
        continue;
      }
      if (Array.isArray(arr) && arr.length < minItems) {
        errors.push(`${field.label} requires at least ${minItems} item(s)`);
      }
      if ((field.atLeastOnePrimary || field.requireExactlyOnePrimary) && Array.isArray(arr) && arr.length > 0) {
        const primaryCount = arr.filter((item) => item?.isPrimary || item?.isDefault).length;
        if (field.requireExactlyOnePrimary) {
          if (primaryCount !== 1) {
            errors.push(`${field.label}: exactly one item must be marked as primary`);
          }
        } else if (field.atLeastOnePrimary && primaryCount < 1) {
          errors.push(`${field.label}: at least one item must be marked as primary`);
        }
      }
      if (Array.isArray(arr)) {
        for (let i = 0; i < arr.length; i++) {
          const item = arr[i] || {};
          for (const sub of itemFields) {
            if (sub.required) {
              if (sub.type === 'boolean') {
                if (item[sub.key] === undefined || item[sub.key] === null) {
                  errors.push(`${field.label} #${i + 1}: ${sub.label} is required`);
                }
              } else if (item[sub.key] == null || String(item[sub.key]).trim() === '') {
                errors.push(`${field.label} #${i + 1}: ${sub.label} is required`);
              }
            }
            if (sub.validation?.pattern && item[sub.key]) {
              const val = String(item[sub.key]).trim();
              if (val) {
                const re = new RegExp(sub.validation.pattern);
                if (!re.test(val)) {
                  errors.push(`${field.label} #${i + 1}: ${sub.label} format is invalid`);
                }
              }
            }
            if (sub.validation?.dependsOn && sub.validation?.patternByField && item[sub.key]) {
              const depVal = item[sub.validation.dependsOn];
              const pattern = depVal && sub.validation.patternByField[depVal];
              if (pattern) {
                const val = String(item[sub.key]).trim();
                if (val) {
                  const re = new RegExp(pattern);
                  if (!re.test(val)) {
                    errors.push(`${field.label} #${i + 1}: ${sub.label} format is invalid (expected ${depVal} format)`);
                  }
                }
              }
            }
            if (sub.type === 'select' && sub.options?.length && item[sub.key]) {
              const opts = sub.options.map((o) => String(o).toLowerCase());
              const val = String(item[sub.key]).toLowerCase();
              if (!opts.includes(val)) {
                errors.push(`${field.label} #${i + 1}: ${sub.label} must be one of: ${sub.options.join(', ')}`);
              }
            }
          }
        }
      }
    } else {
      const val = config?.[field.key];
      if (field.required && (val == null || String(val).trim() === '')) {
        errors.push(`${field.label} is required`);
      }
      if (field.validation?.pattern && val) {
        const trimmed = String(val).trim();
        if (trimmed) {
          const re = new RegExp(field.validation.pattern);
          if (!re.test(trimmed)) {
            errors.push(`${field.label} format is invalid`);
          }
        }
      }
      if (field.type === 'select' && field.options?.length && val) {
        const opts = field.options.map((o) => String(o).toLowerCase());
        const v = String(val).toLowerCase();
        if (!opts.includes(v)) {
          errors.push(`${field.label} must be one of: ${field.options.join(', ')}`);
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
