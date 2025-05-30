# FOM PostgreSQL database major version upgrade
This readme describes steps to parepare and perform FOM PostgreSQL **major version** upgrade on OpenShift with current pipeline.

FOM database also has **PostGIS extensions** installed and used for some GIS operations. After major version upgrade, some verification is also needed to confirm PostGIS is installed properly.  

The upgrade is using PostgreSQL's **pg_dump** utility to do the main step for backup and restore during the process.

With current major db upgrade setup, there are **two PRs (prep, post) and 1 Github action trigger (disaptch)** needed to be happened to complete the db major version upgrade for the project.

## Major upgrade preparation
- `db/Dockerfile-[upgrade_version]`: FOM needs to build the docker image for database using Dockefile in `db` directory (for version, e.g., `v13`). Before major db upgrade, a second Dockerfile is added temporarily to target the intended major db version (e.g., **Dockerfile-v17**). This second Dockerfile while has the intended target db version, also needs to make sure it has PostGIS extension with it. This dockerfile will be build for image saved at Github db package for later deployment.

- `db/openshift.deploy.yml`: This is the existing regular OpenShift deployment template for database.
This template is slightly modified to prepare existing db pod with different **PVC** designated for **pg_dump** backup during the upgrade process. Look for `DB_UPGRADE_VERSION` and `DB_UPGRADE_BACKUP_DIR` and change for the intended target version:
  - `DB_UPGRADE_VERSION` - Target version for database upgrade
  - `DB_UPGRADE_BACKUP_DIR` - Pod mounts this directory for the db upgrade backup PVC. Make sure the directory is correct.

- `.db/openshift.deploy.dbupgrade.[upgrade_version].yml`: A temporary new database deployment teamplate. During the process, this will deploy the new database with the new major version. 
  
  This is almost the same as regular `db/openshift.deploy.yml` in database spec portion; but is named and labled explicitly to the target db version for the template, container, PVC and the service. It also mounts the upgrade backup PVC shared between regular db template and this upgrade template for restoring the backup to the new database.

  Developer will need to prepare this dbupgrade template before the process.

- `.github/workflows/db-major-upgrade.yml`: This is a Github Action Workflow responsible for a sequence of steps for database major version migration triggered on `workflow_dispatch` using previously prepared templates.
  
  One job (`db-major-upgrade`) to perform major db version uprade, and the other job (`rollback`) to revert application to point back to previous database in case if needed. This option isn't critically needed but is convenient during testing. Without this `rollback` job, developer can still manually follow the revert steps on the OpenShift.

  Developer will review this action workflow and adjust env `DB_UPGRADE_VERSION` to the target major db version and confirm `DB_UPGRADE_BACKUP_DIR` directory is correct.

  ## Begin PostgreSQL database major upgrade
  - Prepare the version changes mentioned above for the database upgrade and create pull request to main branch(prep pr).
  - Use the `Database Upgrade (dispatch)` action, provide the `target` (pr#), select the branch and optional parameters to trigger database upgrade at OpenShift `dev` deployments. 
  
    Make sure it runs successfully and test a few to confirm application is working as expect for new database upgrade.

    If triggering from GH CLI (console command line, requires ), can use following commands:
    ```
    gh workflow run db-major-upgrade.yml -f target=<pr#> --ref <target-branch>

    gh workflow run db-major-upgrade.yml -f target=<pr#> -f revert-only=true --ref <target-branch>
    ```
  - Merge to main, deploy to test environment. Do some testing before database upgrade. Then trigger the `Database Upgrade (dispatch)` action to upgrade the database at the test environment. Test and confirm again after database upgrade that application is working as expect.