package hr.agape.dispatch.config;


import io.smallrye.config.ConfigMapping;

@ConfigMapping(prefix = "dispatch.mk")
public interface DispatchDocumentConfig {
    int knjizitiNaSkladiste();

    int knjizitiUkPopisa();

    int knjizitiNormative();

    int generirajZapisnik();

    int azurirajProdajne();

    int azurirajNabavne();
}
