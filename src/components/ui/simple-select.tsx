import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  placeholder?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const SimpleSelect = React.forwardRef<HTMLButtonElement, SelectProps>(
  (
    {
      options,
      value,
      placeholder = "Select...",
      onValueChange,
      className,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);

    const handleSelect = (optionValue: string) => {
      onValueChange?.(optionValue);
      setIsOpen(false);
    };

    const selectedOption = options.find((option) => option.value === value);

    return (
      <div className="relative">
        <Button
          ref={ref}
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={cn("w-full justify-between", className)}
          onClick={() => setIsOpen(!isOpen)}
          {...props}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg text-popover-foreground">
            <div className="max-h-60 overflow-auto">
              {options.map((option) => (
                <div
                  key={option.value}
                  className={cn(
                    "flex items-center px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground",
                    value === option.value && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => handleSelect(option.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

SimpleSelect.displayName = "SimpleSelect";

export { SimpleSelect };
