package hr.agape.common.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "agape")
public interface AgapeConfig {
    String oib();

    Operater operater();

    interface Operater {
        String oib();
    }
}
