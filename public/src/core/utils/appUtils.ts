
import { DateTime } from 'luxon';

/**
 * @class AppUtils
 */
export class AppUtils {
  static copy(obj: any) {
    // deep object copy
    return JSON.parse(JSON.stringify(obj));
  }
}
export const getCommentingClosingDate = (commentingClosedDate: string) => {
    // Note: commenting_closingDate (inclusive) = commenting_closedDate (exclusive) - 1 day
    // The value should only be used for display, not to pass to backend.
    const commentingClosingDate = DateTime.fromISO(commentingClosedDate).minus({days: 1});
    return commentingClosingDate.toISODate();
}