import { Droplets, Wrench, Shield, FileText, Hammer } from "lucide-react";
import type { MaintenanceType, VehicleStatus } from "@/data/types";

export const MAINTENANCE_TYPES: Record<
  MaintenanceType,
  { label: string; icon: React.ElementType }
> = {
  oil:          { label: "تغيير زيت",    icon: Droplets },
  inspection:   { label: "فحص ميكانيكي", icon: Wrench   },
  insurance:    { label: "تأمين",         icon: Shield   },
  registration: { label: "تسجيل",        icon: FileText },
  repair:       { label: "تصليح",        icon: Hammer   },
};

export const MAINTENANCE_TYPE_OPTIONS = (
  Object.keys(MAINTENANCE_TYPES) as MaintenanceType[]
).map((value) => ({ value, ...MAINTENANCE_TYPES[value] }));

export const VEHICLE_STATUS_LABELS: Record<VehicleStatus, string> = {
  available: "متاحة",
  rented: "مؤجرة",
  maintenance: "صيانة",
};
