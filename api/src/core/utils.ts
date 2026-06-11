/**
 * Function to recursively map a dto or entity structure's keys.
 * We use this to either camelCase properties when mapping an entity to a DTO,
 * or snake_case properties when mapping a DTO to an entity.
 * @param originalObject
 * @param callback
 * @param mapDate
 */
export const deepMapKeys = (
  originalObject: any,
  callback: (key: string) => string,
  mapDate: (value: Date) => any = (timeValue: any) => timeValue
): any => {
  if (typeof originalObject !== 'object' || originalObject === null) {
    return originalObject;
  }

  return Object.keys(originalObject).reduce((newObject: any, key: string) => {
    const newKey = callback(key);
    const originalValue = originalObject[key];
    let newValue = originalValue;
    if (Array.isArray(originalValue)) {
      newValue = originalValue.map((item) => deepMapKeys(item, callback));
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

export const mapToEntity = (dto: any, entity: any): any => {
  Object.keys(dto).forEach((dtoKey) => {
    const modelKey = dtoKey;
    entity[modelKey] = dto[dtoKey];
  });

  return entity;
};

export const mapFromEntity = (entity: any, dto: any): any => {
  Object.keys(entity).forEach((modelKey) => {
    const dtoKey = (modelKey);
    dto[dtoKey] = entity[modelKey];
  });

  return deepMapKeys(
    dto,
    (key: string) => key,
    (value: Date) => value.toISOString()
  );
};

// flat multidimensional array down. d = # of level you want to reduce it.
export const flatDeep = (arr: any[], d = 1): any[] => {
  return d > 0 ? arr.reduce((acc: any[], val: any) => acc.concat(Array.isArray(val) ? flatDeep(val, d - 1) : val), [])
                : arr.slice();
};

// Partial type with nested properties also as Partial.
export type RecursivePartial<T> = {
    [P in keyof T]?: RecursivePartial<T[P]>;
};