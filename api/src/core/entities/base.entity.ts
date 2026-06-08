import { Column, CreateDateColumn, UpdateDateColumn, VersionColumn } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T[P] extends ReadonlyArray<infer U>
    ? ReadonlyArray<DeepPartial<U>>
    : DeepPartial<T[P]> | T[P];
};

export abstract class ApiBaseReadOnlyEntity<M> {

  // Do not include any metadata columns to simplify mapping to DTOs.

  constructor(model?: Partial<M>) {
    Object.assign(this, model);
  }

  factory(props: Partial<M> | QueryDeepPartialEntity<M>): DeepPartial<M> {
    const model = Object.create(this);
    Object.assign(model, props);

    return model;
  }
}

export abstract class ApiBaseEntity<M> extends ApiBaseReadOnlyEntity<M> {
  // Primary key needs to be declared in concrete entity classes in order to specify the column name - different for each table as per client naming standard.

  // Metadata columns
  @VersionColumn({ name: 'revision_count' })
  public revisionCount!: number;

  @CreateDateColumn({ name: 'create_timestamp', type: 'timestamptz' })
  public createTimestamp!: Date;

  @Column({ name: 'create_user'})
  public createUser!: string;

  @UpdateDateColumn({ name: 'update_timestamp', type: 'timestamptz' })
  public updateTimestamp!: Date;

  @Column({ name: 'update_user'})
  public updateUser!: string;

}
