import * as _ from 'lodash';
import dayjs from 'dayjs';
import 'dayjs/plugin/utc';
import 'dayjs/plugin/timezone';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';

/**
 * This util acts as a wrapper for some date/time munipulation functions, especially for timezone related transform.
 * Current implemented is based on dayjs library. Could change to use libraries if needed.
 * Use this as centralized date/time calculation so that if there is a bug, it is easier to fix all.
 */
export class DateTimeUtil {
    
    static readonly TIMEZONE_VANCOUVER: string = 'America/Vancouver';
    static readonly DATE_FORMAT = "YYYY-MM-DD";

    /**
     * This return timezone based date/time or server local date/time.
     * @param timezone valid TimeZone string e.g 'America/Vancouver'
     * @returns current date/time based on 'timezone'. If 'timezone' is not provided, server local date/time.
     */
    public static now(inTimezone: string) {
        DateTimeUtil.init();
        if (!inTimezone) {
            return dayjs(); // dayjs is based on local. If server is using UTC date/time, then it is UTC date/time.
        }
        return dayjs.tz(dayjs().utc(), DateTimeUtil.DATE_FORMAT, inTimezone);
    }

    public static nowBC() {
        return DateTimeUtil.now(DateTimeUtil.TIMEZONE_VANCOUVER);
    }

    /**
     * 
     * @param dateInput valid date input string (as "YYYY-MM-DD") for parsing.
     * @param timezone valid TimeZone string e.g 'America/Vancouver'.
     * @returns dayjs object based on 'timezone'.
     */
    public static get(dateInput: string, inTimezone: string) {
        DateTimeUtil.init();
        if (!inTimezone) {
            return dayjs(dateInput);
        }
        return dayjs.tz(dateInput, DateTimeUtil.DATE_FORMAT, inTimezone);
    }

    /**
     * 
     * @param dateInput valid date input string (as "YYYY-MM-DD") for parsing.
     * @returns dayjs object at BC timezone 'America/Vancouver'.
     */
    public static getBcDate(dateInput: string) {
        return this.get(dateInput, DateTimeUtil.TIMEZONE_VANCOUVER);
    }

    /**
     * 
     * @param startDateSt beginning date as string (as "YYYY-MM-DD").
     * @param endDateSt end date as string (as "YYYY-MM-DD").
     * @param timezone valid TimeZone string e.g 'America/Vancouver'.
     * @param unit dayjs valid unit.
     * @returns # of unit difference between two dates.
     */
    public static diff(startDateSt: string, endDateSt: string, inTimezone: string, unit: any) {
        DateTimeUtil.init();
        const startDate = this.get(startDateSt, inTimezone);
        const endDate = this.get(endDateSt, inTimezone);
        return endDate.startOf(unit).diff(startDate.startOf(unit), unit);
    }

    public static diffNow(endDateSt: string, inTimezone: string, unit: any) {
        DateTimeUtil.init();
        const now = this.now(inTimezone);
        const endDate = this.get(endDateSt, inTimezone);
        return endDate.startOf(unit).diff(now.startOf(unit), unit);
    }

    /*
    Limited to only check date string value with backend defined date format: DateTimeUtil.DATE_FORMAT.
    Valid date string like "2023-06-07" has length: 10 (so, no time portion).
    Note: "2023-06-07" and "06-07-2023" and "2023/06/07" etc are treated valid from dayjs library and all
        are translated into "2023-06-07" by the dayjs library.
    For now it does not provide flexbility to check other format.
    */
    public static isValidDateOnlyString(value: string): boolean {
        dayjs.extend(customParseFormat);
        return !_.isEmpty(value) && value.length == 10 && dayjs(value, DateTimeUtil.DATE_FORMAT, true).isValid();
    }

    /**
     * Public Notice postDate validation: on or before commenting start date.
     * This is exported validation to be conveniently used in other service.
     * @param postDate YYYY-MM-DD date string for public notice post date.
     * @param commentingOpenDate YYYY-MM-DD date string for FOM (Project) commentingOpenDate
     * @returns true only if postDate on or before commentingOpenDate; 
     */
    public static isPNPostdateOnOrBeforeCommentingOpenDate(postDate: string, commentingOpenDate: string) {
        if (_.isEmpty(commentingOpenDate) || !DateTimeUtil.isValidDateOnlyString(commentingOpenDate)) {
            throw new Error(`Invalid argument commentingOpenDate: ${commentingOpenDate}`)
        }

        if (!_.isEmpty(postDate) && !DateTimeUtil.isValidDateOnlyString(postDate)) {
            throw new Error(`Invalid argument postDate: ${postDate}`)
        }

        return postDate && !(
            DateTimeUtil.getBcDate(postDate).startOf('day').isAfter(
            DateTimeUtil.getBcDate(commentingOpenDate).startOf('day'))
        )
    }

    private static init() {
        // dayjs plugins are self-registering when imported
        dayjs.extend(advancedFormat);
        dayjs.extend(customParseFormat);
        // utc and timezone plugins are already registered via side-effect imports
    }
}