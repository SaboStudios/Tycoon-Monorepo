"use client";
import { AnimationVariant, AnimationWrapperProps } from "@/types/animate";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";

const variants: Record<AnimationVariant, Variants> = {
    fadeIn: {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    },

    slideUp: {
        hidden: { y: 50, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    },

    slideDown: {
        hidden: { y: -50, opacity: 0 },
        visible: { y: 0, opacity: 1 },
    },

    slideLeft: {
        hidden: { x: 50, opacity: 0 },
        visible: { x: 0, opacity: 1 },
    },

    slideRight: {
        hidden: { x: -50, opacity: 0 },
        visible: { x: 0, opacity: 1 },
    },

    scale: {
        hidden: { scale: 0.8, opacity: 0 },
        visible: { scale: 1, opacity: 1 },
    },

    bounce: {
        hidden: { y: 50, opacity: 0 },
        visible: {
            y: 0,
            opacity: 1,
            transition: {
                type: "spring" as const,
                stiffness: 300,
                damping: 15,
            },
        },
    },
};

export default function AnimationWrapper({
    children,
    variant = "fadeIn",
    delay = 0,
    duration = 0.5,
    className = "",
    once = true,
    ...props
}: AnimationWrapperProps) {
    return (
        <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once }}
            variants={variants[variant]}
            transition={{ duration, delay }}
            className={className}
            {...props}
        >
            {children}
        </motion.div>
    );
}