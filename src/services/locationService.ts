import type { SupportedLanguage } from '../types/language'
import type { LocationSnapshot } from '../types/order'
import { getSupabaseConfig, isSupabaseConfigured } from '../lib/supabaseClient'

type ReverseGeocodeResponse = {
  error?: string
  location?: LocationSnapshot
  message?: string
}

type TelegramLocationData = {
  accuracy?: number
  altitude?: number
  altitude_accuracy?: number
  course?: number
  horizontal_accuracy?: number
  latitude: number
  longitude: number
  speed?: number
}

type TelegramLocationManager = {
  getLocation?: (callback: (location: TelegramLocationData | null) => void) => void
  init?: (callback?: () => void) => void
  isInited?: boolean
  isLocationAvailable?: boolean
}

const LOCATION_TIMEOUT_MS = 10_000

function buildPositionFromTelegram(location: TelegramLocationData): GeolocationPosition {
  const coords: GeolocationCoordinates = {
    accuracy: location.horizontal_accuracy ?? location.accuracy ?? 0,
    altitude: location.altitude ?? null,
    altitudeAccuracy: location.altitude_accuracy ?? null,
    heading: location.course ?? null,
    latitude: location.latitude,
    longitude: location.longitude,
    speed: location.speed ?? null,
    toJSON() {
      return {
        accuracy: coords.accuracy,
        altitude: coords.altitude,
        altitudeAccuracy: coords.altitudeAccuracy,
        heading: coords.heading,
        latitude: coords.latitude,
        longitude: coords.longitude,
        speed: coords.speed,
      }
    },
  }

  return {
    coords,
    timestamp: Date.now(),
    toJSON() {
      return {
        coords: coords.toJSON(),
        timestamp: this.timestamp,
      }
    },
  }
}

function getFallbackSnapshot(position: GeolocationPosition): LocationSnapshot {
  return {
    accuracy: position.coords.accuracy,
    formattedAddress: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }
}

function getNavigatorPosition(): Promise<GeolocationPosition> {
  if (!('geolocation' in navigator)) {
    return Promise.reject(new Error('GEOLOCATION_UNSUPPORTED'))
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 60_000,
      timeout: LOCATION_TIMEOUT_MS,
    })
  })
}

function initTelegramLocationManager(locationManager: TelegramLocationManager): Promise<void> {
  if (!locationManager || locationManager.isInited || typeof locationManager.init !== 'function') {
    return Promise.resolve()
  }

  const init = locationManager.init

  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(resolve, 2_000)

    try {
      init(() => {
        window.clearTimeout(timeoutId)
        resolve()
      })
    } catch {
      window.clearTimeout(timeoutId)
      resolve()
    }
  })
}

async function getTelegramPosition(): Promise<GeolocationPosition> {
  const locationManager = window.Telegram?.WebApp?.LocationManager

  if (!locationManager || typeof locationManager.getLocation !== 'function') {
    throw new Error('TELEGRAM_LOCATION_UNSUPPORTED')
  }

  await initTelegramLocationManager(locationManager)

  if (locationManager.isLocationAvailable === false) {
    throw new Error('TELEGRAM_LOCATION_UNAVAILABLE')
  }

  const getLocation = locationManager.getLocation

  return new Promise((resolve, reject) => {
    let settled = false
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return
      }

      settled = true
      reject(new Error('TELEGRAM_LOCATION_TIMEOUT'))
    }, LOCATION_TIMEOUT_MS)

    try {
      getLocation((location) => {
        if (settled) {
          return
        }

        settled = true
        window.clearTimeout(timeoutId)

        if (!location) {
          reject(new Error('TELEGRAM_LOCATION_DENIED'))
          return
        }

        resolve(buildPositionFromTelegram(location))
      })
    } catch (error) {
      if (settled) {
        return
      }

      settled = true
      window.clearTimeout(timeoutId)
      reject(error)
    }
  })
}

export const locationService = {
  /**
   * 请求当前位置：Telegram Mini App 环境优先调用 Telegram LocationManager，失败后回退到浏览器定位。
   * 业务用途：下单时辅助客户填写地址，并给后台提供经纬度用于配送判断。
   * 定位不可用时会抛出 GEOLOCATION_UNSUPPORTED 或浏览器/客户端返回的定位错误。
   */
  async getBrowserPosition(): Promise<GeolocationPosition> {
    try {
      return await getTelegramPosition()
    } catch {
      return getNavigatorPosition()
    }
  },

  /**
   * 将浏览器经纬度转换为订单可保存的位置快照。
   * 业务用途：把定位结果写入订单，并通过 Geoapify Reverse Geocoding 补充国家、城市、街道等地址信息。
   * Geoapify API key 保存在 Supabase Edge Function Secret 中；反查失败时降级返回经纬度和精度。
   */
  async reverseGeocode(position: GeolocationPosition, language: SupportedLanguage): Promise<LocationSnapshot> {
    const fallback = getFallbackSnapshot(position)

    if (!isSupabaseConfigured()) {
      return fallback
    }

    try {
      const { anonKey, url } = getSupabaseConfig()
      const response = await fetch(`${url}/functions/v1/reverse-geocode`, {
        body: JSON.stringify({
          accuracy: position.coords.accuracy,
          language,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }),
        headers: {
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      })

      if (!response.ok) {
        return fallback
      }

      const data = (await response.json()) as ReverseGeocodeResponse

      return data.location ?? fallback
    } catch {
      return fallback
    }
  },
}
