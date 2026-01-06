package hr.agape.warehouse.service;

import hr.agape.common.response.ServiceResponseDTO;
import hr.agape.common.response.ServiceResponseDirector;
import hr.agape.warehouse.repository.WarehouseRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.transaction.Transactional;

import java.util.List;

@ApplicationScoped
public class WarehouseService {

    private final WarehouseRepository repo;

    @Inject
    @SuppressWarnings("CdiInjectionPointsInspection")
    public WarehouseService(WarehouseRepository repo) {
        this.repo = repo;
    }

    @Transactional
    public ServiceResponseDTO<List<Long>> getWarehouses() {
        try {
            return ServiceResponseDirector.successOk(repo.listWarehouses(), "OK");
        } catch (Exception e) {
            return ServiceResponseDirector.errorInternal("Failed to load warehouses: " + e.getMessage());
        }
    }

}
