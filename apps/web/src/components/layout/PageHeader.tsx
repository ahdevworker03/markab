import { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  action?: ReactNode;
}

export function PageHeader({ title, showBack, onBack, action }: PageHeaderProps) {
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      window.history.back();
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-background border-b border-border px-4 py-3 flex items-center justify-between min-h-[60px]">
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={handleBack}
            aria-label="رجوع"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted/50 active:bg-muted transition-colors -mr-2"
          >
            <ChevronRight className="w-6 h-6 text-foreground" strokeWidth={2} />
          </button>
        )}
        <h1 className="text-lg font-bold text-foreground m-0">{title}</h1>
      </div>
      {action && (
        <div className="flex items-center">
          {action}
        </div>
      )}
    </header>
  );
}
