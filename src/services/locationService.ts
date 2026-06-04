import type { SupportedLanguage } from '../types/language'
import type { LocationSnapshot } from '../types/order'

type GeoapifyFeature = {
  properties?: {
    city?: string
    country?: string
    county?: string
    district?: string
    formatted?: string
    municipality?: string
    state?: string
    street?: string
    suburb?: string
    town?: string
    village?: string
  }
}

type GeoapifyReverseResponse = {
  features?: GeoapifyFeature[]
}

function getFallbackSnapshot(position: GeolocationPosition): LocationSnapshot {
  return {
    accuracy: position.coords.accuracy,
    formattedAddress: `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }
}

export const locationService = {
  /**
   * 请求浏览器当前位置，并启用高精度定位。
   * 业务用途：下单时辅助客户填写地址，并给后台提供经纬度用于配送判断。
   * 浏览器不支持定位时会抛出 GEOLOCATION_UNSUPPORTED。
   */
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

  /**
   * 将浏览器经纬度转换为订单可保存的位置快照。
   * 业务用途：把定位结果写入订单，并通过 Geoapify Reverse Geocoding 补充国家、城市、街道等地址信息。
   * 未配置 VITE_GEOAPIFY_API_KEY 或反查失败时降级返回经纬度和精度。
   */
  async reverseGeocode(position: GeolocationPosition, language: SupportedLanguage): Promise<LocationSnapshot> {
    const fallback = getFallbackSnapshot(position)
    const apiKey = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined

    if (!apiKey) {
      return fallback
    }

    const params = new URLSearchParams({
      apiKey,
      lang: language,
      lat: String(position.coords.latitude),
      lon: String(position.coords.longitude),
    })

    try {
      const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params.toString()}`)

      if (!response.ok) {
        return fallback
      }

      const data = (await response.json()) as GeoapifyReverseResponse
      const properties = data.features?.[0]?.properties

      if (!properties) {
        return fallback
      }

      const city = properties.city || properties.town || properties.village || properties.municipality || properties.county || properties.state
      const district = properties.district || properties.suburb || properties.county

      return {
        ...fallback,
        city,
        country: properties.country,
        district,
        formattedAddress: properties.formatted || fallback.formattedAddress,
        street: properties.street,
      }
    } catch {
      return fallback
    }
  },
}
