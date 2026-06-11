import { DateTimeUtil } from '@api-core/dateTimeUtil';
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive, MaxLength, Min, MinLength, ValidationArguments, ValidationOptions, registerDecorator } from 'class-validator';
import dayjs = require('dayjs');
import _ = require('lodash');

// Ref - class-validator: custom validator.
export function IsISODateOnlyString(validationOptions?: ValidationOptions) {
    return function (object: Object, propertyName: string) {
        registerDecorator({
            name: 'isISODateOnlyString',
            target: object.constructor,
            propertyName: propertyName,
            options: validationOptions,
            validator: {
              validate(value: any, _args: ValidationArguments) {
                // validate if dto property value (such as 'communicationDate') passes date string format 'YYYY-MM-DD'
                return DateTimeUtil.isValidDateOnlyString(value);
              },
            },
        });
    }    
}

export class InteractionCreateRequest {
  constructor(projectId: number | null = null, 
              stakeholder: string | null = null, 
              communicationDate: string | null = null, 
              communicationDetails: string | null = null,
              fileName: string | null = null,
              file: Buffer | null = null) {
    this.projectId = projectId;
    this.stakeholder = stakeholder;
    this.communicationDate = communicationDate;
    this.communicationDetails = communicationDetails;
    this.fileName = (!_.isNil(fileName) && fileName !== 'null')? fileName: null;
    this.file = file;
  }

  @ApiProperty()
  @IsInt({message: '"$property" must be an integer number.'})
  projectId!: number | null;
  
  @ApiProperty({ required: false })
  @MaxLength(55)
  stakeholder!: string | null;

  @ApiProperty({ required: true })
  @IsISODateOnlyString({message: `"$property" must be ISO-formatted date. (Required format: ${DateTimeUtil.DATE_FORMAT})`})
  @IsNotEmpty()
  communicationDate?: string | null;

  @ApiProperty()
  @MaxLength(4000)
  @MinLength(1, {message: '"$property" must have at least 1 character.'})
  @IsNotEmpty()
  communicationDetails!: string | null;
  
  fileName!: string | null; 

  file!: Buffer | null;
  
  @ApiProperty({ required: false })
  attachmentId!: number;
}

export class InteractionUpdateRequest extends InteractionCreateRequest {

  constructor(projectId: number | null = null, 
    stakeholder: string | null = null, 
    communicationDate: string | null = null, 
    communicationDetails: string | null = null,
    fileName: string | null = null,
    file: Buffer | null = null,
    id: number | null = null,
    revisionCount: number | null = null) {
    super(projectId, stakeholder, communicationDate, communicationDetails, fileName, file);
    this.id = id;
    this.revisionCount = revisionCount;
  }

  @ApiProperty()
  @IsInt({message: '"$property" must be an integer number.'})
  @IsPositive()
  @Min(1)
  id!: number | null;

  @ApiProperty()
  @IsInt({message: '"$property" must be an integer number.'})
  @IsPositive()
  @Min(1)
  revisionCount!: number | null;
}

export class InteractionResponse extends InteractionCreateRequest {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  revisionCount!: number;

  @ApiProperty({ description: 'ISO-formatted timestamp'})
  createTimestamp!: string;
}