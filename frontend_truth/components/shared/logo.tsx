
import { LogoTypes } from '@/types';
import Image from 'next/image'
import Link from 'next/link'
import React, { FC } from "react";

/**
 * Logo component renders a link containing an image.
 *
 * This component uses Next.js's Image component for optimized image loading
 * and rendering. The image is wrapped in a Link component, allowing it to 
 * function as a navigational element.
 *
 * @param {string} className - Custom class names for styling the link.
 * @param {StaticImageData} image - The image source data for the logo.
 * @param {string} href - The URL to navigate to when the logo is clicked.
 * 
 * @returns {JSX.Element} A link element containing an image.
 */

const Logo: FC<LogoTypes> = ({ className, image, href }) => {
    return (
        <Link href={href} className={className}>
            <Image src={image} alt="Logo" className='w-full' width={226} height={196} priority quality={100} />
        </Link>
    )
}

export default Logo