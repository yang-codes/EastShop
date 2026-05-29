import { MapPin } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../../components/PageHeader'
import { locationService } from '../../services/locationService'
import type { SupportedLanguage } from '../../types/language'
import type { LocationSnapshot } from '../../types/order'

function resolveLanguage(language: string): SupportedLanguage {
  if (language.startsWith('zh')) {
    return 'zh'
  }

  if (language.startsWith('ru')) {
    return 'ru'
  }

  return 'en'
}

function getLocationErrorMessage(error: unknown, fallback: string) {
  if (error instanceof GeolocationPositionError) {
    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message === 'GEOLOCATION_UNSUPPORTED' ? fallback : error.message
  }

  return fallback
}

export function CheckoutPage() {
  const { i18n, t } = useTranslation()
  const [address, setAddress] = useState('')
  const [location, setLocation] = useState<LocationSnapshot | null>(null)
  const [locationStatus, setLocationStatus] = useState('')
  const [isLocating, setIsLocating] = useState(false)

  async function handleLocate() {
    setIsLocating(true)
    setLocationStatus(t('checkout.locating'))

    try {
      const position = await locationService.getBrowserPosition()
      const snapshot = await locationService.reverseGeocode(position, resolveLanguage(i18n.language))
      const coordinates = `${snapshot.latitude?.toFixed(6)}, ${snapshot.longitude?.toFixed(6)}`
      const locationLine = t('checkout.locationCoordinates', {
        accuracy: Math.round(snapshot.accuracy ?? 0),
        coordinates,
      })

      setLocation(snapshot)
      setAddress((current) => (current.trim() ? `${current}\n${locationLine}` : locationLine))
      setLocationStatus(t('checkout.located'))
    } catch (error) {
      setLocation(null)
      setLocationStatus(getLocationErrorMessage(error, t('checkout.locationFailed')))
    } finally {
      setIsLocating(false)
    }
  }

  return (
    <section className="page-stack">
      <PageHeader title={t('checkout.title')} />
      <form className="form-card" onSubmit={(event) => event.preventDefault()}>
        <label>
          {t('checkout.username')}
          <input type="text" />
        </label>
        <label>
          {t('checkout.phone')}
          <input type="tel" />
        </label>
        <label>
          {t('checkout.address')}
          <textarea onChange={(event) => setAddress(event.target.value)} rows={3} value={address} />
        </label>
        <button className="secondary-button" disabled={isLocating} onClick={handleLocate} type="button">
          <MapPin size={18} />
          {isLocating ? t('checkout.locating') : t('checkout.locate')}
        </button>
        {locationStatus ? <p className="location-status">{locationStatus}</p> : null}
        {location?.latitude && location.longitude ? (
          <a
            className="map-link"
            href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`}
            rel="noreferrer"
            target="_blank"
          >
            {t('checkout.openMap')}
          </a>
        ) : null}
        <label>
          {t('checkout.social')}
          <input type="text" />
        </label>
        <label>
          {t('checkout.note')}
          <textarea rows={2} />
        </label>
        <button className="primary-button" type="submit">
          {t('checkout.submit')}
        </button>
      </form>
    </section>
  )
}
