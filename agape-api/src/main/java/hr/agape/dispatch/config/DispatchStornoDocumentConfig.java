package hr.agape.dispatch.config;

import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "dispatch.mk-storno")
public interface DispatchStornoDocumentConfig {
    int naSkladiste();

    int ukPopisa();

    int veznid();

    int postaviOznaku();
}