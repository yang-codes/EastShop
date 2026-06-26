import { Check, Loader, MapPin, Navigation, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { loadAMap } from '../services/amapLoader'

const INITIAL_ADDRESS_TEXT = '正在获取当前位置...'
const LOCATION_FAILED_MESSAGE = '无法获取当前位置，请允许定位权限或搜索地址。'
const INSECURE_LOCATION_MESSAGE =
  '手机浏览器定位需要 HTTPS 域名，当前局域网 HTTP 地址无法获取当前位置。请用正式 HTTPS 域名打开，或先搜索地址。'
const MANUAL_ADDRESS_TEXT = '请搜索地址或使用 HTTPS 打开后定位'
const ADDRESS_LOOKUP_DEBOUNCE_MS = 450
const AMAP_REGEOCODE_RADIUS = 120

export type PickedAddress = {
  address: string
  latitude: number
  longitude: number
  city?: string
  district?: string
  street?: string
}

interface SearchTip {
  name: string
  district: string
  address: string
  location: AMap.LngLat | null
}

type AddressCacheEntry = {
  address: string
  meta: Omit<PickedAddress, 'address' | 'latitude' | 'longitude'>
}

type NearbyAddressOption = {
  address: string
  description: string
  distance?: number
  key: string
  meta: Omit<PickedAddress, 'address' | 'latitude' | 'longitude'>
  name: string
}

interface MapAddressPickerProps {
  initialAddress?: string
  initialLocation?: {
    latitude?: number
    longitude?: number
  } | null
  onConfirm: (pickedAddress: PickedAddress) => void
  onClose: () => void
}

function lngLatToTuple(lnglat: AMap.LngLat): [number, number] {
  return [lnglat.getLng(), lnglat.getLat()]
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

function compactAddressParts(parts: Array<string | undefined>) {
  return parts
    .map((part) => part?.trim())
    .filter((part, index, list): part is string => Boolean(part) && list.indexOf(part) === index)
}

function getNearestPoi(result: AMap.GeocodeResult) {
  return result.regeocode.pois?.find((poi) => {
    const distance = Number(poi.distance)
    return poi.name && (!Number.isFinite(distance) || distance <= AMAP_REGEOCODE_RADIUS)
  })
}

function formatAmapAddress(result: AMap.GeocodeResult) {
  const component = result.regeocode.addressComponent
  const poi = getNearestPoi(result)
  const meta = {
    city: component.city || component.province,
    district: component.district,
    street: [component.street, component.streetNumber].filter(Boolean).join(''),
  }

  if (poi?.name) {
    return {
      address: compactAddressParts([
        component.province,
        component.city,
        component.district,
        poi.address,
        poi.name,
      ]).join(''),
      meta: {
        ...meta,
        street: poi.address || meta.street,
      },
    }
  }

  return {
    address: result.regeocode.formattedAddress,
    meta,
  }
}

function getNearbyAddressOptions(result: AMap.GeocodeResult) {
  const component = result.regeocode.addressComponent
  const baseMeta = {
    city: component.city || component.province,
    district: component.district,
    street: [component.street, component.streetNumber].filter(Boolean).join(''),
  }
  const options = (result.regeocode.pois ?? [])
    .filter((poi) => poi.name)
    .slice(0, 6)
    .map((poi, index) => {
      const distance = Number(poi.distance)
      const address = compactAddressParts([
        component.province,
        component.city,
        component.district,
        poi.address,
        poi.name,
      ]).join('')

      return {
        address,
        description: [
          Number.isFinite(distance) ? `距您${Math.round(distance)}m` : '',
          poi.address,
        ].filter(Boolean).join(' | '),
        distance: Number.isFinite(distance) ? distance : undefined,
        key: `${poi.name}-${poi.address ?? ''}-${index}`,
        meta: {
          ...baseMeta,
          street: poi.address || baseMeta.street,
        },
        name: poi.name ?? address,
      }
    })

  if (options.length > 0) {
    return options
  }

  return [
    {
      address: result.regeocode.formattedAddress,
      description: compactAddressParts([component.province, component.city, component.district]).join(''),
      key: result.regeocode.formattedAddress,
      meta: baseMeta,
      name: result.regeocode.formattedAddress,
    },
  ]
}

export function MapAddressPicker({ initialAddress, initialLocation, onConfirm, onClose }: MapAddressPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<AMap.Map | null>(null)
  const geocoderRef = useRef<AMap.Geocoder | null>(null)
  const autocompleteRef = useRef<AMap.AutoComplete | null>(null)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressLookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const addressLookupSeqRef = useRef(0)
  const addressCacheRef = useRef(new Map<string, AddressCacheEntry>())
  const centerRef = useRef<[number, number] | null>(null)
  const addressMetaRef = useRef<Omit<PickedAddress, 'address' | 'latitude' | 'longitude'>>({})

  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [address, setAddress] = useState(initialAddress?.trim() || INITIAL_ADDRESS_TEXT)
  const [isGeocoding, setIsGeocoding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchTips, setSearchTips] = useState<SearchTip[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [isLocating, setIsLocating] = useState(false)
  const [nearbyAddresses, setNearbyAddresses] = useState<NearbyAddressOption[]>([])

  const ensureMap = useCallback((lnglat: [number, number], zoom = 17) => {
    if (!window.AMap || !mapContainerRef.current) return

    if (!mapRef.current) {
      mapRef.current = new window.AMap.Map(mapContainerRef.current, {
        center: lnglat,
        resizeEnable: true,
        zoom,
      })

      mapRef.current.on('moveend', () => {
        const center = mapRef.current?.getCenter()
        if (!center) return

        const nextLngLat = lngLatToTuple(center)
        centerRef.current = nextLngLat
        scheduleReverseGeocode(nextLngLat)
      })
      return
    }

    mapRef.current.setZoom(zoom)
    mapRef.current.panTo(lnglat)
  }, [])

  const reverseGeocode = useCallback((lnglat: [number, number]) => {
    if (!geocoderRef.current) return

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
    geocoderRef.current.getAddress(lnglat, (status, result) => {
      if (requestSeq !== addressLookupSeqRef.current) return

      setIsGeocoding(false)

      if (status === 'complete' && typeof result !== 'string') {
        const { address: nextAddress, meta: nextMeta } = formatAmapAddress(result)
        const nextOptions = getNearbyAddressOptions(result)

        addressMetaRef.current = nextMeta
        addressCacheRef.current.set(cacheKey, { address: nextAddress, meta: nextMeta })
        setNearbyAddresses(nextOptions)
        setAddress(nextAddress)
        return
      }

      const fallbackAddress = `${lnglat[1].toFixed(6)}, ${lnglat[0].toFixed(6)}`
      addressMetaRef.current = {}
      addressCacheRef.current.set(cacheKey, { address: fallbackAddress, meta: {} })
      setNearbyAddresses([])
      setAddress(fallbackAddress)
    })
  }, [])

  const scheduleReverseGeocode = useCallback((lnglat: [number, number]) => {
    if (addressLookupTimerRef.current) clearTimeout(addressLookupTimerRef.current)

    addressLookupTimerRef.current = setTimeout(() => {
      reverseGeocode(lnglat)
    }, ADDRESS_LOOKUP_DEBOUNCE_MS)
  }, [reverseGeocode])

  const moveToLocation = useCallback((lnglat: [number, number], zoom = 17) => {
    setLoadError('')
    centerRef.current = lnglat
    ensureMap(lnglat, zoom)
    reverseGeocode(lnglat)
  }, [ensureMap, reverseGeocode])

  const locateWithBrowserFallback = useCallback(() => {
    if (!canUseBrowserGeolocation()) {
      setLoadError(INSECURE_LOCATION_MESSAGE)
      setAddress(MANUAL_ADDRESS_TEXT)
      setIsLoading(false)
      setIsLocating(false)
      return
    }

    if (!navigator.geolocation || !window.AMap) {
      setLoadError(LOCATION_FAILED_MESSAGE)
      setAddress(MANUAL_ADDRESS_TEXT)
      setIsLoading(false)
      setIsLocating(false)
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const gpsLngLat: [number, number] = [position.coords.longitude, position.coords.latitude]

        window.AMap?.convertFrom(gpsLngLat, 'gps', (status, result) => {
          const convertedLngLat =
            status === 'complete' && typeof result !== 'string' && result.locations[0]
              ? lngLatToTuple(result.locations[0])
              : gpsLngLat

          moveToLocation(convertedLngLat)
          setIsLoading(false)
          setIsLocating(false)
        })
      },
      () => {
        setLoadError(LOCATION_FAILED_MESSAGE)
        setAddress(MANUAL_ADDRESS_TEXT)
        setIsLoading(false)
        setIsLocating(false)
      },
      { enableHighAccuracy: true, timeout: 8000 },
    )
  }, [moveToLocation])

  const locateCustomer = useCallback(() => {
    if (!window.AMap) return

    setLoadError('')
    setIsLocating(true)

    if (!canUseBrowserGeolocation()) {
      setLoadError(INSECURE_LOCATION_MESSAGE)
      setAddress(MANUAL_ADDRESS_TEXT)
      setIsLoading(false)
      setIsLocating(false)
      return
    }

    const geolocation = new window.AMap.Geolocation({
      convert: true,
      enableHighAccuracy: true,
      timeout: 10000,
      zoomToAccuracy: true,
    })

    geolocation.getCurrentPosition((status, result) => {
      if (status === 'complete' && typeof result !== 'string' && result.position) {
        moveToLocation(lngLatToTuple(result.position))
        setIsLoading(false)
        setIsLocating(false)
        return
      }

      locateWithBrowserFallback()
    })
  }, [locateWithBrowserFallback, moveToLocation])

  useEffect(() => {
    let destroyed = false

    loadAMap()
      .then(() => {
        if (destroyed || !window.AMap) return

        geocoderRef.current = new window.AMap.Geocoder({ extensions: 'all', radius: AMAP_REGEOCODE_RADIUS })
        autocompleteRef.current = new window.AMap.AutoComplete({ citylimit: false })

        if (initialLocation?.latitude != null && initialLocation.longitude != null) {
          moveToLocation([initialLocation.longitude, initialLocation.latitude])
          setIsLoading(false)
          return
        }

        const normalizedInitialAddress = initialAddress?.trim()

        if (normalizedInitialAddress) {
          geocoderRef.current.getLocation(normalizedInitialAddress, (status, result) => {
            if (destroyed) return

            if (status === 'complete' && typeof result !== 'string' && result.geocodes[0]?.location) {
              moveToLocation(lngLatToTuple(result.geocodes[0].location))
              setIsLoading(false)
              return
            }

            locateCustomer()
          })
          return
        }

        locateCustomer()
      })
      .catch((error: Error) => {
        if (!destroyed) {
          setLoadError(error.message)
          setIsLoading(false)
        }
      })

    return () => {
      destroyed = true
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      if (addressLookupTimerRef.current) clearTimeout(addressLookupTimerRef.current)
      mapRef.current?.destroy()
      mapRef.current = null
    }
  }, [initialAddress, initialLocation?.latitude, initialLocation?.longitude, locateCustomer, moveToLocation])

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)

    if (!searchQuery.trim()) {
      setSearchTips([])
      return
    }

    debounceTimerRef.current = setTimeout(() => {
      if (!autocompleteRef.current) return

      setIsSearching(true)
      autocompleteRef.current.search(searchQuery.trim(), (status, result) => {
        setIsSearching(false)

        if (status === 'complete' && typeof result !== 'string') {
          setSearchTips(
            result.tips
              .filter((tip) => tip.location)
              .slice(0, 8)
              .map((tip) => ({
                address: typeof tip.address === 'string' ? tip.address : '',
                district: tip.district,
                location: tip.location ?? null,
                name: tip.name,
              })),
          )
          return
        }

        setSearchTips([])
      })
    }, 350)
  }, [searchQuery])

  function handleSelectTip(tip: SearchTip) {
    setSearchQuery('')
    setSearchTips([])

    if (!tip.location) return

    const tipLngLat = lngLatToTuple(tip.location)
    const tipAddress = [tip.name, tip.address].filter(Boolean).join('，')
    const tipMeta = {
      district: tip.district,
      street: tip.address,
    }

    addressCacheRef.current.set(getAddressCacheKey(tipLngLat), { address: tipAddress, meta: tipMeta })
    setNearbyAddresses([])
    setAddress(tipAddress)
    moveToLocation(tipLngLat)
  }

  function handleSelectNearbyAddress(option: NearbyAddressOption) {
    addressMetaRef.current = option.meta
    setAddress(option.address)
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
            placeholder="搜索小区、写字楼、地址"
            type="search"
            value={searchQuery}
          />
          {isSearching ? <Loader size={14} className="map-picker-search-spinner spinning" /> : null}
        </div>

        {searchTips.length > 0 ? (
          <ul className="map-picker-tips">
            {searchTips.map((tip) => (
              <li key={`${tip.name}-${tip.district}-${tip.address}`}>
                <button className="map-picker-tip-item" onClick={() => handleSelectTip(tip)} type="button">
                  <MapPin size={15} className="map-picker-tip-icon" />
                  <span>
                    <strong>{tip.name}</strong>
                    <em>{[tip.district, tip.address].filter(Boolean).join(' ')}</em>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

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
          {nearbyAddresses.length > 0 ? (
            <div className="map-picker-nearby-list" aria-label="附近地址">
              {nearbyAddresses.map((option) => (
                <button
                  className={`map-picker-nearby-item${option.address === address ? ' selected' : ''}`}
                  key={option.key}
                  onClick={() => handleSelectNearbyAddress(option)}
                  type="button"
                >
                  <MapPin size={15} />
                  <span>
                    <strong>{option.name}</strong>
                    <em>{option.description}</em>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          <button className="map-picker-confirm-btn" disabled={isGeocoding || isLoading} onClick={handleConfirm} type="button">
            <Check size={18} />
            确认地址
          </button>
        </div>
      </div>
    </div>
  )
}
