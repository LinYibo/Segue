import { createRoot } from 'react-dom/client'

import { ErrorBoundary } from '@/components/error-boundary'
import { markPlatform } from '@/lib/platform'
import { createWebHost } from '@/web/web-host'
import { WebWorkbench } from '@/web/workbench'
import '@/styles.css'

// The demo runs entirely in the browser: settings live in localStorage and
// chat is fetched straight from the provider (see @/web/web-host).
markPlatform('web')
window.segueHost = createWebHost()

createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <WebWorkbench />
  </ErrorBoundary>,
)
