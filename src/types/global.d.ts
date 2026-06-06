export {}

declare module '*.yaml?raw' {
  const content: string
  export default content
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string
        initDataUnsafe?: {
          user?: {
            id: number
            username?: string
            first_name?: string
            last_name?: string
            language_code?: string
          }
        }
        LocationManager?: {
          getLocation?: (
            callback: (
              location: {
                accuracy?: number
                altitude?: number
                altitude_accuracy?: number
                course?: number
                horizontal_accuracy?: number
                latitude: number
                longitude: number
                speed?: number
              } | null,
            ) => void,
          ) => void
          init?: (callback?: () => void) => void
          isAccessGranted?: boolean
          isAccessRequested?: boolean
          isInited?: boolean
          isLocationAvailable?: boolean
          openSettings?: () => void
        }
        ready?: () => void
      }
    }
  }
}
