/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 3.2.1263 on 2026-01-06 20:59:28.

export interface PagedResultDTO<T> {
    items: T[];
    page: number;
    size: number;
    total: number;
}

export interface ServiceResponseDTO<T> {
    success: boolean;
    message: string;
    statusCode: number;
    data: T;
}

export interface DispatchLineResponseDTO {
    lineNumber: number;
    itemId: number;
    quantity: number;
    nameId: number;
    unitOfMeasureId: number;
    valueAddedTaxId: number;
}

export interface DispatchRequestDTO {
    documentId: number;
    documentDate: Date;
    partnerId: number;
    items: DispatchItemRequest[];
    draft: boolean;
}

export interface DispatchResponseDTO {
    documentHeaderId: number;
    documentId: number;
    documentBr: number;
    documentDate: Date;
    partnerId: number;
    status: string;
    posted: boolean;
    postedBy: number;
    postedAt: Date;
    cancelled: boolean;
    cancelledBy: number;
    cancelledAt: Date;
    cancelNote: string;
    createdAt: Date;
}

export interface DispatchSummaryResponseDTO {
    id: number;
    documentId: number;
    documentNumber: number;
    documentDate: Date;
    partnerId: number;
    createdBy: number;
    createdAt: Date;
    posted: boolean;
    postedBy: number;
    postedAt: Date;
    cancelled: boolean;
    cancelledBy: number;
    cancelledAt: Date;
    status: string;
}

export interface DispatchUpdateRequestDTO {
    cancel: boolean;
    cancelReason: string;
    partnerId: number;
    overrideNote: string;
    items: DispatchItemPatch[];
}

export interface DocumentDescriptorResponseDTO {
    documentId: number;
    documentCode: string;
    displayName: string;
    inOutFlag: number;
    changesStock: number;
}

export interface DocumentItemLineDTO {
    itemId: number;
    quantity: number;
    nameId: number;
    unitOfMeasureId: number;
    valueAddedTaxId: number;
}

export interface WarehouseDTO {
    warehouseId: number;
    name: string;
}

export interface PartnerResponseDTO {
    id: number;
    tenantId: number;
    statusId: number;
    partnerNumber: number;
    taxNumber: string;
    name: string;
    address: string;
    postalCode: string;
    city: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface StockItemSummaryDTO {
    itemId: number;
    warehouseId: number;
    itemCode: string;
    name: string;
    unit: string;
    currentQty: number;
    minimalQty: number;
    recommendedQty: number;
    reservedQty: number;
}

export interface StockStatisticsResponseDTO {
    totals: StockStatisticsTotalsDTO;
    missing: StockItemSummaryDTO[];
    needsFill: StockItemSummaryDTO[];
    mostInStock: StockItemSummaryDTO[];
}

export interface StockStatisticsTotalsDTO {
    totalItems: number;
    missingCount: number;
    needsFillCount: number;
    overstockedCount: number;
    reservedCount: number;
    totalStockQty: number;
}

export interface AuthResponseDTO {
    userId: number;
    username: string;
    name: string;
    token: string;
}

export interface LoginRequestDTO {
    username: string;
    password: string;
}

export interface RegisterRequestDTO {
    name: string;
    username: string;
    password: string;
}

export interface RegisterResponseDTO {
    userId: number;
    username: string;
    name: string;
}

export interface UpdateUserRequestDTO {
    username: string;
    name: string;
    password: string;
}

export interface UserResponseDTO {
    id: number;
    username: string;
    name: string;
}

export interface DispatchItemRequest {
    itemId: number;
    quantity: number;
}

export interface DispatchItemPatch {
    itemId: number;
    quantity: number;
}
