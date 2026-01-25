import type { Field, SchemaBlock } from '../App';

export function generateExampleValue(field: Field): unknown {
  if (field.example !== undefined) {
    return field.example;
  }

  // Default values based on type
  switch (field.fieldType) {
    case 'string':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'array':
      if (field.nested) {
        return [generateExampleFromSchema(field.nested)];
      }
      return [];
    case 'object':
      if (field.nested) {
        return generateExampleFromSchema(field.nested);
      }
      return {};
    default:
      return '';
  }
}

export function generateExampleFromSchema(schema: SchemaBlock): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const field of schema.fields) {
    // Skip params fields as they are query parameters, not body fields
    if (field.isParams) {
      continue;
    }

    if (field.nested) {
      if (field.fieldType === 'array') {
        result[field.name] = [generateExampleFromSchema(field.nested)];
      } else {
        result[field.name] = generateExampleFromSchema(field.nested);
      }
    } else {
      result[field.name] = generateExampleValue(field);
    }
  }

  return result;
}

export function hasBodyFields(schema?: SchemaBlock): boolean {
  if (!schema?.fields) return false;
  return schema.fields.some((f) => !f.isParams);
}
