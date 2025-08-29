import { AnalyticsDashboardDataService } from '@admin-core/services/analytics-dashboard-data.service';
import { DEFAULT_ISO_DATE_FORMAT, FOM_GO_LIVE_DATE } from '@admin-core/utils/constants';
import { inject } from '@angular/core';
import { ProjectPlanCodeFilterEnum } from '@api-client';
import { DateTime } from 'luxon';

export const analyticsResolver = () => {
  const analyticsService = inject(AnalyticsDashboardDataService);
  const startDate = FOM_GO_LIVE_DATE;
  const endDate = DateTime.fromJSDate(new Date()).toFormat(DEFAULT_ISO_DATE_FORMAT);
  const limit = 15;
  return analyticsService.getAnalyticsData(startDate, endDate, ProjectPlanCodeFilterEnum.Fsp, limit);
};