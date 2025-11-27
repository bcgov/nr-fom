[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
![Lifecycle:Maturing](https://img.shields.io/badge/Lifecycle-Maturing-007EC6)

[![Analysis](https://github.com/bcgov/nr-fom/actions/workflows/analysis.yml/badge.svg)](https://github.com/bcgov/nr-fom/actions/workflows/analysis.yml)
[![DEMO (merge)](https://github.com/bcgov/nr-fom/actions/workflows/merge-demo.yml/badge.svg)](https://github.com/bcgov/nr-fom/actions/workflows/merge-demo.yml)
[![TEST (merge)](https://github.com/bcgov/nr-fom/actions/workflows/merge-main.yml/badge.svg)](https://github.com/bcgov/nr-fom/actions/workflows/merge-main.yml)
[![PROD (release)](https://github.com/bcgov/nr-fom/actions/workflows/release.yml/badge.svg)](https://github.com/bcgov/nr-fom/actions/workflows/release.yml)

# Forest Operation Map (FOM) LIBS

## Overview

- Libs folder contains shared codes (types, interfaces, functions, classes, components, custom library etc.,) for local development shared amoung 'public', 'admin' and 'api' projects.

- To use this libs, the referencing project needs to have some setup at its tsconfig.json. Please refer to each project for specific settings (on 'paths').

## Project Structure

Under 'libs' folder, current categories for the libs project contains:

"<code><b>client</b></code>" subfolder: 

   - This hosts the generated 'api' client library by using '@openapitools/openapi-generator-cli'. 
   - Only generate and update this folder when required, DO NOT manually touch generated files.
   - Generated library are shared by 'public' and 'admin' frontend for backend communication needs.
   - 'api' project does not use this library.

"<code><b>utility</b></code>" subfolder:
   - This is the common places for common code to be deposited and shared among other projects.
   - One specific 'user.ts' object is shared between 'api' and 'admin' and should be changed carefully.

## Requirement to Build for Project using LIBS

FOM has been migrated from mono-repo to none mono-repo for ease of resolving dependencies individually for each project (but not 'libs' with versioning). As 'libs' is a sibling project beside other projects, for the individual project to use it and to build, you do require to do following steps first before building individual project:
- cd libs
- npm ci --ignore-scripts

## Client Library Generation
- See [Client Library Generation](../api/README.md)

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
