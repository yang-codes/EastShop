/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace AMap {
  interface LngLat {
    getLng(): number
    getLat(): number
  }

  interface Pixel {
    x: number
    y: number
  }

  interface MapOptions {
    center?: [number, number]
    zoom?: number
    zooms?: [number, number]
    resizeEnable?: boolean
  }

  class Map {
    constructor(container: HTMLElement | string, options?: MapOptions)
    getCenter(): LngLat
    setCenter(center: [number, number]): void
    setZoom(zoom: number): void
    on(event: string, handler: (...args: any[]) => void): void
    off(event: string, handler: (...args: any[]) => void): void
    destroy(): void
    panTo(lnglat: [number, number]): void
  }

  interface MarkerOptions {
    position: [number, number]
    draggable?: boolean
    map?: Map
    animation?: string
    anchor?: string
  }

  class Marker {
    constructor(options?: MarkerOptions)
    setMap(map: Map | null): void
    getPosition(): LngLat
    setPosition(position: [number, number]): void
    on(event: string, handler: (...args: any[]) => void): void
  }

  interface GeocodeResult {
    status: string
    regeocode: {
      formattedAddress: string
      addressComponent: {
        province: string
        city: string
        district: string
        street: string
        streetNumber: string
      }
      pois?: Array<{
        address?: string
        distance?: number | string
        location?: LngLat
        name?: string
      }>
    }
  }

  interface GeocoderOptions {
    extensions?: 'base' | 'all'
    radius?: number
    lang?: string
  }

  class Geocoder {
    constructor(options?: GeocoderOptions)
    getAddress(lnglat: [number, number], callback: (status: string, result: GeocodeResult | string) => void): void
    getLocation(address: string, callback: (status: string, result: GeocodeLocationResult | string) => void): void
  }

  interface GeocodeLocationResult {
    geocodes: Array<{
      formattedAddress: string
      location: LngLat
    }>
  }

  interface PlaceSearchOptions {
    city?: string
    pageSize?: number
    pageIndex?: number
    map?: Map
  }

  interface SearchResult {
    poiList?: {
      pois: Array<{
        name: string
        location: LngLat
        address: string
        cityname: string
        adname: string
      }>
    }
  }

  class PlaceSearch {
    constructor(options?: PlaceSearchOptions)
    search(keyword: string, callback: (status: string, result: SearchResult | string) => void): void
  }

  interface AutocompleteOptions {
    city?: string
    citylimit?: boolean
  }

  interface AutocompleteTip {
    name: string
    district: string
    location: LngLat
    address: string
  }

  interface AutocompleteResult {
    tips: AutocompleteTip[]
  }

  class AutoComplete {
    constructor(options?: AutocompleteOptions)
    search(keyword: string, callback: (status: string, result: AutocompleteResult | string) => void): void
  }

  class Geolocation {
    constructor(options?: {
      convert?: boolean
      enableHighAccuracy?: boolean
      timeout?: number
      buttonOffset?: Pixel
      zoomToAccuracy?: boolean
    })
    getCurrentPosition(callback: (status: string, result: GeolocationResult | string) => void): void
  }

  interface GeolocationResult {
    position?: LngLat
    accuracy?: number
    formattedAddress?: string
    message?: string
  }

  interface ConvertFromResult {
    locations: LngLat[]
  }

  function convertFrom(
    lnglat: [number, number],
    type: 'gps' | 'baidu' | 'mapbar',
    callback: (status: string, result: ConvertFromResult | string) => void,
  ): void
}

interface Window {
  AMap?: typeof AMap
  _AMapSecurityConfig?: { securityJsCode: string }
}
