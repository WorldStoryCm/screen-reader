import { Typography } from "@/components/Typography";
import { Info } from "lucide-react";
import { ReactNode } from "react";
import { MobileTooltip } from "../TooltipProvider";

export interface InfoTooltipProps {
  tooltip?: ReactNode;
  tooltipTitle?: string;
  tooltipDescription?: string;
  iconClassName?: string;
}

export function InfoIconTooltip({
  tooltip,
  tooltipTitle,
  tooltipDescription,
  iconClassName,
}: InfoTooltipProps) {
  if (tooltip) {
    return <>{tooltip}</>;
  }
  if (!tooltipTitle?.length) {
    return null;
  }

  return (
    <MobileTooltip
      className="flex w-full max-w-[400px] items-center gap-3 px-4 py-4"
      delayDuration={300}
      content={
        <div className="flex flex-grow flex-col items-start">
          <Typography variant="h5">{tooltipTitle}</Typography>
          <Typography variant="small">{tooltipDescription}</Typography>
        </div>
      }
    >
      <Info className="h-4 w-4" />
    </MobileTooltip>
  );
}
