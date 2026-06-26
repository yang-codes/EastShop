const AMAP_KEY = import.meta.env.VITE_AMAP_KEY as string | undefined
const AMAP_SECURITY_CODE = import.meta.env.VITE_AMAP_SECURITY_CODE as string | undefined

let loadPromise: Promise<void> | null = null

export function loadAMap(): Promise<void> {
  if (window.AMap) return Promise.resolve()
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    if (!AMAP_KEY) {
      reject(new Error('缺少 VITE_AMAP_KEY，无法加载高德地图。'))
      return
    }

    if (AMAP_SECURITY_CODE) {
      window._AMapSecurityConfig = { securityJsCode: AMAP_SECURITY_CODE }
    }

    const plugins = ['AMap.Geocoder', 'AMap.AutoComplete', 'AMap.Geolocation'].join(',')
    const script = document.createElement('script')
    script.async = true
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=${plugins}`

    script.onload = () => resolve()
    script.onerror = () => {
      loadPromise = null
      reject(new Error('高德地图 SDK 加载失败，请检查网络或 API Key。'))
    }

    document.head.appendChild(script)
  })

  return loadPromise
}
