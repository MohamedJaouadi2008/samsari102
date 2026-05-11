
import React from 'react';
import { Input } from "./input";

interface TimePickerProps {
  value?: string;
  onValueChange?: (time: string) => void;
  placeholder?: string;
}

export const TimePicker: React.FC<TimePickerProps> = ({ 
  value, 
  onValueChange, 
  placeholder = "Select time" 
}) => {
  return (
    <Input 
      type="time" 
      value={value || ''}
      onChange={(e) => onValueChange?.(e.target.value)}
      placeholder={placeholder}
    />
  );
};
