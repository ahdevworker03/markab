import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: number | string;
  variant: "available" | "rented" | "maintenance";
  onClick?: () => void;
  className?: string;
}

const variantMap = {
  available: "bg-[hsl(var(--status-available-bg))] text-[hsl(var(--status-available))]",
  rented: "bg-[hsl(var(--status-rented-bg))] text-[hsl(var(--status-rented))]",
  maintenance: "bg-[hsl(var(--status-maintenance-bg))] text-[hsl(var(--status-maintenance))]",
};

export function StatCard({ label, value, variant, onClick, className }: StatCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "rounded-2xl p-4 flex flex-col justify-center transition-transform",
        variantMap[variant],
        onClick && "cursor-pointer hover:scale-[0.98] active:scale-95",
        className
      )}
    >
      <div className="text-3xl font-bold mb-1">{value}</div>
      <div className="text-sm font-medium opacity-90">{label}</div>
    </div>
  );
}
