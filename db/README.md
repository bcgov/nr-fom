# PostgreSQL Database Migration Steps

This guide outlines the steps to migrate a database to PostgreSQL v17 in an OpenShift environment. It can be reused for upgrading to other versions.

### 1. Set the Target Environment

Set the target to a PR number (e.g., `819`), `test`, or `prod`:

```bash
export TARGET=819
```

### 2. Log in to OpenShift via CLI and set the appropriate namespace (`dev`, `test`, or `prod`).

### 3. Scale Down the API

```bash
oc scale deployment fom-${TARGET}-api --replicas=0
```

### 4. Rename the Old Database

Navigate to the `db` directory: `cd db`. The script renames the original database deployment config (e.g., `fom-819-db` to `fom-819-db-prev`). 

> Note: In order to rename the deployment config, we must delete and recreate it because we cannot edit it directly. It creates the database using the same PVC. PVC will not get renamed.

```bash
./rename_deployment.sh fom-${TARGET}-db
```

### 5. Deploy the New PostgreSQL Database (e.g., v17)

Create a new deployment config (e.g., `fom-819-db`) with PostgreSQL v17 and a new PVC (e.g., `fom-819-db-17`) that has the default data:

```bash
oc process -f openshift.deploy.yml -p ZONE=${TARGET} -p TAG=${TARGET} | oc apply -f -
```

### 6. Transfer Data from Old to New Database

```bash
./db_transfer.sh fom-${TARGET}-db-prev fom-${TARGET}-db
```

### 7. Manual Verification

Connect to the new database and verify:

```bash
psql -U postgres -d fom
```

Run the following checks:

```sql
-- Check project row count
SELECT COUNT(1) FROM app_fom.project;

-- Check installed extensions and versions
SELECT extname AS extension, extversion AS version
FROM pg_extension
ORDER BY extname;
```

In non-prod environments, add a new FOM and verify project counts again.

### 8. Scale Up the API

```bash
oc scale deployment fom-${TARGET}-api --replicas=3
```

# Rollback Procedure

1. Scale down the API:

    ```bash
    oc scale deployment fom-${TARGET}-api --replicas=0
    ```

2. Delete or rename the new database deployment config:

    ```bash
    ./rename_deployment.sh fom-${TARGET}-db fom-${TARGET}-db-upgraded
    ```

3. Restore the old database:

    ```bash
    ./rename_deployment.sh fom-${TARGET}-db-prev fom-${TARGET}-db
    ```

4. Verify the database is running.

5. Scale up the API:

    ```bash
    oc scale deployment fom-${TARGET}-api --replicas=3
    ```

---

## Notes
Whenever we need to do a database migration, run the scripts first before merge the upgradation pr, as it will use the new PVC name for the new database.


