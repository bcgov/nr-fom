import { ApiProperty } from '@nestjs/swagger';

/**
 * An enum with code + description that is not persisted in the database. (Code values are populated by the spatial feature view definition).
 */
export class FeatureTypeCode {

  static codeToInstanceMap: { [key: string]: FeatureTypeCode } = {};

  @ApiProperty()
  public code!: string;

  @ApiProperty()
  public description!: string;

  protected constructor(code: string, description: string) {
    this.code = code;
    this.description = description;

    FeatureTypeCode.codeToInstanceMap[code] = this;
  }

  static getInstance(code: string): FeatureTypeCode {
    return FeatureTypeCode.codeToInstanceMap[code];
  }

  static CUT_BLOCK: FeatureTypeCode = new FeatureTypeCode('cut_block', 'Cut Block');
  static RETENTION_AREA: FeatureTypeCode = new FeatureTypeCode('retention_area', 'Retention Area');
  static ROAD_SECTION: FeatureTypeCode = new FeatureTypeCode('road_section', 'Road Section');
}
