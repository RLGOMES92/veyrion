export type LifecycleRecord = {
  id: string;
  module: string;
  payload: Record<string, unknown>;
};

export function hasOpenMaintenance(
  records: LifecycleRecord[],
  assetId: string,
  excludeOrderId?: string,
): boolean {
  return records.some((record) =>
    record.module === "maintenance" &&
    record.id !== excludeOrderId &&
    String(record.payload.asset_id || "") === assetId &&
    !["Concluída", "Cancelada"].includes(String(record.payload.status || "Aberta")),
  );
}

export function calculateReturnProgress(
  contract: { id: string; payload: Record<string, unknown> },
  assetRecords: LifecycleRecord[],
  returnedAssetIds: Iterable<string>,
) {
  const returned = new Set(returnedAssetIds);
  const linkedAssetIds = Array.from(new Set([
    ...(Array.isArray(contract.payload.inventory_asset_ids)
      ? contract.payload.inventory_asset_ids.map(String)
      : []),
    ...assetRecords
      .filter((record) => record.module === "assets" && (
        String(record.payload.contract_id || "") === contract.id ||
        String(record.payload.last_contract_id || "") === contract.id
      ))
      .map((record) => record.id),
  ]));
  const expectedAssetIds = linkedAssetIds.length ? linkedAssetIds : [];
  const requiredQuantity = Math.max(0, Number(contract.payload.quantity) || 0);
  const allReturned = expectedAssetIds.length > 0 &&
    expectedAssetIds.length >= requiredQuantity &&
    expectedAssetIds.every((id) => returned.has(id));

  return {
    expectedAssetIds,
    requiredQuantity,
    allReturned,
    returnStatus: allReturned ? "Recebida" : "Em conferência",
    contractStatus: allReturned ? "Encerrado" : String(contract.payload.status || "Ativo"),
  };
}
