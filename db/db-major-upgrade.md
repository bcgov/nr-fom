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
  - Adjust `DB_UPGRADE_VERSION`: target version for database upgrade

- `.github/workflows/db-major-upgrade.yml`: This is a Github Action Workflow responsible for a sequence of steps for database major version migration triggered on `workflow_dispatch` using previously prepared templates.
  
  One job (`db-major-upgrade`) to perform major db version uprade, and the other job (`rollback`) to revert application to point back to previous database in case if needed. This option isn't critically needed but is convenient during testing. Without this `rollback` job, developer can still manually follow the revert steps on the OpenShift.

  Developer will review this action workflow and adjust:
  * `DB_CURRENT_VERSION`: make sure current database version. The very firest run initially is `""` empty string (due to initial template has no db version annotated).
  * `DB_UPGRADE_VERSION`: to the target major db version 
  * `DB_UPGRADE_BACKUP_DIR`: and confirm directory is correct.

  ## Begin PostgreSQL database major upgrade
  1. Create a preparation pull request (**prep**)
     - Prepare the version changes mentioned above for the database upgrade and create pull request to main branch(prep pr).

  2. Create a post upgrade pull request (**post**)
     - Based on **prep* pull request branch, create a **post** branch and pull request after prepration.
     - `db/Dockerfile`: update image database version to the targeted version.
     - `db/Dockerfile-[upgrade_version]`: remove this versioned Dockerfile.
     - `.db/openshift.deploy.dbupgrade.[upgrade_version].yml`: leave this for the reference next time.
     - `db/openshift.deploy.yml`:
       * `name: DB_CURRENT_VERSION`: update this parameter to the current targeted version. **Note!** - the very first run, this parameter needs to be added; and the names/labels for PVC/deployment/volume/cronJob will need to be adjusted accrodingly. 
     - `.github/workflows/db-major-upgrade.yml`:
       * `DB_CURRENT_VERSION`: update this env to the current targeted version.
       * leave this file for the next time.
     - `api/openshift.deploy.yml`: 
       * `DB_CURRENT_VERSION`: update this to the current targeted version. **Note!** - the very first run, this parameter needs to be added; and the `DB_HOST` for api deployment/cronJob will need to be adjusted accrodingly. 

  3. **(important, Optional)** Create a testing branch to test database upgrade from PR branch in DEV environment in all steps. 
    
     Before upgrading database in `test` and `prod` enviornment, it is better to do a testing at OpenShift `dev` pull-request environment to confirm script is working.

     - Create a branch based on main branch as a testing branch and create a draft pull request. This will have a fresh prod-like deployment in dev OpenShift environment.
     - Merge previous **'prep'** branch to this testing branch.
     - test app is running and add a new FOM with geospatial submission just for testing.
     - Locally at your command line console, you can execute `Database Upgrade (dispatch)` workflow adjusted and committed for that testing branch. **Note! This requires GH CLI authentication setup in place.**
       
       You can execute the workflow run with following example command (with your testing pr number, and reference branch):
       ```
       gh workflow run db-major-upgrade.yml -f target=<pr#> --ref <target-branch>

       For example: gh workflow run db-major-upgrade.yml -f target=802 --ref fix/742--testing
       ```

       Wait for script to run successfully. If it succeeds, You will see old database is stopped and new [versioned] database pod is up and running. 
    
     - test the app is running by looking into the new FOM created previously. Also review cronJobs are pointing to the new database.

     - (**Don't forget**) Then merge previous prepared **`post`** branch into the testing branch. This will update the current upgraded deployments. The pods will rollout again. Test the app is still running fine.

     - (**Important!!**) Do not merge this testing branch into `main` or other `prep`, `post` branches. After testing, can simply close the testing pull request and it will delete OpenShift deployment.


  4. Merge `prep` pull request to main and let the `test` deployment rollout finish.

  5. Trigger the `Database Upgrade (dispatch)` action workflow, provide the `target` (`test`). Wait for the workflow to run successfully and test a few to confirm application is working as expect for new database upgrade.

  6. When `test` is success and verified, promote current main branch to `PROD` environment. Wait for the rollout is successful.
  
  7. Trigger the `Database Upgrade (dispatch)` action workflow, provide the `target` (`prod`). Wait for the workflow to run successfully and test a few to confirm application is working as expect for new database upgrade on production.

  8. After `test` and `prod` are upgraded to the new database version, review the `post` pr then merge to main. The `test` environment will be rollout again. Verify application is running fine; and this `post` merge will bring reqular deployment procss back to normal.

  9. Then promote another `prod` release from the current main branch.

  ## Clean up ## 
  After database upgrade is done for all environments and `post` upgrade is also applied and verified the old deployment can be removed. This includes:
  - old database pod/deployment
  - old database upgrade PVC
