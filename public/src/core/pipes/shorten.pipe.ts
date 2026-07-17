import { Pipe, PipeTransform } from '@angular/core';

/**
 * Shorten the text to its limit.
 *
 * @export
 * @class ShortenPipe
 * @implements {PipeTransform}
 */
@Pipe({
    name: 'shorten' 
})
export class ShortenPipe implements PipeTransform {
  transform(value: string, limit: number): string {
    if (!value) {
      return '';
    }
    if (value.length > limit) {
      return value.substring(0, limit) + ' ...';
    }
    return value;
  }
}
