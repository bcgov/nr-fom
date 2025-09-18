import { ANALYTICS_DATA_DEFAULT_SIZE, DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { inject } from '@angular/core';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { AnalyticsDashboardDataService } from 'app/analytics-dashboard/analytics-dashboard-data.service';
import { DateTime } from 'luxon';

export const analyticsResolver = () => {
  const analyticsService = inject(AnalyticsDashboardDataService);

  // Below are default.
  const startDate = FOM_GO_LIVE_DATE;
  const endDate = DateTime.fromJSDate(new Date()).toFormat(DEFAULT_ISO_DATE_FORMAT);
  const limit = ANALYTICS_DATA_DEFAULT_SIZE;
  return analyticsService.getAnalyticsData(startDate, endDate, ProjectPlanCodeFilterEnum.Fsp, limit);
};