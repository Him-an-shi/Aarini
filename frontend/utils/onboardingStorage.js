import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_KEY = 'onboarding_complete'
const ONBOARDING_DATA_KEY = 'onboarding_data'

export async function isOnboardingComplete() {
  const value = await AsyncStorage.getItem(ONBOARDING_KEY)
  return value === 'true'
}

export async function markOnboardingComplete() {
  await AsyncStorage.setItem(ONBOARDING_KEY, 'true')
}

export async function saveOnboardingData(data) {
  await AsyncStorage.setItem(ONBOARDING_DATA_KEY, JSON.stringify(data))
}

export async function getOnboardingData() {
  const raw = await AsyncStorage.getItem(ONBOARDING_DATA_KEY)
  return raw ? JSON.parse(raw) : null
}

export async function resetOnboarding() {
  await AsyncStorage.multiRemove([ONBOARDING_KEY, ONBOARDING_DATA_KEY])
}
