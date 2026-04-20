package com.trash.ecommerce.service;

import com.drew.imaging.ImageMetadataReader;
import com.drew.imaging.ImageProcessingException;
import com.drew.lang.GeoLocation;
import com.drew.metadata.Metadata;
import com.drew.metadata.Tag;
import com.drew.metadata.exif.ExifSubIFDDirectory;
import com.drew.metadata.exif.GpsDirectory;
import com.googlecode.mp4parser.authoring.Movie;
import com.googlecode.mp4parser.authoring.Track;
import com.googlecode.mp4parser.authoring.container.mp4.MovieCreator;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Date;
import java.util.Locale;

@Service
public class StoryMediaMetadataService {

    private static final DateTimeFormatter[] VIDEO_TIME_FORMATTERS = new DateTimeFormatter[]{
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssX", Locale.ROOT),
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss", Locale.ROOT)
    };

    public StoryMediaAnalysis analyzeImage(MultipartFile file) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(file.getBytes()));

            Double latitude = null;
            Double longitude = null;
            LocalDateTime capturedAt = null;

            GpsDirectory gpsDirectory = metadata.getFirstDirectoryOfType(GpsDirectory.class);
            if (gpsDirectory != null) {
                GeoLocation geo = gpsDirectory.getGeoLocation();
                if (geo != null && !geo.isZero()) {
                    latitude = geo.getLatitude();
                    longitude = geo.getLongitude();
                }
            }

            ExifSubIFDDirectory exif = metadata.getFirstDirectoryOfType(ExifSubIFDDirectory.class);
            if (exif != null) {
                Date original = exif.getDateOriginal();
                if (original != null) {
                    capturedAt = Instant.ofEpochMilli(original.getTime())
                            .atZone(ZoneId.systemDefault())
                            .toLocalDateTime();
                }
            }

            boolean missingMetadata = latitude == null || longitude == null || capturedAt == null;
            return new StoryMediaAnalysis(latitude, longitude, capturedAt, null, null, missingMetadata);
        } catch (ImageProcessingException | IOException e) {
            return new StoryMediaAnalysis(null, null, null, null, null, true);
        }
    }

    public StoryMediaAnalysis analyzeVideo(MultipartFile file) {
        Path tempFile = null;
        try {
            byte[] bytes = file.getBytes();
            tempFile = Files.createTempFile("story-video-", ".mp4");
            Files.write(tempFile, bytes);

            Movie movie = MovieCreator.build(tempFile.toString());
            double durationSeconds = 0;
            boolean hasAudio = false;

            for (Track track : movie.getTracks()) {
                if ("soun".equals(track.getHandler())) {
                    hasAudio = true;
                }

                long timescale = track.getTrackMetaData().getTimescale();
                if (timescale > 0) {
                    double current = (double) track.getDuration() / timescale;
                    if (current > durationSeconds) {
                        durationSeconds = current;
                    }
                }
            }

            LocalDateTime capturedAt = extractVideoCapturedAt(bytes);
            boolean missingMetadata = capturedAt == null;
            return new StoryMediaAnalysis(null, null, capturedAt, durationSeconds, hasAudio, missingMetadata);
        } catch (Exception e) {
            return new StoryMediaAnalysis(null, null, null, null, null, true);
        } finally {
            if (tempFile != null) {
                try {
                    Files.deleteIfExists(tempFile);
                } catch (IOException ignored) {
                }
            }
        }
    }

    private LocalDateTime extractVideoCapturedAt(byte[] bytes) {
        try {
            Metadata metadata = ImageMetadataReader.readMetadata(new ByteArrayInputStream(bytes));
            for (var directory : metadata.getDirectories()) {
                for (Tag tag : directory.getTags()) {
                    String tagName = tag.getTagName() == null ? "" : tag.getTagName().toLowerCase(Locale.ROOT);
                    if (tagName.contains("creation") || tagName.contains("date")) {
                        String description = tag.getDescription();
                        LocalDateTime parsed = parseVideoDate(description);
                        if (parsed != null) {
                            return parsed;
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private LocalDateTime parseVideoDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }

        String value = raw.trim();
        for (DateTimeFormatter formatter : VIDEO_TIME_FORMATTERS) {
            try {
                return ZonedDateTime.parse(value, formatter).toLocalDateTime();
            } catch (Exception ignored) {
            }
            try {
                return LocalDateTime.parse(value, formatter);
            } catch (Exception ignored) {
            }
        }
        return null;
    }

    public record StoryMediaAnalysis(
            Double latitude,
            Double longitude,
            LocalDateTime capturedAt,
            Double durationSeconds,
            Boolean hasAudio,
            boolean metadataMissing
    ) {
    }
}
