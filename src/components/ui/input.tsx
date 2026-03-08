import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, onClick, ...props }, ref) => {
    const handleClick: React.MouseEventHandler<HTMLInputElement> = (event) => {
      onClick?.(event)
      if (event.defaultPrevented) return

      const pickerTypes = new Set(["date", "time", "datetime-local", "month", "week"])
      if (!type || !pickerTypes.has(type)) return

      const pickerInput = event.currentTarget as HTMLInputElement & { showPicker?: () => void }
      pickerInput.showPicker?.()
    }

    return (
      <input
        type={type}
        className={cn(
          "ui-input flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground [color-scheme:dark] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        onClick={handleClick}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
