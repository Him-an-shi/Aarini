import React, { createContext, useState, useEffect, useContext, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import en from './translations/en'
import hi from './translations/hi'

const LANGUAGE_KEY = 'app_language'

const translations = { en, hi }
const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
]

const LanguageContext = createContext()

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => (current ? current[key] : undefined), obj)
}

function interpolate(template, params) {
  if (!params || typeof template !== 'string') return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`
  })
}

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState('en')
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(LANGUAGE_KEY)
      .then((stored) => {
        if (stored && translations[stored]) {
          setLanguageState(stored)
        }
        setIsReady(true)
      })
      .catch(() => setIsReady(true))
  }, [])

  const setLanguage = useCallback(async (code) => {
    if (!translations[code]) return
    setLanguageState(code)
    await AsyncStorage.setItem(LANGUAGE_KEY, code)
  }, [])

  const t = useCallback(
    (key, params) => {
      const value = getNestedValue(translations[language], key)
      if (value === undefined) {
        const fallback = getNestedValue(translations.en, key)
        if (fallback === undefined) return key
        return interpolate(fallback, params)
      }
      return interpolate(value, params)
    },
    [language],
  )

  return (
    <LanguageContext.Provider
      value={{ language, setLanguage, t, isReady, supportedLanguages: SUPPORTED_LANGUAGES }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider.')
  }
  return context
}
