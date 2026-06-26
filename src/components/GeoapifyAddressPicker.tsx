import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Check, Loader, MapPin, Navigation, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SupportedLanguage } from '../types/language'
import type { PickedAddress } from './MapAddressPicker'

const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY as string | undefined
const INITIAL_ADDRESS_TEXT = '正在获取当前位置...'
const LOCATION_FAILED_MESSAGE = '无法获取当前位置，请允许定位权限或搜索地址。'
const INSECURE_LOCATION_MESSAGE =
  '手机浏览器定位需要 HTTPS 域名，当前局域网 HTTP 地址无法获取当前位置。请用正式 HTTPS 域名打开，或先搜索地址。'
const MANUAL_ADDRESS_TEXT = '请搜索地址或使用 HTTPS 打开后定位'
const SEARCH_EMPTY_MESSAGE = '没有找到相关地址，请换个关键词。'
const SEARCH_FAILED_MESSAGE = '搜索地址失败，请稍后再试或换个关键词。'
const ADDRESS_LOOKUP_DEBOUNCE_MS = 450

type AddressMeta = Omit<PickedAddress, 'address' | 'latitude' | 'longitude'>

type GeoapifyFeature = {
  properties?: {
    address_line1?: string
    address_line2?: string
    city?: string
    country?: string
    county?: string
    district?: string
    formatted?: string
    lat?: number
    lon?: number
    municipality?: string
    name?: string
    state?: string
    street?: string
    suburb?: string
    town?: string
    village?: string
  }
}

type GeoapifyResponse = {
  features?: GeoapifyFeature[]
}

type SearchTip = {
  address: string
  description: string
  location: [number, number]
  meta: AddressMeta
  name: string
}

type AddressCacheEntry = {
  address: string
  meta: AddressMeta
}

type GeoapifyAddressPickerProps = {
  initialAddress?: string
  initialLocation?: {
    latitude?: number
    longitude?: number
  } | null
  language: SupportedLanguage
  onConfirm: (pickedAddress: PickedAddress) => void
  onClose: () => void
}

function canUseBrowserGeolocation() {
  const hostname = window.location.hostname
  return (
    window.isSecureContext ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  )
}

function getAddressCacheKey(lnglat: [number, number]) {
  return `${lnglat[0].toFixed(6)},${lnglat[1].toFixed(6)}`
}

function normalizeGeoapifyLanguage(language: SupportedLanguage) {
  return language === 'zh' || language === 'en' || language === 'ru' || language === 'uz' ? language : 'en'
}

function getFeatureLngLat(feature: GeoapifyFeature): [number, number] | null {
  const lon = Number(feature.properties?.lon)
  const lat = Number(feature.properties?.lat)

  return Number.isFinite(lon) && Number.isFinite(lat) ? [lon, lat] : null
}

function getFeatureMeta(feature: GeoapifyFeature): AddressMeta {
  const properties = feature.properties

  if (!properties) return {}

  return {
    city: properties.city || properties.town || properties.village || properties.municipality || properties.county || properties.state,
    district: properties.district || properties.suburb || properties.county,
    street: properties.street || properties.address_line1,
  }
}

function getFeatureAddress(feature: GeoapifyFeature) {
  const properties = feature.properties

  if (!properties) return ''

  return properties.formatted || [properties.name, properties.address_line1, properties.address_line2].filter(Boolean).join(', ')
}

function getFeatureName(feature: GeoapifyFeature) {
  const properties = feature.properties

  return properties?.name || properties?.address_line1 || properties?.formatted || ''
}

function mapFeaturesToSearchTips(features: GeoapifyFeature[] = []) {
  return features
    .map((feature) => {
      const location = getFeatureLngLat(feature)
      const address = getFeatureAddress(feature)
      const name = getFeatureName(feature)

      return location && address
        ? {
            address,
            description: feature.properties?.address_line2 || feature.properties?.country || '',
            location,
            meta: getFeatureMeta(feature),
            name: name || address,
          }
        : null
    })
    .filter((tip): tip is SearchTip => Boolean(tip))
}

async function fetchGeoapify(path: string, params: Record<string, string>) {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('缺少 VITE_GEOAPIFY_API_KEY，无法加载海外地图。')
  }

  const searchParams = new URLSearchParams({ ...params, apiKey: GEOAPIFY_API_KEY })
  const response = await fetch(`https://api.geoapify.com/v1/${path}?${searchParams.toString()}`)

  if (!response.ok) {
    throw new Error('Geoapify 地址服务暂时不可用，请搜索或手动填写地址。')
  }

  return (await response.json()) as GeoapifyResponse
}

export function GeoapifyAddressPicker({
  initialAddress,
  initialLocation,
  language,
  onConfirm,
  onClose,
}: GeoapifyAddressPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressLookupSeqRef = useRef(0)
  const addressCacheRef = useRef(new Map<string, AddressCacheEntry>())
  const centerRef = useRef<[number, number] | null>(null)
  const addressMetaRef = useRef<AddressMeta>({})

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [address, setAddress] = useState(initialAddress?.trim() || INITIAL_ADDRESS_TEXT)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTips, setSearchTips] = useState<SearchTip[]>([])
  const [searchNotice, setSearchNotice] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)

  const reverseGeocode = useCallback(async (lnglat: [number, number]) => {
    const cacheKey = getAddressCacheKey(lnglat)
    const cached = addressCacheRef.current.get(cacheKey)

    if (cached) {
      addressMetaRef.current = cached.meta
      setAddress(cached.address)
      setIsGeocoding(false)
      return
    }

    const requestSeq = addressLookupSeqRef.current + 1
    addressLookupSeqRef.current = requestSeq
    setIsGeocoding(true)

    try {
      const data = await fetchGeoapify('geocode/reverse', {
        lang: normalizeGeoapifyLanguage(language),
        lat: String(lnglat[1]),
        lon: String(lnglat[0]),
      })
      const feature = data.features?.[0]

      if (requestSeq !== addressLookupSeqRef.current) return

      if (feature) {
        const nextAddress = getFeatureAddress(feature)
        const nextMeta = getFeatureMeta(feature)

        if (nextAddress) {
          addressMetaRef.current = nextMeta
          addressCacheRef.current.set(cacheKey, { address: nextAddress, meta: nextMeta })
          setAddress(nextAddress)
          return
        }
      }

      const fallbackAddress = `${lnglat[1].toFixed(6)}, ${lnglat[0].toFixed(6)}`
      addressMetaRef.current = {}
      addressCacheRef.current.set(cacheKey, { address: fallbackAddress, meta: {} })
      setAddress(fallbackAddress)
    } catch (error) {
      if (requestSeq !== addressLookupSeqRef.current) return

      const fallbackAddress = `${lnglat[1].toFixed(6)}, ${lnglat[0].toFixed(6)}`
      addressMetaRef.current = {}
      setAddress(fallbackAddress)
      setLoadError(error instanceof Error ? error.message : LOCATION_FAILED_MESSAGE)
    } finally {
      if (requestSeq === addressLookupSeqRef.current) {
        setIsGeocoding(false)
      }
    }
  }, [language])

  const scheduleReverseGeocode = useCallback((lnglat: [number, number]) => {
    if (addressLookupTimerRef.current) clearTimeout(addressLookupTimerRef.current)

    addressLookupTimerRef.current = setTimeout(() => {
      void reverseGeocode(lnglat)
    }, ADDRESS_LOOKUP_DEBOUNCE_MS)
  }, [reverseGeocode])

  const ensureMap = useCallback((lnglat: [number, number], zoom = 16) => {
    if (!GEOAPIFY_API_KEY || !mapContainerRef.current) return

    if (!mapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [lnglat[1], lnglat[0]],
        zoom,
        zoomControl: false,
      })

      L.control.zoom({ position: 'bottomleft' }).addTo(map)
      L.tileLayer(`https://maps.geoapify.com/v1/tile/osm-bright/{z}/{x}/{y}.png?apiKey=${GEOAPIFY_API_KEY}`, {
        attribution: '&copy; OpenStreetMap contributors &copy; Geoapify',
        maxZoom: 20,
      }).addTo(map)

      map.on('moveend', () => {
        const center = map.getCenter()
        const nextLngLat: [number, number] = [center.lng, center.lat]
        centerRef.current = nextLngLat
        scheduleReverseGeocode(nextLngLat)
      })

      mapRef.current = map
      window.setTimeout(() => map.invalidateSize(), 0)
      return
    }

    mapRef.current.setView([lnglat[1], lnglat[0]], zoom, { animate: false })
  }, [scheduleReverseGeocode])

  const moveToLocation = useCallback((lnglat: [number, number], zoom = 16) => {
    setLoadError('')
    centerRef.current = lnglat
    ensureMap(lnglat, zoom)
    void reverseGeocode(lnglat)
  }, [ensureMap, reverseGeocode])

  const getSearchParams = useCallback((text: string, limit: string) => {
    const params: Record<string, string> = {
      lang: normalizeGeoapifyLanguage(language),
      limit,
      text,
    }

    if (centerRef.current) {
      params.bias = `proximity:${centerRef.current[0]},${centerRef.current[1]}`
    }

    return params
  }, [language])

  const runSearch = useCallback(async (query: string) => {
    const text = query.trim()
    if (!text) return

    setIsSearching(true)
    setSearchNotice('')
    setLoadError('')

    try {
      const data = await fetchGeoapify('geocode/search', getSearchParams(text, '8'))
      const nextTips = mapFeaturesToSearchTips(data.features)
      const feature = data.features?.[0]
      const location = feature ? getFeatureLngLat(feature) : null
      const address = feature ? getFeatureAddress(feature) : ''

      if (!feature || !location || !address) {
        setSearchTips([])
        setSearchNotice(SEARCH_EMPTY_MESSAGE)
        return
      }

      const meta = getFeatureMeta(feature)
      addressCacheRef.current.set(getAddressCacheKey(location), { address, meta })
      addressMetaRef.current = meta
      setAddress(address)
      setSearchTips(nextTips)
      moveToLocation(location)
    } catch {
      setSearchTips([])
      setSearchNotice(SEARCH_FAILED_MESSAGE)
    } finally {
      setIsSearching(false)
    }
  }, [getSearchParams, moveToLocation])

  const locateCustomer = useCallback(() => {
    setLoadError('')
    setIsLocating(true)

    if (!canUseBrowserGeolocation()) {
      setLoadError(INSECURE_LOCATION_MESSAGE)
      setAddress(MANUAL_ADDRESS_TEXT)
      setIsLoading(false)
      setIsLocating(false)
      return
    }

    if (!navigator.geolocation) {
      setLoadError(LOCATION_FAILED_MESSAGE)
      setAddress(MANUAL_ADDRESS_TEXT)
      setIsLoading(false)
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        moveToLocation([position.coords.longitude, position.coords.latitude])
        setIsLoading(false)
        setIsLocating(false)
      },
      () => {
        setLoadError(LOCATION_FAILED_MESSAGE)
        setAddress(MANUAL_ADDRESS_TEXT)
        setIsLoading(false)
        setIsLocating(false)
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 8000 },
    )
  }, [moveToLocation])

  useEffect(() => {
    let destroyed = false

    async function initialize() {
      if (!GEOAPIFY_API_KEY) {
        setLoadError('缺少 VITE_GEOAPIFY_API_KEY，无法加载海外地图。')
        setAddress(MANUAL_ADDRESS_TEXT)
        setIsLoading(false)
        return
      }

      if (initialLocation?.latitude != null && initialLocation.longitude != null) {
        moveToLocation([initialLocation.longitude, initialLocation.latitude])
        setIsLoading(false)
        return
      }

      const normalizedInitialAddress = initialAddress?.trim()

      if (normalizedInitialAddress) {
        try {
          const data = await fetchGeoapify('geocode/search', {
            lang: normalizeGeoapifyLanguage(language),
            limit: '1',
            text: normalizedInitialAddress,
          })

          if (destroyed) return

          const feature = data.features?.[0]
          const lnglat = feature ? getFeatureLngLat(feature) : null

          if (feature && lnglat) {
            addressCacheRef.current.set(getAddressCacheKey(lnglat), {
              address: getFeatureAddress(feature) || normalizedInitialAddress,
              meta: getFeatureMeta(feature),
            })
            moveToLocation(lnglat)
            setIsLoading(false)
            return
          }
        } catch {
          if (destroyed) return
        }
      }

      if (!destroyed) {
        locateCustomer()
      }
    }

    void initialize()

    return () => {
      destroyed = true
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (addressLookupTimerRef.current) clearTimeout(addressLookupTimerRef.current)
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [initialAddress, initialLocation?.latitude, initialLocation?.longitude, language, locateCustomer, moveToLocation])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (!searchQuery.trim()) {
      setSearchTips([])
      setSearchNotice('')
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      setIsSearching(true)

      fetchGeoapify('geocode/autocomplete', getSearchParams(searchQuery.trim(), '8'))
        .then(async (data) => {
          const autocompleteTips = mapFeaturesToSearchTips(data.features)
          const nextTips =
            autocompleteTips.length > 0
              ? autocompleteTips
              : mapFeaturesToSearchTips((await fetchGeoapify('geocode/search', getSearchParams(searchQuery.trim(), '8'))).features)

          setSearchTips(nextTips)
          setSearchNotice(nextTips.length > 0 ? '' : SEARCH_EMPTY_MESSAGE)
        })
        .catch(() => {
          setSearchTips([])
          setSearchNotice(SEARCH_FAILED_MESSAGE)
        })
        .finally(() => setIsSearching(false))
    }, 350)
  }, [getSearchParams, searchQuery])

  function handleSelectTip(tip: SearchTip) {
    setSearchTips([])

    addressCacheRef.current.set(getAddressCacheKey(tip.location), { address: tip.address, meta: tip.meta })
    setAddress(tip.address)
    moveToLocation(tip.location)
  }

  function handleConfirm() {
    if (!centerRef.current) {
      setLoadError('请先定位、搜索或拖动地图选择地址。')
      return
    }

    const [longitude, latitude] = centerRef.current
    onConfirm({
      ...addressMetaRef.current,
      address,
      latitude,
      longitude,
    })
  }

  return (
    <div className="map-picker-overlay" role="dialog" aria-label="选择收货地址" aria-modal="true">
      <div className="map-picker-shell">
        <div className="map-picker-header">
          <button className="map-picker-close-btn" onClick={onClose} type="button" aria-label="关闭">
            <X size={20} />
          </button>
          <strong>选择收货地址</strong>
        </div>

        <div className="map-picker-search-box">
          <Search size={16} className="map-picker-search-icon" />
          <input
            autoComplete="off"
            className="map-picker-search-input"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                void runSearch(searchQuery)
              }
            }}
            placeholder="搜索小区、写字楼、地址"
            type="search"
            value={searchQuery}
          />
          {isSearching ? <Loader size={14} className="map-picker-search-spinner spinning" /> : null}
        </div>

        {searchTips.length > 0 ? (
          <ul className="map-picker-tips">
            {searchTips.map((tip) => (
              <li key={`${tip.name}-${tip.address}`}>
                <button className="map-picker-tip-item" onClick={() => handleSelectTip(tip)} type="button">
                  <MapPin size={15} className="map-picker-tip-icon" />
                  <span>
                    <strong>{tip.name}</strong>
                    <em>{[tip.description, tip.address].filter(Boolean).join(' ')}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {searchNotice && searchQuery.trim() ? <div className="map-picker-search-notice">{searchNotice}</div> : null}

        <div className="map-picker-map-area">
          <div ref={mapContainerRef} className="map-picker-map" />
          {centerRef.current ? (
            <div className="map-picker-center-pin" aria-hidden="true">
              <MapPin size={38} />
              <span />
            </div>
          ) : null}
          <button
            className="map-picker-locate-btn"
            disabled={isLocating}
            onClick={locateCustomer}
            title="定位到当前位置"
            type="button"
          >
            {isLocating ? <Loader size={18} className="spinning" /> : <Navigation size={18} />}
          </button>

          {isLoading ? (
            <div className="map-picker-loading">
              <Loader size={24} className="spinning" />
              <span>正在获取当前位置...</span>
            </div>
          ) : null}
          {loadError ? <div className="map-picker-error">{loadError}</div> : null}
        </div>

        <div className="map-picker-footer">
          <div className="map-picker-address-row">
            <MapPin size={16} />
            <p>{isGeocoding ? '正在解析地址...' : address}</p>
          </div>
          <button className="map-picker-confirm-btn" disabled={isGeocoding || isLoading} onClick={handleConfirm} type="button">
            <Check size={18} />
            确认地址
          </button>
        </div>
      </div>
    </div>
  )
}
