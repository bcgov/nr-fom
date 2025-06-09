FROM postgis/postgis:16-master

# Enable pgcrypto extension on startup
RUN sed -i '/EXISTS postgis_tiger_geocoder;*/a CREATE EXTENSION IF NOT EXISTS pgcrypto;' \
    /docker-entrypoint-initdb.d/10_postgis.sh

# Healthcheck 
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD [ "pg_isready" ]

# Non-root user
USER postgres
