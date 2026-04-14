FROM alpine:latest
RUN apk add --no-cache curl
COPY --from=bluenviron/mediamtx:latest /mediamtx /mediamtx
COPY --from=bluenviron/mediamtx:latest /mediamtx.yml /mediamtx.yml
# EXPOSE ports if needed but docker-compose handles it
ENTRYPOINT [ "/mediamtx" ]
