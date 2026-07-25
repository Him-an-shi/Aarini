import { useState, useCallback } from 'react';

export function useFormValidation(validations = {}) {
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const validateField = useCallback((field, value) => {
    const validator = validations[field];
    if (!validator) return null;
    const error = validator(value);
    setErrors((prev) => ({ ...prev, [field]: error }));
    return error;
  }, [validations]);

  const validateAll = useCallback((values) => {
    const newErrors = {};
    let isValid = true;
    for (const [field, validator] of Object.entries(validations)) {
      const error = validator(values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }
    setErrors(newErrors);
    setTouched(Object.keys(validations).reduce((acc, f) => ({ ...acc, [f]: true }), {}));
    return isValid;
  }, [validations]);

  const handleChange = useCallback((field, value) => {
    if (touched[field]) {
      validateField(field, value);
    }
  }, [touched, validateField]);

  const handleBlur = useCallback((field, value) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field, value);
  }, [validateField]);

  const clearErrors = useCallback(() => {
    setErrors({});
    setTouched({});
  }, []);

  const clearFieldError = useCallback((field) => {
    setErrors((prev) => ({ ...prev, [field]: null }));
  }, []);

  return {
    errors,
    touched,
    validateField,
    validateAll,
    handleChange,
    handleBlur,
    clearErrors,
    clearFieldError,
    hasErrors: Object.values(errors).some(Boolean),
  };
}
