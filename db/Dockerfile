FROM postgis/postgis:18-13.6

# PostGIS is provided by the base image's init script (10_postgis.sh) on fresh init.
# pgcrypto is enabled via a main DB migration (CREATE EXTENSION IF NOT EXISTS pgcrypto)
# rather than here, so it also self-heals existing databases, not just fresh ones.

# Healthcheck
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD [ "pg_isready" ]

# Non-root user
USER postgres
