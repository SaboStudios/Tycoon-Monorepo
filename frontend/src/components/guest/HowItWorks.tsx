'use client'
import React, { useState } from 'react'
import { Swiper, SwiperSlide } from 'swiper/react'
import { Pagination, Autoplay } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import { slidesData } from '@/utils/slidesData'

const HowItWorks = () => {
    const [currentSlide, setCurrentSlide] = useState(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [swiperInstance, setSwiperInstance] = useState<any>(null)


    return (
        <section className="relative w-full h-[856px] overflow-hidden flex flex-col items-center justify-center border-y-[1px] border-[#0FF0FC]/20">
            {/* Background Layers */}
            <div
                className="absolute inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('/howItWorksBg1.png')`, opacity: currentSlide === 0 ? 1 : 0 }}
            />
            <div
                className="absolute inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('/howItWorksBg2.png')`, opacity: currentSlide === 1 ? 1 : 0 }}
            />
            <div
                className="absolute inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('/howItWorksBg3.png')`, opacity: currentSlide === 2 ? 1 : 0 }}
            />
            <div
                className="absolute inset-0 z-0 transition-opacity duration-700 ease-in-out bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('/howItWorksBg4.png')`, opacity: currentSlide === 3 ? 1 : 0 }}
            />


            {/* Foreground content */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#010F1000] via-[#010F10] z-0 w-full px-4 flex flex-col items-center justify-center">
                <div className=' w-full flex flex-col justify-center items-center gap-2 mb-6'>
                    <h1 className="text-center text-[#F0F7F7] font-[900] md:text-[48px] text-[32px] font-orbitron leading-normal">How it works</h1>
                    <p className='md:max-w-[60%]  w-full text-center text-[20px] font-[400] font-dmSans leading-[30px] text-[#F0F7F7]'>It&apos;s super simple how Tycoon works. The flow has been designed to help you not to stress too much.</p>
                </div>


                <Swiper
                    spaceBetween={30}
                    slidesPerView={'auto'}
                    centeredSlides={true}
                    onSlideChange={(swiper) => setCurrentSlide(swiper.realIndex)}
                    autoplay={{ delay: 4000, disableOnInteraction: false }}
                    onSwiper={setSwiperInstance}
                    className="w-full max-w-[644px] h-[350px] mt-10 px-6"
                    modules={[Pagination, Autoplay]}
                    pagination={{ clickable: true, el: '.swiper-pagination' }}
                >
                    {
                        slidesData.map((item, index) => (
                            <SwiperSlide key={index} className={`keen-slider__slide w-[90%] sm:w-full h-[350px] relative md:p-6 p-3 rounded-[12px] overflow-hidden flex items-center justify-center transition-all duration-500 ${currentSlide !== index ? 'blur-[1.5px] opacity-40 scale-[0.95]' : 'opacity-100 blur-0 scale-100'
                                }`}>
                                <div className="w-full h-full bg-[#091F201F] border-[1px] border-[#55656D] rounded-[12px] custom-glow-blur p-6 md:p-10 flex flex-col justify-between items-center">
                                    <div className="w-full flex items-center justify-between">
                                        {item.icon}
                                        <span className='text-[#73838B] font-dmSans font-[400] text-[14px]'>{item.outOf}</span>
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="md:text-[25px] text-[20px] text-[#FFFFFF] font-[800] font-orbitron uppercase">{item.title}</h2>
                                        <p className="md:text-[18px] text-[17px] leading-[28px] text-[#BDBDBD] font-[400] font-dmSans mt-2">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </SwiperSlide>
                        ))
                    }
                </Swiper>



                <div className='w-full max-w-[620px] flex justify-between items-center gap-6 mt-6 md:px-6'>
                    <div className="swiper-pagination hidden" />
                    {/* Dots Navigation */}
                    <div className=" flex gap-2 ">
                        {[0, 1, 2, 3].map((i) => (
                            <button
                                key={i}
                                onClick={() => {
                                    setCurrentSlide(i);
                                    swiperInstance?.slideTo(i)
                                }}
                                className={`h-[12px] cursor-pointer rounded-full ${currentSlide === i ? 'bg-cyan-400 w-[36px]' : 'bg-[#455A64] w-[12px]'} transition-all duration-300`}
                            />
                        ))}
                    </div>
{/* 
                    <button
                        type="button"
                        className="relative group w-[260px] h-[52px] bg-transparent border-none p-0 overflow-hidden cursor-pointer"
                    >
                        <svg
                            width="260"
                            height="52"
                            viewBox="0 0 260 52"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute top-0 left-0 w-full h-full transform scale-x-[-1]"
                        >
                            <path
                                d="M10 1H250C254.373 1 256.996 6.85486 254.601 10.5127L236.167 49.5127C235.151 51.0646 233.42 52 231.565 52H10C6.96244 52 4.5 49.5376 4.5 46.5V9.5C4.5 6.46243 6.96243 4 10 4Z"
                                fill="#00F0FF"
                                stroke="#0E282A"
                                strokeWidth={1}
                            />
                        </svg>
                        <span className="absolute inset-0 flex items-center justify-center text-[#010F10] text-[18px] -tracking-[2%] font-orbitron font-[700] z-1">
                            Let&apos;s Go!
                        </span>
                    </button> */}
                </div>

            </div>
        </section>
    )
}

export default HowItWorks