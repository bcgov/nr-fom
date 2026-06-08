import { DynamicModule, Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [],
})
export class CoreModule {
  static forRoot(options: {
    database?: string;
  }): DynamicModule {
    const { database = '' } = options;
    const providers: any[] = [];

    return { module: CoreModule, providers, exports: providers };
  }
}
