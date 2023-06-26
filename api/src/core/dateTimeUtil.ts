import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';
import * as advancedFormat from 'dayjs/plugin/advancedFormat'
import _ = require('lodash');
import * as customParseFormat from 'dayjs/plugin/customParseFormat';

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
        // dayjs requres additional plugin for timezone/utc mode.
        dayjs.extend(utc);
        dayjs.extend(timezone);
        dayjs.extend(advancedFormat);
    }
}