/* tslint:disable */
/* eslint-disable */
// Generated using typescript-generator version 3.2.1263 on 2026-01-25 21:17:55.

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

export interface DispatchBulkItemResultDTO {
    index: number;
    documentId: number;
    partnerId: number;
    requestedDraft: boolean;
    headerId: number;
    status: string;
    success: boolean;
    error: string;
    response: DispatchResponseDTO;
}

export interface DispatchBulkResponseDTO {
    total: number;
    succeeded: number;
    failed: number;
    posted: number;
    drafts: number;
    items: DispatchBulkItemResultDTO[];
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
    warehouseId: number;
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
    postNow: boolean;
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
    lineNumber: number;
    note: string;
}

export interface DocumentItemPriceDTO {
    itemId: number;
    pdvId: number;
    priceFak: number;
    priceNab: number;
    priceMp: number;
    priceJedinice: number;
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

export interface FolderCreateRequestDTO {
    parentId: number;
    name: string;
}

export interface FolderRenameRequestDTO {
    name: string;
}

export interface FolderResponseDTO {
    id: number;
    parentId: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface TemplateBookManyRequestDTO {
    templateId: number;
    warehouseId: number;
    partnerIds: number[];
    documentDate: Date;
    draftOverride: boolean;
}

export interface TemplateBookOneRequestDTO {
    templateId: number;
    warehouseId: number;
    partnerId: number;
    documentDate: Date;
    draftOverride: boolean;
}

export interface TemplateCopyRequestDTO {
    newName: string;
    folderId: number;
}

export interface TemplateCreateRequestDTO {
    folderId: number;
    householdSize: number;
    name: string;
    description: string;
}

export interface TemplateDocResponseDTO {
    id: number;
    documentId: number;
    sortOrder: number;
    draft: boolean;
    defaultNote: string;
    items: TemplateItemResponseDTO[];
}

export interface TemplateDocUpsertRequestDTO {
    documentId: number;
    sortOrder: number;
    draft: boolean;
    defaultNote: string;
}

export interface TemplateItemResponseDTO {
    itemId: number;
    quantity: number;
    sortOrder: number;
}

export interface TemplateItemUpsertRequestDTO {
    itemId: number;
    quantity: number;
    sortOrder: number;
}

export interface TemplateResponseDTO {
    id: number;
    folderId: number;
    householdSize: number;
    name: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
    documents: TemplateDocResponseDTO[];
    shared: boolean;
}

export interface TemplateShareCreateRequestDTO {
    username: string;
    permission: DispatchTemplateSharePermission;
}

export interface TemplateShareResponseDTO {
    id: number;
    templateId: number;
    sharedWithUserId: number;
    sharedWithUsername: string;
    permission: DispatchTemplateSharePermission;
    createdAt: Date;
}

export interface TemplateUpdateRequestDTO {
    folderId: number;
    householdSize: number;
    name: string;
    description: string;
}

export interface AuthResponseDTO {
    userId: number;
    username: string;
    name: string;
    defaultWarehouseId: number;
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
    oib: string;
}

export interface RegisterResponseDTO {
    userId: number;
    username: string;
    name: string;
}

export interface UpdateDefaultWarehouseRequestDTO {
    warehouseId: number;
}

export interface UpdateUserRequestDTO {
    username: string;
    name: string;
    password: string;
    defaultWarehouseId: number;
}

export interface UserDirectoryResponseDTO {
    id: number;
    username: string;
    name: string;
}

export interface UserResponseDTO {
    id: number;
    username: string;
    name: string;
    defaultWarehouseId: number;
}

export interface DispatchItemRequest {
    itemId: number;
    quantity: number;
}

export interface DispatchItemPatch {
    itemId: number;
    quantity: number;
}

export type DispatchTemplateSharePermission = "VIEW" | "BOOK";
