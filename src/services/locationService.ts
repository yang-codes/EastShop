import type { SupportedLanguage } from '../types/language'
import type { LocationSnapshot } from '../types/order'

export const locationService = {
  getBrowserPosition(): Promise<GeolocationPosition> {
    if (!('geolocation' in navigator)) {
      return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'))
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 60_000,
        timeout: 10_000,
      })
    })
  },

  async reverseGeocode(position: GeolocationPosition, language: SupportedLanguage): Promise<LocationSnapshot> {
    void language

    return {
      accuracy: position.coords.accuracy,
      formattedAddress: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    }
  },
}
