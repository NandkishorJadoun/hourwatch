import handler from '@tanstack/react-start/server-entry'

import { runHourlySnapshots } from '#/lib/snapshots'
import { renewExpiringSubscriptions } from '#/lib/websub'

export default {
  fetch: handler.fetch,
  async scheduled(controller: ScheduledController) {
    switch (controller.cron) {
      case '0 * * * *':
        await runHourlySnapshots()
        break
      case '0 5 * * *':
        await renewExpiringSubscriptions()
        break
    }
  },
}