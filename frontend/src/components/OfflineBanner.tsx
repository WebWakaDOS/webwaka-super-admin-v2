import { useState, useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handleOffline = () => {
      setIsOffline(true)
      setDismissed(false)
    }
    const handleOnline = () => {
      setIsOffline(false)
      setDismissed(false)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline || dismissed) return null

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-amber-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
    >
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>You are offline. Some data may be stale.</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline notification"
        className="ml-2 rounded p-0.5 hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
