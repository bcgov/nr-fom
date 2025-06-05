# FOM PostgreSQL database major version upgrade
This readme describes steps to parepare and perform FOM PostgreSQL **major version** upgrade on OpenShift with current pipeline.

FOM database also has **PostGIS extensions** installed and used for some GIS operations. After major version upgrade, some verification is also needed to confirm PostGIS is installed properly.  

The upgrade is using PostgreSQL's **pg_dump** utility to do the main step for backup and restore during the process.

With current major db upgrade setup, there are **two PRs (prep, post) and 1 Github action trigger (disaptch)** needed to be happened to complete the db major version upgrade for the project.

**Note!!** - The `prep`(PR)-`trigger`(upgrade)-`post`(PR) should apply in this order if there is no error in between and not to mix two pull request to main together.  

## Major upgrade preparation
- `db/Dockerfile-[upgrade_version]`: FOM needs to build the docker image for database using Dockefile in `db` directory (e.g., `v13`). Before major db upgrade, duplicate the db/Dockerfile to a second Dockerfile temporarily to target the intended major db version (e.g., **Dockerfile-v17**). This second Dockerfile while has the intended target db version, also needs to make sure it has PostGIS extension with it. This dockerfile will be build for image saved at Github db package for later deployment.

- `.db/openshift.deploy.dbupgrade.[upgrade_version].yml`: A temporary new database deployment teamplate. During the process, this will deploy the new database with the new major version. 
  
  This is almost the same as regular `db/openshift.deploy.yml` in database spec portion; but is named and labled explicitly to the target db version for the template, container, PVC and the service.

  Developer will need to prepare this dbupgrade template before the process.
  * Adjust the `DB_UPGRADE_VERSION` to the intended database target version.

- `db/openshift.deploy.yml`: This is the existing regular OpenShift deployment template for database.
This template is slightly modified to prepare existing db pod with different **PVC** designated for **pg_dump** backup during the upgrade process. 
  - Adjust `DB_UPGRADE_VERSION` - Target version for database upgrade

- `.github/workflows/db-major-upgrade.yml`: This is a Github Action Workflow responsible for a sequence of steps for database major version migration triggered on `workflow_dispatch` using previously prepared templates.
  
  One job (`db-major-upgrade`) to perform major db version uprade, and the other job (`rollback`) to revert application to point back to previous database in case if needed. This option isn't critically needed but is convenient during testing. Without this `rollback` job, developer can still manually follow the revert steps on the OpenShift.

  Developer will review this action workflow and adjust:
  * `DB_CURRENT_VERSION` - make sure current database version. The very firest run initially is `""` empty string (due to initial template has no db version annotated).
  * `DB_UPGRADE_VERSION` to the target major db version 
  * `DB_UPGRADE_BACKUP_DIR` and confirm directory is correct.

  ## Begin PostgreSQL database major upgrade
  1. Create a preparation pull request (**prep**)
     - Prepare the version changes mentioned above for the database upgrade and create pull request to main branch(prep pr).


  2. Create a post upgrade pull request (**post**)
     - Based on **prep* pull request, create a **post** branch and pull request.

  - Use the `Database Upgrade (dispatch)` action, provide the `target` (pr#), select the branch and optional parameters to trigger database upgrade at OpenShift `dev` deployments. 
  
    Make sure it runs successfully and test a few to confirm application is working as expect for new database upgrade.

    If triggering from GH CLI (console command line, requires ), can use following commands:
    ```
    gh workflow run db-major-upgrade.yml -f target=<pr#> --ref <target-branch>

    gh workflow run db-major-upgrade.yml -f target=<pr#> -f revert-only=true --ref <target-branch>
    ```
  - Merge to main, deploy to test environment. Do some testing before database upgrade. Then trigger the `Database Upgrade (dispatch)` action to upgrade the database at the test environment. Test and confirm again after database upgrade that application is working as expect.

  5. Clean up