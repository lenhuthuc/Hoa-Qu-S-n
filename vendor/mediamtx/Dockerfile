FROM bluenviron/mediamtx:latest-ffmpeg AS mediamtx
FROM alpine:latest
RUN apk add --no-cache curl ffmpeg
COPY --from=mediamtx /mediamtx /mediamtx
COPY mediamtx.yml /mediamtx.yml
ENTRYPOINT [ "/mediamtx" ]
