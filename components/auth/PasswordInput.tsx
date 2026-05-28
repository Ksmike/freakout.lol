"use client";

import { useState, type ChangeEventHandler } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";

type PasswordInputProps = {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  value?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
};

export function PasswordInput({
  id,
  name,
  label,
  autoComplete,
  placeholder,
  required,
  minLength,
  value,
  onChange,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const inputType = isVisible ? "text" : "password";
  const toggleLabel = isVisible ? "Hide password" : "Show password";
  const ToggleIcon = isVisible ? LuEyeOff : LuEye;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={inputType}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          className="w-full rounded-md border border-divider bg-content1 px-3 py-2 pr-11 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder={placeholder}
        />
        <button
          type="button"
          aria-label={toggleLabel}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((current) => !current)}
          className="absolute inset-y-0 right-0 inline-flex w-10 items-center justify-center rounded-r-md text-foreground/60 transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        >
          <ToggleIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}
