[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

# Forest Operation Map (FOM)

FOM projects (proposals for logging, essentially) are submitted to FOM and made available for public review and comment. The submitting organization then needs to address the comments before submitting the project to the ministry.

## Technical Details

Technology Stack: Angular, Node.js with Nest/TypeORM framework, PostgresSQL with PostGIS running in OCP v4

The officially supported version of node is v14 LTS and npm is v6.

This is a repo that includes the API backend and the two Angular front-ends with a shared 'libs'.

## Documentation

See ministry Confluence site: https://apps.nrs.gov.bc.ca/int/confluence/pages/viewpage.action?pageId=83560736


## Local Development

Once set up, the stack can be access using the following paths on localhost:

- Postgres: localhost:5432
- API: localhost:3333/api
- Admin frontend: localhost:4200/admin
- Public frontend: localhost:4300/public


### Docker Compose

- Install docker and docker-compose
- Run `docker-compose up`

Individual components can be started separately or daemonized.
E.g. database in the background (daemonized), the api in the foreground:

```
docker-compose up -d db
docker-compose up api
```

### Connect to local database:

- Install dbeaver or pgadmin
- Ensure database is running (docker-compose up -d db && cd api && npm run typeorm:migrate)
- Create PostGRES connection to local database using connection information as defined in docker-compose.yml

### To rebuild local database from scratch
This drops and recreates the database and runs all migrations including test ones. (Although migrations are also run when starting the API component, test migrations only run at startup if environment variable DB_TESTDATA = true)
- npm run db:recreate

To explicitly delete database: 
- docker-compose down
- docker volume rm nr-fom-api_ms-postgres-data

### Database Migrations Setup
- See [API Backend - Database Migrations Setup](./api/README.md)

## Application Specific Setup:

<!--- instruction on setup local environment and dependencies.. --->
- API Backend - See setup at [API Backend Readme](./api/README.md).
<!-- TODO: link to two frontends README.md -->

## Client Library Generation
- See Client Library Generation at [API Backend Readme](./api/README.md).

## Upgrading 3rd party dependencies

Due to the minimal automated tests, the following should be done after major dependency changes:
- (API Backend): npm run build:api
- (API Backend): npm run test-unit
- (Public Frontend): npm run start:public
- (Admin Frontend): npm run start:admin (ideally with security and object storage enabled)
- (API Backend): npm run start:api
- Test both front-ends.

<!-- TODO
## Deployment (OpenShift)

See [OpenShift Readme](./openshift/README.md)

<!--- Best to include details in a openshift/README.md --- >
-->

<!---
## Getting Help or Reporting an Issue

<!-- TODO: where to report???
To report bugs/issues/feature requests, please file an [issue](../../issues).
-->

## How to Contribute

If you would like to contribute, please see our [CONTRIBUTING](./CONTRIBUTING.md) guidelines.

Please note that this project is released with a [Contributor Code of Conduct](./CODE_OF_CONDUCT.md).
By participating in this project you agree to abide by its terms.

## License
- See [LICENSE](./LICENSE.md)