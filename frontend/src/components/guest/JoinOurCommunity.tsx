import React from 'react';
import { PiTelegramLogoLight } from 'react-icons/pi';
import { FaXTwitter } from 'react-icons/fa6'; // Import Twitter (X) icon

const JoinOurCommunity = () => {
    return (
        <section className="w-full md:py-36 py-28 px-4">
            <div className='w-full max-w-[80%] mx-auto flex flex-col justify-center items-center gap-6'>
                <div className='w-full flex lg:flex-row items-center flex-col gap-4'>
                    <h1 className="flex-1 text-[#F0F7F7] font-orbitron md:text-[36px] text-[28px] -tracking-[2%] font-[700]">Join Our Community</h1>
                    <p className="flex-1 font-dmSans font-[400] text-[18px] text-[#F0F7F7] -tracking-[2%]">
                        Join our community of players, builders, and dreamers shaping the future of gaming — one block at a time.
                    </p>
                </div>

                <div className="w-full flex md:flex-row flex-col gap-4 md:gap-0 justify-center md:items-center items-start mt-2">
                    {/* Telegram Button */}
                    <button
                        type="button"
                        className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                    >
                        <svg
                            width="227"
                            height="40"
                            viewBox="0 0 227 40"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute top-0 left-0 w-full h-full"
                        >
                            <path
                                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                                fill="#0E1415"
                                stroke="#003B3E"
                                strokeWidth={1}
                                className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                            />
                        </svg>
                        <a
                            href="https://t.me/+xJLEjw9tbyQwMGVk"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center text-[#0FF0FC] capitalize text-[13px] font-dmSans font-medium z-10"
                        >
                            <PiTelegramLogoLight className="mr-1 w-[14px] h-[14px]" />
                            Join our Telegram
                        </a>
                    </button>

                    {/* Twitter (X) Button */}
                    <button
                        type="button"
                        className="relative group w-[227px] h-[40px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                    >
                        <svg
                            width="227"
                            height="40"
                            viewBox="0 0 227 40"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute top-0 left-0 w-full h-full transform scale-x-[-1] scale-y-[-1]"
                        >
                            <path
                                d="M6 1H221C225.373 1 227.996 5.85486 225.601 9.5127L207.167 37.5127C206.151 39.0646 204.42 40 202.565 40H6C2.96244 40 0.5 37.5376 0.5 34.5V6.5C0.5 3.46243 2.96243 1 6 1Z"
                                fill="#003B3E"
                                stroke="#003B3E"
                                strokeWidth={1}
                                className="group-hover:stroke-[#00F0FF] transition-all duration-300 ease-in-out"
                            />
                        </svg>
                        <a
                            href="https://x.com/blockopoly1"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center text-[#00F0FF] capitalize text-[13px] font-dmSans font-medium z-10"
                        >
                            <FaXTwitter className="mr-1 w-[14px] h-[14px]" />
                            Follow us on X
                        </a>
                    </button>
                </div>
            </div>
        </section>
    );
};

export default JoinOurCommunity;