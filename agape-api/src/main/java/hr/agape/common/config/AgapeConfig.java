package hr.agape.common.config;

import io.smallrye.config.ConfigMapping;

import java.util.Map;

@ConfigMapping(prefix = "agape")
public interface AgapeConfig {
    String oib();

    Operater operater();

    Map<String, Long> pdvByWarehouse();

    interface Operater {
        String oib();
    }
}
