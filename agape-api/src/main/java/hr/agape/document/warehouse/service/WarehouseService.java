package hr.agape.document.warehouse.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.document.lookup.repository.VatCategoryRepository;
import hr.agape.common.config.AgapeConfig;
import hr.agape.document.warehouse.repository.WarehouseRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;

@ApplicationScoped
public class WarehouseService {

    private final WarehouseRepository repo;
    private final AgapeConfig agapeConfig;
    private final VatCategoryRepository vatRepo;

    @Inject
    public WarehouseService(
            WarehouseRepository repo, AgapeConfig agapeConfig,
            VatCategoryRepository vatRepo
    ) {
        this.repo = repo;
        this.agapeConfig = agapeConfig;
        this.vatRepo = vatRepo;
    }

    @Transactional
    public ServiceResponseDTO<List<Long>> getWarehouses() {
        try {
            return ServiceResponseDirector.successOk(repo.listWarehouses(), "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to load warehouses: " + e.getMessage());
        }
    }

    public Long resolveVatIdForUser(Long warehouseId, Long korisnikId) {
        try {
            Long pdvId = agapeConfig.pdvByWarehouse().get(String.valueOf(warehouseId));
            if (pdvId == null) return null;

            if (!vatRepo.existsActiveSifrepdv(korisnikId, pdvId)) return null;

            return pdvId;
        } catch (Exception e) {
            return null;
        }
    }
}
