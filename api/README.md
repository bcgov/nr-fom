[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

# Forest Operation Map (FOM) API - Backend

## Technical Details

Technology Stack: Node.js with Nest/TypeORM framework, PostgresSQL with PostGIS for database and migrations.


## Documentation

- See FOM documentation at [FOM Readme](../README.md).


## Local Development

Once set up, the stack can be access using the following paths on localhost:

- API: localhost:3333/api

### Docker Compose

- See [FOM Readme](../README.md)


### Local / Bare Metal

Dependencies are managed with npm workspaces and installed once at the **repository root** — there is no separate install for this component:

```
cd ..        # repository root
npm ci
```

Running the API also requires a reachable PostgreSQL and a set of environment variables. `localdev.env` (in this folder) holds local defaults; the object storage secret is not included and must be supplied separately.

`OBJECT_STORAGE_SECRET` = object storage secret, available in the OpenShift dev secret `fom-object-storage-dev`.

Here's how to run only the api locally (a database must be running first — e.g. `docker compose up -d db` from the repository root):

```
# From the api directory, load local environment variables into the current shell
source ./localdev.env          # Linux, macOS

# Object storage secret (not included in localdev.env)
export OBJECT_STORAGE_SECRET=<hidden>

# Start the API (from the api directory; or `npm run start:api` from the repository root)
npm run start:api
```

Other component scripts are defined in `package.json` (`build:api`, `test-unit`, `db:migrate-*`, batch entry points, etc.).

## Client Library Generation
These are the steps to generate the client library used by the frontend components (Admin + Public)
- Code changes to the API that are documented in Swagger using Swagger annotations like @ApiTags, @ApiProperty 
- Start the API component (npm run start:api) and access http://localhost:3333/api-json. Copy this content to 'openapi/swagger-spec.json'
- Remove the existing generated client library files. Delete the directories ../libs/client/typescript-ng/{api|models}.
- Generate the client library using 'npm run gen:client-api:ng'. Generated files will be placed into '../libs/client/typescript-ng'
- Copy the client library into the Admin and Public components in /src/core/api (current frontend has tsconfig.json 'path' referencing to this generated client so there is no need for this step; If it is not setup, then this step is required.)

## Database Migrations Setup
- See [Database Migrations Setup](./src/migrations/README.md)

## License

    Copyright 2021 Province of British Columbia

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
