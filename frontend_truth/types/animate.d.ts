import { type MotionProps } from "framer-motion";
import { ReactNode } from "react";
export type AnimationVariant =
  | "fadeIn"
  | "slideUp"
  | "slideDown"
  | "slideLeft"
  | "slideRight"
  | "scale"
  | "bounce";

export interface AnimationWrapperProps extends Omit<MotionProps, "variants"> {
  children: ReactNode;
  variant?: AnimationVariant;
  delay?: number;
  duration?: number;
  className?: string;
  once?: boolean;
}
