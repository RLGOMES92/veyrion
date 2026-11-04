import test from "node:test";
import assert from "node:assert/strict";
import { calculateReturnProgress, hasOpenMaintenance } from "../lib/asset-lifecycle.ts";

const contract = { id: "CTR-1", payload: { quantity: 2, status: "Ativo", inventory_asset_ids: ["A-1", "A-2"] } };
const assets = [
  { id: "A-1", module: "assets", payload: { last_contract_id: "CTR-1" } },
  { id: "A-2", module: "assets", payload: { last_contract_id: "CTR-1" } },
];

test("devolução parcial mantém contrato em conferência", () => {
  const result = calculateReturnProgress(contract, assets, ["A-1"]);
  assert.equal(result.allReturned, false);
  assert.equal(result.returnStatus, "Em conferência");
  assert.equal(result.contractStatus, "Ativo");
});

test("última devolução encerra contrato", () => {
  const result = calculateReturnProgress(contract, assets, ["A-1", "A-2"]);
  assert.equal(result.allReturned, true);
  assert.equal(result.returnStatus, "Recebida");
  assert.equal(result.contractStatus, "Encerrado");
});

test("contrato não encerra se quantidade não estiver totalmente rastreada", () => {
  const result = calculateReturnProgress(
    { id: "CTR-2", payload: { quantity: 3, inventory_asset_ids: ["B-1", "B-2"] } }, [], ["B-1", "B-2"],
  );
  assert.equal(result.allReturned, false);
});

test("manutenção aberta bloqueia ativo", () => {
  const records = [{ id: "MAN-1", module: "maintenance", payload: { asset_id: "A-1", status: "Aberta" } }];
  assert.equal(hasOpenMaintenance(records, "A-1"), true);
  assert.equal(hasOpenMaintenance(records, "A-2"), false);
});

test("manutenção concluída ou cancelada não bloqueia ativo", () => {
  const records = [
    { id: "MAN-1", module: "maintenance", payload: { asset_id: "A-1", status: "Concluída" } },
    { id: "MAN-2", module: "maintenance", payload: { asset_id: "A-1", status: "Cancelada" } },
  ];
  assert.equal(hasOpenMaintenance(records, "A-1"), false);
});
