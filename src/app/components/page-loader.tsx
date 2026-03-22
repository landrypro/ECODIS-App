import { Loader2 } from "lucide-react";

export function PageLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 text-primary animate-spin" />
    </div>
  );
}
