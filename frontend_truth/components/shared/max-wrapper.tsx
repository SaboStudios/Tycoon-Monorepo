import { cn } from "@/lib/utils";
import { MaxWrapperTypes } from "@/types";
import React, { FC } from "react";

/**
 * MaxWrapper is a functional component that provides a responsive container
 * with a maximum width of 1440px. It centers its children within the page,
 * using full width and automatic horizontal margins. The component accepts
 * optional custom class names to extend its styling.
 *
 * @param {React.ReactNode} children - The content to be wrapped within the container.
 * @param {string} [className] - Optional additional class names for custom styling.
 * @returns {JSX.Element} A div element that wraps the provided children.
 */

const MaxWrapper: FC<MaxWrapperTypes> = ({ children, className }) => {
    return <div className={cn("w-full mx-auto max-w-[1440px]", className)}>{children}</div>;
};

export default MaxWrapper;