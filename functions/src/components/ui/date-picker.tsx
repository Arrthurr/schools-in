import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DatePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
}

const DatePicker = React.forwardRef<HTMLInputElement, DatePickerProps>(
  (
    { value, onChange, placeholder = "Select date...", className, ...props },
    ref
  ) => {
    const [inputValue, setInputValue] = React.useState<string>("");

    React.useEffect(() => {
      if (value) {
        setInputValue(value.toISOString().split("T")[0]);
      } else {
        setInputValue("");
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const dateValue = e.target.value;
      setInputValue(dateValue);

      if (dateValue) {
        const date = new Date(dateValue + "T00:00:00");
        onChange?.(date);
      } else {
        onChange?.(undefined);
      }
    };

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="date"
          value={inputValue}
          onChange={handleChange}
          className={cn("pl-10", className)}
          {...props}
        />
        <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }
);

DatePicker.displayName = "DatePicker";

export { DatePicker };
