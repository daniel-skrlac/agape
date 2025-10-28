package hr.agape.common.util;

import lombok.experimental.UtilityClass;

import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;

@UtilityClass
public final class TimeUtil {

    private static final ZoneId ZAGREB_ZONE = ZoneId.of("Europe/Zagreb");

    public static OffsetDateTime oracleTimestampToZagreb(Timestamp ts) {
        if (ts == null) {
            return null;
        }

        return ts.toLocalDateTime()
                .atOffset(ZoneOffset.UTC)
                .atZoneSameInstant(ZAGREB_ZONE)
                .toOffsetDateTime();
    }
}
