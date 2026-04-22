
/**
 * Function to recursively map a dto or entity structure's keys.
 * We use this to either camelCase properties when mapping an entity to a DTO,
 * or snake_case properties when mapping a DTO to an entity.
 * @param originalObject
 * @param callback
 * @param mapDate
 */
export const deepMapKeys = (
  originalObject,
  callback,
  mapDate = (timeValue) => timeValue
) => {
  if (typeof originalObject !== 'object') {
    return originalObject;
  }

  return Object.keys(originalObject || {}).reduce((newObject, key) => {
    const newKey = callback(key);
    const originalValue = originalObject[key];
    let newValue = originalValue;
    if (Array.isArray(originalValue)) {
      newValue = originalValue.map((item, _idx) => deepMapKeys(item, callback));
    } else if (
      typeof originalValue === 'object' &&
      originalValue &&
      Object.keys(originalValue).length > 0
    ) {
      newValue = deepMapKeys(originalValue, callback);
    } else if (originalValue && originalValue instanceof Date) {
      newValue = mapDate(originalValue);
    }

    return {
      ...newObject,
      [newKey]: newValue,
    };
  }, {});
};

export const mapToEntity = (dto, entity) => {
  Object.keys(dto).forEach((dtoKey, _idx) => {
    const modelKey = dtoKey;
    entity[modelKey] = dto[dtoKey];
  });

  return entity;
};

export const mapFromEntity = (entity, dto) => {
  Object.keys(entity).forEach((modelKey, _idx) => {
    const dtoKey = (modelKey);
    dto[dtoKey] = entity[modelKey];
  });

  return deepMapKeys(
    dto,
    (key) => key,
    (value: Date) => value.toISOString()
  );
};

// flat multidimensional array down. d = # of level you want to reduce it.
export const flatDeep = (arr, d = 1) => {
  return d > 0 ? arr.reduce((acc, val) => acc.concat(Array.isArray(val) ? flatDeep(val, d - 1) : val), [])
                : arr.slice();
};

// Partial type with nested properties also as Partial.
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};