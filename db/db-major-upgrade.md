# FOM PostgreSQL database major version upgrade
This readme describes steps to parepare and perform FOM PostgreSQL **major version** upgrade on OpenShift with current pipeline.

FOM database also has **PostGIS extensions** installed and used for some GIS operations. After major version upgrade, some verification is also needed to confirm PostGIS is installed properly.  

The upgrade is using PostgreSQL's **pg_dump** utility to do the main step for backup and restore during the process.

With current major db upgrade setup, there are **two PRs (prep, post) and 1 Github action trigger (disaptch)** needed to be happened to complete the db major version upgrade for the project.

### -- Important! -- ###
* The **prep** pull request and **post** pull request should not be both merged into main branch at the same time before upgrade is done. The database major version upgrade should be done in all environments in sequence order.

## Major upgrade preparation
- `db/Dockerfile-[upgrade_version]`: FOM needs to build the docker image for database using Dockefile in `db` directory (for version, e.g., `v13`). Before major db upgrade, a second Dockerfile is added temporarily to target the intended major db version (e.g., **Dockerfile-v17**). This second Dockerfile while having the intended target db version, also needs to make sure it has PostGIS extension with it. This dockerfile will be build for image saved at Github db package for later deployment.

- `.db/openshift.deploy.dbupgrade.[upgrade_version].yml`: A temporary new database deployment teamplate. During the process, this will deploy the new database with the new major version. 
  
  This is almost the same as regular `db/openshift.deploy.yml` in database spec portion; but is named and labled explicitly to the target db version for the template, container, PVC and the service. It also mounts the upgrade backup PVC shared between regular db template and this upgrade template for restoring the backup to the new database.

  Developer will need to prepare this dbupgrade template before the process.
  * Duplicate or rename the existing version file for the target version. For example: `openshift.deploy.dbupgrade.v16.yml` => `openshift.deploy.dbupgrade.v17.yml`
  * Change parameter `DB_UPGRADE_VERSION` to the target version.
  
- `db/openshift.deploy.yml`: This is the existing regular OpenShift deployment template for database.
This template is slightly modified to prepare existing db pod with different **PVC** designated for **pg_dump** backup during the upgrade process. Look for `DB_UPGRADE_VERSION` and `DB_UPGRADE_BACKUP_DIR` and change for the intended target version:
  - `DB_UPGRADE_VERSION` - Target version for database upgrade

- `.github/workflows/db-major-upgrade.yml`: This is a Github Action Workflow responsible for a sequence of steps for database major version migration triggered on `workflow_dispatch` using previously prepared templates.
  
  One job (`db-major-upgrade`) to perform major db version uprade, and the other job (`rollback`) to revert application to point back to previous database in case if needed. This option isn't critically needed but is convenient during testing. Without this `rollback` job, developer can still manually follow the revert steps on the OpenShift.

  Developer will review this action workflow and adjust env 
  * `DB_CURRENT_VERSION`: make sure the current version (e.g., v16)
  * `DB_UPGRADE_VERSION`: update to the target major db version (e.g., v17) 
  * `DB_UPGRADE_BACKUP_DIR`: confirm directory is correct.

  ## Begin PostgreSQL database major upgrade
  ### 1. Create a branch for database major version upgrade and start a Pull Request to main branch.
     - Prepare the version changes mentioned above for the database upgrade and create pull request to main branch(prep pr).
     - (optional) create a testing branch from that pull request to test (using the trigger) the upgrade in DEV environment (PR based) if desired. Can delete that branch after making sure upgrade works. If triggering from GH CLI (console command line, requires ), can use following commands:
    ```
    gh workflow run db-major-upgrade.yml -f target=<pr#> --ref <target-branch>

    gh workflow run db-major-upgrade.yml -f target=<pr#> -f revert-only=true --ref <target-branch>
    ```
     - Review and merge the pr (not the testing pr) to main branch (deploy this preparation to test environment). 

  ### 2. Create a branch to prepare for `post` database upgrade.
     * Right after the `prep` pull request is merged to main, create a new branch for preparing post database upgrade.
     * Adjust `db/Dockerfile` image to the target version.
     * Keep `.db/openshift.deploy.dbupgrade.[upgrade_version].yml` for future reference.
     * Remove `db/Dockerfile-[upgrade_version]`.
     * Adjust `db/openshift.deploy.yml` to match target version for **name** and **lable**.
       - At very first **post** upgrade, the parameter `name: DB_CURRENT_VERSION` will need to be added to this template with default value to the target version.
       - Second time onward, adjust the value for the parameter `DB_CURRENT_VERSION` to the target version.
     * Leave `.github/workflows/db-major-upgrade.yml` for future use.
     * Adjust API component's `api/openshift.deploy.yml` pointing at correct database.
       - At very first **post** upgrade, the parameter `name: DB_CURRENT_VERSION` will need to be added to this template with default value to the target version.
       - Second time onward, adjust the value for the parameter `DB_CURRENT_VERSION` to the target version.

  ### 3. Use the `Database Upgrade (dispatch)` action, provide the `target` (`test`, and `prod`) to trigger database upgrade at OpenShift `test` and `prod` deployments. 
  
    Make sure it runs successfully and test a few to confirm application is working as expect for new database upgrade.

  - After Merging to main and deploying to test environment, do some testing before triggering database upgrade. 
  - Then trigger the `Database Upgrade (dispatch)` action to upgrade the database at the `test` environment. 
  - Test and confirm again after database upgrade that application is working as expect. Database pod should appear as a new rollout with `fom-[pr#/test/prod]-db-v[db version]`. Verify the `api` pod (optionally, the cronjobs) for `DB_HOST` is pointing to correct database pod.

  - Follow same procedure above to deploy to `prod` after `test` environment was upgraded successful.

### 4. Apply the `post` upgrade pull request prepared earlier


### 5. Clean up
  - Remove old stopped database pod/deployment.
  - Remove old unused PVC/volume.