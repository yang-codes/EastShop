import type { SupportedLanguage } from '../types/language'
import type { LocationSnapshot } from '../types/order'

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
   * 业务用途：把定位结果写入订单，后续接入 Geoapify 后补充国家、城市、街道等地址信息。
   * 当前是本地占位实现，只返回经纬度和精度。
   */
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
