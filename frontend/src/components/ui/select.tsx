"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
    value: string
    label: string
}

interface SelectProps {
    value?: string
    onChange?: (value: string) => void
    placeholder?: string
    options: SelectOption[]
    className?: string
    disabled?: boolean
    id?: string
    error?: string | null
    onRetry?: () => void
    emptyMessage?: string
    "aria-labelledby"?: string
    "aria-label"?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
    ({ value, onChange, placeholder = "Select...", options, className, disabled, id, error, onRetry, emptyMessage = "No options available", "aria-labelledby": ariaLabelledby, "aria-label": ariaLabel }, ref) => {
        const [isOpen, setIsOpen] = React.useState(false)
        const [activeIndex, setActiveIndex] = React.useState<number>(-1)
        const containerRef = React.useRef<HTMLDivElement>(null)
        const listboxId = React.useId()
        const triggerId = id ?? React.useId()

        React.useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                    setIsOpen(false)
                }
            }
            document.addEventListener("mousedown", handleClickOutside)
            return () => document.removeEventListener("mousedown", handleClickOutside)
        }, [])

        // Reset active index when opening
        React.useEffect(() => {
            if (isOpen) {
                const selectedIndex = options.findIndex((o) => o.value === value)
                setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0)
            }
        }, [isOpen, options, value])

        const selectedOption = options.find((opt) => opt.value === value)

        const handleSelect = (optionValue: string) => {
            onChange?.(optionValue)
            setIsOpen(false)
        }

        const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
            if (disabled) return
            switch (e.key) {
                case "Enter":
                case " ":
                    e.preventDefault()
                    if (isOpen && activeIndex >= 0) {
                        handleSelect(options[activeIndex].value)
                    } else {
                        setIsOpen(true)
                    }
                    break
                case "ArrowDown":
                    e.preventDefault()
                    if (!isOpen) {
                        setIsOpen(true)
                    } else {
                        setActiveIndex((i) => Math.min(i + 1, options.length - 1))
                    }
                    break
                case "ArrowUp":
                    e.preventDefault()
                    if (!isOpen) {
                        setIsOpen(true)
                    } else {
                        setActiveIndex((i) => Math.max(i - 1, 0))
                    }
                    break
                case "Home":
                    e.preventDefault()
                    setActiveIndex(0)
                    break
                case "End":
                    e.preventDefault()
                    setActiveIndex(options.length - 1)
                    break
                case "Escape":
                    e.preventDefault()
                    setIsOpen(false)
                    break
                case "Tab":
                    setIsOpen(false)
                    break
            }
        }

        // Render error state
        if (error) {
            return (
                <div className={cn("relative", className)} ref={containerRef}>
                    <div
                        role="alert"
                        className="flex flex-col gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-800 dark:bg-red-900/20"
                    >
                        <div className="text-red-600 dark:text-red-400">{error}</div>
                        {onRetry && (
                            <button
                                type="button"
                                onClick={onRetry}
                                className="w-full rounded-sm bg-red-500 px-2 py-1 text-xs font-medium text-white hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
                            >
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            )
        }

        // Render empty state
        if (options.length === 0) {
            return (
                <div className={cn("relative", className)} ref={containerRef}>
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-center text-sm text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
                        {emptyMessage}
                    </div>
                </div>
            )
        }

        return (
            <div className={cn("relative", className)} ref={containerRef}>
                <button
                    type="button"
                    id={triggerId}
                    role="combobox"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    aria-controls={listboxId}
                    aria-labelledby={ariaLabelledby}
                    aria-label={ariaLabel}
                    aria-activedescendant={isOpen && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
                    onClick={() => !disabled && setIsOpen(!isOpen)}
                    onKeyDown={handleKeyDown}
                    className={cn(
                        "flex h-9 w-full items-center justify-between whitespace-nowrap rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-white placeholder:text-neutral-500 focus:outline-none focus:ring-1 focus:ring-tycoon-accent disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 dark:border-neutral-800 dark:placeholder:text-neutral-400",
                    )}
                    disabled={disabled}
                >
                    <span className={cn(!selectedOption && "text-neutral-500 dark:text-neutral-400")}>
                        {selectedOption ? selectedOption.label : placeholder}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" aria-hidden="true" />
                </button>
                {isOpen && (
                    <ul
                        id={listboxId}
                        role="listbox"
                        aria-labelledby={ariaLabelledby}
                        aria-label={ariaLabel}
                        className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-neutral-200 bg-white p-1 text-neutral-950 shadow-md dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50"
                    >
                        {options.map((option, index) => (
                            <li
                                key={option.value}
                                id={`${listboxId}-option-${index}`}
                                role="option"
                                aria-selected={value === option.value}
                                onClick={() => handleSelect(option.value)}
                                onMouseEnter={() => setActiveIndex(index)}
                                className={cn(
                                    "relative flex w-full cursor-pointer select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm outline-none",
                                    value === option.value && "bg-neutral-100 dark:bg-neutral-800",
                                    activeIndex === index && "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                                )}
                            >
                                <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                                    {value === option.value && <Check className="h-4 w-4" aria-hidden="true" />}
                                </span>
                                <span className="truncate">{option.label}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        )
    }
)
Select.displayName = "Select"

export { Select }
