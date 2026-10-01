import { Integration, IntegrationType } from "./types";
import { ErpIntegration } from "./erp";

const INTEGRATION_MAP: Record<IntegrationType, () => Integration> = {
  erp: () => new ErpIntegration(),
};

export function getEnabledIntegrations(): Integration[] {
  const raw = process.env.INTEGRATIONS || "notion";
  const types = raw
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter((t): t is IntegrationType => t in INTEGRATION_MAP);

  return types.map((type) => INTEGRATION_MAP[type]());
}
