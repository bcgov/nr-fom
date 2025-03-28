import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  standalone: true,
  name: 'objectFilter'
})
export class ObjectFilterPipe implements PipeTransform {
  transform(value: any[], q: string) {
    if (!q || q === '') {
      return value;
    }
    // NB: item must have 'name' property
    return value.filter(item => -1 < item.name.toUpperCase().indexOf(q.toUpperCase()));
  }
}
